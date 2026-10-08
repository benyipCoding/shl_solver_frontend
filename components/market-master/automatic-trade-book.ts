import type { TradePosition } from "./trade-management";

/** Closed fills stay in the journal, outside the per-candle execution loop. */
export function createAutomaticTradeBook(initial: readonly TradePosition[]) {
  const records = new Map<string | number, TradePosition>();
  const roots = new Map<string | number, number>();
  let sequence = 0;
  for (let i = initial.length - 1; i >= 0; i--) {
    const trade = initial[i];
    records.set(trade.id, trade);
    roots.set(trade.parentTradeId ?? trade.id, ++sequence);
  }
  return {
    commit(next: readonly TradePosition[]) {
      const open: TradePosition[] = [];
      for (const trade of next) {
        const root = trade.parentTradeId ?? trade.id;
        if (!roots.has(root)) roots.set(root, ++sequence);
        records.set(trade.id, trade);
        if (trade.status === "Open") open.push(trade);
      }
      return open;
    },
    snapshot() {
      return [...records.values()].sort((a, b) => {
        if (a.id === b.id) return 0;
        const rootA = a.parentTradeId ?? a.id, rootB = b.parentTradeId ?? b.id;
        if (rootA !== rootB) return roots.get(rootB)! - roots.get(rootA)!;
        if (a.id === rootA) return -1;
        if (b.id === rootB) return 1;
        return (b.closeCount ?? 0) - (a.closeCount ?? 0);
      });
    },
  };
}
