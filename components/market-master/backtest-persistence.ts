export const toPersistSide = (type: string) =>
  type === "Sell" || type === "SELL" || type === "SHORT" ? "SELL" : "BUY";

export const toPersistCloseReason = (reason?: string) => {
  switch (reason) {
    case "分笔短线减仓":
    case "PEN_SHORT_EXIT":
      return "PEN_SHORT_EXIT";
    case "分笔突破失效":
    case "PEN_BREAKOUT_FAILED":
      return "PEN_BREAKOUT_FAILED";
    case "SL Hit":
    case "SL_HIT":
      return "SL_HIT";
    case "TP Hit":
    case "TP_HIT":
      return "TP_HIT";
    case "Forced Market Close":
    case "FORCED_MARKET_CLOSE":
      return "FORCED_MARKET_CLOSE";
    default:
      return "MARKET_CLOSE";
  }
};

export type BacktestSessionStartPayload = {
  client_session_id: string;
  symbol: string;
  interval: string;
  timeframe: string;
  start_bar_time: number;
  start_bar_index: number;
  initial_visible_bars: number;
  cursor_bar_time?: number;
  cursor_bar_index?: number;
  initial_balance: number;
};

export type BacktestOpenPayload = {
  client_trade_id: string;
  bar_time: number;
  bar_index: number;
  side: string;
  units: number;
  price: number;
  sl_price: number | null;
  tp_price: number | null;
};

export type BacktestClosePayload = {
  client_trade_id: string;
  client_event_id?: string;
  units?: number;
  bar_time: number;
  bar_index: number;
  price: number;
  close_reason?: string;
};

export type BacktestModifyPayload = {
  client_trade_id: string;
  kind: "sl" | "tp";
  bar_time: number;
  bar_index: number;
  price: number | null;
};

export type BacktestCompletePayload = {
  cursor_bar_time?: number | null;
  cursor_bar_index?: number | null;
  ending_balance: number;
  mark_price: number;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const parsePayload = async (response: Response | Promise<Response>) => {
  const resolved = await response;
  const payload = await resolved.json().catch(() => null);
  const message =
    payload?.message ||
    payload?.error ||
    payload?.detail ||
    `回测记录保存失败 (${resolved.status})`;
  if (!resolved.ok) {
    throw new Error(message);
  }
  if (payload?.code && payload.code !== 200) {
    throw new Error(payload.message || message);
  }
  return payload?.data ?? payload;
};

export const createBacktestPersistClient = () => {
  let enabled = false;
  let fetchFn: FetchLike = fetch;
  let publicId: string | null = null;
  let queue: Promise<void> = Promise.resolve();
  let batchMode = false;
  let bufferedEvents: Record<string, unknown>[] = [];
  let pendingError: unknown = null;
  let pendingBatches = 0;

  const enqueue = (task: () => Promise<void>, recover = false) => {
    if (!enabled) return;
    queue = queue
      .then(() => { if (recover || !pendingError) return task(); })
      .catch((error) => {
        pendingError = error;
        console.error("[backtest-persist]", error);
      });
  };

  const requirePublicId = () => publicId;
  const sendEvents = (events: Record<string, unknown>[], batch: boolean) => {
    if (!enabled) return;
    pendingBatches++;
    enqueue(async () => {
      try {
        if (pendingError) return;
        const sessionId = requirePublicId();
        if (!sessionId) throw new Error("回测场次尚未创建，无法保存交易记录");
        await parsePayload(await fetchFn(`/api/market_master/backtest/sessions/${sessionId}/events`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch ? { events } : events[0]),
        }));
      } finally { pendingBatches--; }
    }, true);
  };
  const flushEvents = () => {
    if (!bufferedEvents.length) return;
    const events = bufferedEvents;
    bufferedEvents = [];
    sendEvents(events, true);
  };
  const recordEvent = (event: Record<string, unknown>) => {
    if (!enabled) return;
    if (!batchMode) { sendEvents([event], false); return; }
    bufferedEvents.push(event);
    if (bufferedEvents.length >= 200) flushEvents();
  };

  return {
    configure(options: { enabled: boolean; fetchFn: FetchLike }) {
      enabled = options.enabled;
      fetchFn = options.fetchFn;
    },
    startSession(payload: BacktestSessionStartPayload) {
      enqueue(async () => {
        pendingError = null;
        publicId = null;
        const data = await parsePayload(
          await fetchFn("/api/market_master/backtest/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        publicId = data?.public_id || null;
      }, true);
    },
    recordOpen(payload: BacktestOpenPayload) {
      recordEvent({ event_type: "OPEN", ...payload });
    },
    recordClose(payload: BacktestClosePayload) {
      recordEvent({ event_type: "CLOSE", ...payload, close_reason: toPersistCloseReason(payload.close_reason) });
    },
    recordModify(payload: BacktestModifyPayload) {
      const { kind, ...event } = payload;
      recordEvent({ event_type: kind === "sl" ? "MODIFY_SL" : "MODIFY_TP", ...event });
    },
    completeSession(payload: BacktestCompletePayload) {
      flushEvents();
      enqueue(async () => {
        const sessionId = requirePublicId();
        if (!sessionId) return;
        await parsePayload(
          await fetchFn(
            `/api/market_master/backtest/sessions/${sessionId}/complete`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          )
        );
        publicId = null;
      });
    },
    reset() {
      publicId = null;
      pendingError = null;
      bufferedEvents = [];
      batchMode = false;
    },
    async listSessions(page = 1, size = 20) {
      return parsePayload(
        await fetchFn(
          `/api/market_master/backtest/sessions?page=${page}&size=${size}`
        )
      );
    },
    async getSession(publicIdValue: string) {
      return parsePayload(
        await fetchFn(
          `/api/market_master/backtest/sessions/${publicIdValue}`
        )
      );
    },
    async deleteSession(publicIdValue: string) {
      return parsePayload(
        await fetchFn(
          `/api/market_master/backtest/sessions/${publicIdValue}`,
          { method: "DELETE" }
        )
      );
    },
    beginBatch() { batchMode = true; },
    async waitForCapacity() {
      if (pendingBatches >= 4) await queue;
      if (pendingError) throw pendingError;
    },
    async endBatch() {
      batchMode = false;
      flushEvents();
      await queue;
      if (pendingError) throw pendingError;
    },
    async shareSession(publicIdValue: string, signal?: AbortSignal) {
      return parsePayload(await fetchFn(
        `/api/market_master/backtest/sessions/${encodeURIComponent(publicIdValue)}/share`,
        { method: "POST", signal }
      ));
    },
    async revokeShare(publicIdValue: string) {
      return parsePayload(await fetchFn(
        `/api/market_master/backtest/sessions/${encodeURIComponent(publicIdValue)}/share`,
        { method: "DELETE" }
      ));
    },
    async getSharedSession(publicIdValue: string, signal?: AbortSignal) {
      return parsePayload(await fetchFn(
        `/api/market_master/backtest/shared/${encodeURIComponent(publicIdValue)}`,
        { method: "GET", cache: "no-store", signal }
      ));
    },
    async saveSharedSession(publicIdValue: string, signal?: AbortSignal) {
      return parsePayload(await fetchFn(
        `/api/market_master/backtest/shared/${encodeURIComponent(publicIdValue)}`,
        { method: "POST", signal }
      ));
    },
  };
};
