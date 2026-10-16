import type { NormalizedCandle } from "./market-data";

export type MarketDataMode = "history" | "realtime";
export type RealtimeQuote = { timestamp: number; bid: number; ask: number; sequence?: number };

/** Replace overlapping bars, append new ones, and never rewind pagination. */
export function applyRealtimeCandles(existing: NormalizedCandle[], incoming: NormalizedCandle[]) {
  if (!incoming.length || !existing.length) return 0;
  if (incoming[0].time > existing[existing.length - 1].time) {
    // Incremental updates include the preceding bar. A snapshot with no overlap
    // must not silently join two disconnected stretches of price history.
    throw Object.assign(new Error("历史缺口超出实时快照范围，请切回历史模式同步最新数据后重试"), { name: "RealtimeHistoryGap" });
  }
  let added = 0;
  for (const candle of incoming) {
    const last = existing[existing.length - 1].time;
    if (candle.time > last) { existing.push(candle); added++; continue; }
    let low = 0, high = existing.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const time = existing[middle].time;
      if (time === candle.time) { existing[middle] = candle; break; }
      if (time < candle.time) low = middle + 1; else high = middle - 1;
    }
  }
  return added;
}

/** Simulated execution uses only quotes received after entry, never bar extrema. */
export function realtimeExit(trade: { type: string; sl: number | null; tp: number | null; realtimeQuoteTime?: number; realtimeQuoteSequence?: number }, quotes: RealtimeQuote[]) {
  for (const quote of quotes) {
    const entryTime = trade.realtimeQuoteTime ?? Infinity;
    if (quote.timestamp < entryTime || (quote.timestamp === entryTime &&
        (quote.sequence ?? 0) <= (trade.realtimeQuoteSequence ?? Infinity))) continue;
    const price = (quote.bid + quote.ask) / 2;
    if (!Number.isFinite(price)) continue;
    const buy = trade.type === "Buy";
    if (trade.sl != null && (buy ? price <= trade.sl : price >= trade.sl)) return { price, reason: "SL Hit" };
    if (trade.tp != null && (buy ? price >= trade.tp : price <= trade.tp)) return { price, reason: "TP Hit" };
  }
  return null;
}
