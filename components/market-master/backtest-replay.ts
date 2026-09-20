export type BacktestReplayEvent = {
  sequence_no: number;
  event_type: string;
  bar_time: string | number | null;
  bar_index?: number | null;
  client_trade_id?: string | null;
  side?: string | null;
  units?: number | null;
  price?: number | null;
  sl_price?: number | null;
  tp_price?: number | null;
  close_reason?: string | null;
};

export type BacktestSessionListItem = {
  public_id: string;
  symbol: string;
  interval: string;
  timeframe?: string | null;
  status: string;
  start_bar_time?: string | null;
  cursor_bar_time?: string | null;
  initial_balance?: number;
  ending_balance?: number | null;
  trade_count?: number;
  closed_trade_count?: number;
  win_count?: number;
  realized_pnl?: number;
  created_at?: string | null;
  ended_at?: string | null;
};

export type BacktestSessionDetail = BacktestSessionListItem & {
  events?: BacktestReplayEvent[];
  trades?: unknown[];
};

export const toUnixSeconds = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
};

export const findCandleIndexByTime = (
  data: Array<{ time?: number }> = [],
  unixSeconds: number | null
) => {
  if (unixSeconds == null || !data.length) return -1;
  const exact = data.findIndex((candle) => candle.time === unixSeconds);
  if (exact >= 0) return exact;

  let best = -1;
  let bestDiff = Number.POSITIVE_INFINITY;
  data.forEach((candle, index) => {
    if (typeof candle.time !== "number") return;
    const diff = Math.abs(candle.time - unixSeconds);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = index;
    }
  });
  return bestDiff <= 3 * 86400 ? best : -1;
};

export const fromPersistSide = (side?: string | null) =>
  side === "SELL" || side === "Sell" || side === "SHORT" ? "Sell" : "Buy";

export const fromPersistCloseReason = (reason?: string | null) => {
  switch (reason) {
    case "SL_HIT":
      return "SL Hit";
    case "TP_HIT":
      return "TP Hit";
    case "FORCED_MARKET_CLOSE":
      return "Forced Market Close";
    default:
      return "Market Close";
  }
};

export const parseReplayTradeId = (raw?: string | null) => {
  if (raw == null || raw === "") return `replay-${Date.now()}`;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && String(numeric) === String(raw).trim()
    ? numeric
    : raw;
};

export const sortReplayEvents = (events: BacktestReplayEvent[] = []) =>
  [...events].sort((left, right) => {
    const leftSeq = Number(left.sequence_no || 0);
    const rightSeq = Number(right.sequence_no || 0);
    return leftSeq - rightSeq;
  });
