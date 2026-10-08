import { calculateTradePnl, type TradePosition } from "./trade-management";

export type TradeHistoryFilters = {
  status: "all" | "Open" | "Closed";
  side: "all" | "Buy" | "Sell";
  pnl: "all" | "loss" | "profit" | "flat";
};
export const DEFAULT_TRADE_HISTORY_FILTERS: TradeHistoryFilters = { status: "all", side: "all", pnl: "all" };

export const tradeHistoryPnl = (trade: TradePosition, currentPrice: number) =>
  trade.status === "Open" ? calculateTradePnl(trade, currentPrice) : trade.pnl;

export function filterTradeHistory(trades: readonly TradePosition[], filters: TradeHistoryFilters, currentPrice: number) {
  return trades.filter((trade) => {
    if (filters.status !== "all" && trade.status !== filters.status) return false;
    if (filters.side !== "all" && trade.type !== filters.side) return false;
    const pnl = tradeHistoryPnl(trade, currentPrice);
    return filters.pnl === "all" || (filters.pnl === "loss" && pnl < 0) ||
      (filters.pnl === "profit" && pnl > 0) || (filters.pnl === "flat" && pnl === 0);
  });
}

/** Locate only revealed candles; moving the viewport must never move the replay cursor. */
export function tradeFocusRange(
  trade: Pick<TradePosition, "status" | "entryTime" | "closeTime">,
  candles: readonly { time: number }[],
  visibleCount: number,
): { from: number; to: number } | null {
  const count = Math.min(candles.length, Math.max(0, visibleCount));
  const indexAt = (time: number | undefined) => {
    if (time === undefined || !Number.isFinite(time)) return -1;
    let left = 0, right = count - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (candles[mid].time === time) return mid;
      if (candles[mid].time < time) left = mid + 1;
      else right = mid - 1;
    }
    return -1;
  };
  const entry = indexAt(trade.entryTime);
  const exit = trade.status === "Closed" ? indexAt(trade.closeTime) : entry;
  if (entry < 0 || exit < entry) return null;
  if (count === 1) return { from: -0.5, to: 0.5 };
  const span = exit - entry + 1;
  const width = Math.max(80, span + 2 * Math.max(12, Math.ceil(span * 0.15)));
  const from = Math.max(0, Math.min(entry - (width - span) / 2, count - width));
  return { from, to: Math.min(count - 1, from + width - 1) };
}
