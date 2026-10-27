import type { TradePosition } from "./trade-management";

export type BrokerPosition = {
  trade_id: string; symbol: string; side: "Buy" | "Sell"; amount: number;
  open_rate: number; open_time: number; close_rate: number | null; close_time: number | null;
  stop: number | null; limit: number | null; gross_pl: number | null;
  commission: number | null; rollover: number | null; net_pl: number | null;
  open_order_id: string | null; close_order_id: string | null;
};
export type BrokerCommand = {
  client_id: string; account_id: string; symbol: string;
  action: "open" | "close" | "risk" | "entry" | "entry_edit" | "entry_cancel" | "entry_risk";
  side?: "Buy" | "Sell"; amount?: number; trade_id?: string; order_id?: string;
  stop?: number | null; limit?: number | null; kind?: "stop" | "limit"; rate?: number | null;
};
export type BrokerResult = { client_id: string; status: "pending" | "unknown" | "confirmed" | "rejected"; message: string; order_id?: string; };
export type BrokerSnapshot = {
  type: "account"; connection: "Demo"; server_time: number;
  accounts: { id: string; name: string }[];
  account: { id: string; currency: string | null; balance: number; equity: number; used_margin: number; usable_margin: number; gross_pl: number; day_pl: number };
  instrument: { symbol: string; bid: number; ask: number; quote_time: number; digits: number; point_size: number;
    pip_cost: number | null; base_unit_size: number; min_quantity: number; max_quantity: number;
    stop_distance_points: number; limit_distance_points: number; trading_status: string; can_open: boolean; can_close: boolean;
    rollover_buy: number | null; rollover_sell: number | null; commission_buy: number | null; commission_sell: number | null; };
  positions: BrokerPosition[]; closed_positions: BrokerPosition[];
  orders: {order_id: string; trade_id: string; type: string; status: string; rate: number | null; amount: number;
    /** Pending entry order fields; stop/limit are its attached orders' rates. */
    side?: "Buy" | "Sell"; symbol?: string | null; entry?: boolean; stop?: number | null; limit?: number | null}[];
  unresolved: BrokerResult[];
};

export type BrokerHistoryResponse = {
  type: "history";
  account: { id: string; currency: string | null };
  server_time: number | null;
  from: number | null;
  to: number | null;
  items: BrokerPosition[];
};

export function brokerChartTrades(snapshot: BrokerSnapshot, candles: readonly {time: number}[] = []): TradePosition[] {
  const candleTime = (time: number | null) => {
    if (time == null) return undefined;
    let left = 0, right = candles.length;
    while (left < right) { const mid = (left + right) >>> 1; if (candles[mid].time <= time) left = mid + 1; else right = mid; }
    return left > 0 ? candles[left - 1].time : undefined;
  };
  const map = (position: BrokerPosition, closed: boolean): TradePosition => ({
    id: closed ? `fxcm:${position.trade_id}:${position.close_order_id}:${position.close_time}:${position.amount}` : position.trade_id,
    brokerTradeId: position.trade_id, brokerNetPnl: position.net_pl,
    brokerCommission: position.commission, brokerRollover: position.rollover, brokerCurrency: snapshot.account.currency,
    chartEntryTime: candleTime(position.open_time), chartCloseTime: closed ? candleTime(position.close_time) : undefined,
    type: position.side, units: position.amount, entry: position.open_rate,
    entryTime: position.open_time, sl: position.stop, tp: position.limit,
    status: closed ? "Closed" : "Open", pnl: position.net_pl ?? 0,
    closeTime: closed ? position.close_time ?? undefined : undefined,
    closePrice: closed ? position.close_rate ?? undefined : undefined,
    reason: closed ? "FXCM" : undefined,
  });
  return [...snapshot.positions.filter(p => p.symbol === snapshot.instrument.symbol).map(p => map(p, false)),
    ...snapshot.closed_positions.filter(p => p.symbol === snapshot.instrument.symbol).map(p => map(p, true))];
}

/** Convert broker history rows to the existing chart/record row shape. */
export function brokerHistoryTrades(
  snapshot: BrokerSnapshot,
  history: BrokerHistoryResponse | null,
  candles: readonly {time: number}[] = [],
): TradePosition[] {
  if (!history || history.account.id !== snapshot.account.id) {
    // While the account-day query is in flight, keep current open positions
    // visible without briefly showing an unfiltered/stale closed-trade table.
    return brokerChartTrades({ ...snapshot, closed_positions: [] }, candles);
  }
  return brokerChartTrades(
    { ...snapshot, closed_positions: history.items },
    candles,
  );
}

export const brokerMoney = (value: number | null | undefined, currency?: string | null) =>
  value == null ? "—" : `${value.toFixed(2)} ${currency || "账户币种"}`;

/**
 * Gross P/L, in account currency, if `position` were closed at `rate`
 * (commission and rollover excluded). Null when FXCM gives no usable pip
 * cost or the position is not on the instrument the snapshot quotes.
 */
export function brokerExpectedPl(position: BrokerPosition, rate: number, instrument: BrokerSnapshot["instrument"]): number | null {
  if (!Number.isFinite(rate) || rate <= 0 || position.symbol !== instrument.symbol) return null;
  const cashPerPrice = (instrument.pip_cost ?? 0) * position.amount / instrument.base_unit_size / instrument.point_size;
  if (!(cashPerPrice > 0)) return null;
  const direction = position.side === "Buy" ? 1 : -1;
  return (rate - position.open_rate) * direction * cashPerPrice;
}

/** `entryRate`: a pending order's own price; omitted for market orders (bid/ask). */
export function brokerRiskPrice(value: string, mode: "price" | "distance" | "amount", side: "Buy" | "Sell",
  kind: "stop" | "limit", quantity: number, instrument: BrokerSnapshot["instrument"], entryRate?: number): number | null {
  if (!value.trim()) return null;
  const input = Number(value);
  if (!Number.isFinite(input) || input <= 0) throw new Error("止损/止盈必须为有效正数，留空表示不设置");
  if (mode === "price") return input;
  const cashPerPrice = (instrument.pip_cost ?? 0) * quantity / instrument.base_unit_size / instrument.point_size;
  if (mode === "amount" && !(cashPerPrice > 0)) throw new Error("福汇未提供有效点值，请改用价格或价差");
  const distance = mode === "amount" ? input / cashPerPrice : input;
  const entry = entryRate ?? (side === "Buy" ? instrument.ask : instrument.bid);
  const direction = (side === "Buy" ? 1 : -1) * (kind === "limit" ? 1 : -1);
  return Number((entry + direction * distance).toFixed(instrument.digits));
}
