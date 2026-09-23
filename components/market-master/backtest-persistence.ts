export const toPersistSide = (type: string) =>
  type === "Sell" || type === "SELL" || type === "SHORT" ? "SELL" : "BUY";

export const toPersistCloseReason = (reason?: string) => {
  switch (reason) {
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

  const enqueue = (task: () => Promise<void>) => {
    if (!enabled) return;
    queue = queue
      .then(task)
      .catch((error) => {
        console.error("[backtest-persist]", error);
      });
  };

  const requirePublicId = () => publicId;

  return {
    configure(options: { enabled: boolean; fetchFn: FetchLike }) {
      enabled = options.enabled;
      fetchFn = options.fetchFn;
    },
    startSession(payload: BacktestSessionStartPayload) {
      enqueue(async () => {
        const data = await parsePayload(
          await fetchFn("/api/market_master/backtest/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        publicId = data?.public_id || publicId;
      });
    },
    recordOpen(payload: BacktestOpenPayload) {
      enqueue(async () => {
        const sessionId = requirePublicId();
        if (!sessionId) return;
        await parsePayload(
          await fetchFn(
            `/api/market_master/backtest/sessions/${sessionId}/events`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event_type: "OPEN",
                ...payload,
              }),
            }
          )
        );
      });
    },
    recordClose(payload: BacktestClosePayload) {
      enqueue(async () => {
        const sessionId = requirePublicId();
        if (!sessionId) return;
        await parsePayload(
          await fetchFn(
            `/api/market_master/backtest/sessions/${sessionId}/events`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event_type: "CLOSE",
                client_trade_id: payload.client_trade_id,
                client_event_id: payload.client_event_id,
                units: payload.units,
                bar_time: payload.bar_time,
                bar_index: payload.bar_index,
                price: payload.price,
                close_reason: toPersistCloseReason(payload.close_reason),
              }),
            }
          )
        );
      });
    },
    recordModify(payload: BacktestModifyPayload) {
      enqueue(async () => {
        const sessionId = requirePublicId();
        if (!sessionId) return;
        await parsePayload(
          await fetchFn(
            `/api/market_master/backtest/sessions/${sessionId}/events`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event_type:
                  payload.kind === "sl" ? "MODIFY_SL" : "MODIFY_TP",
                client_trade_id: payload.client_trade_id,
                bar_time: payload.bar_time,
                bar_index: payload.bar_index,
                price: payload.price,
              }),
            }
          )
        );
      });
    },
    completeSession(payload: BacktestCompletePayload) {
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
  };
};
