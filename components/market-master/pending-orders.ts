/**
 * Pending (limit / stop entry) orders. The kind follows from where the price
 * sits against the market: buying below it waits for a pullback (limit),
 * buying above it waits for a breakout (stop); selling is mirrored.
 */
export type PendingOrderSide = "Buy" | "Sell";
export type PendingOrderKind = "limit" | "stop";

export type PendingOrder = {
  id: string;
  type: PendingOrderSide;
  kind: PendingOrderKind;
  price: number;
  units: number;
  sl: number | null;
  tp: number | null;
  /** Time of the bar on which the order was placed (backtest). */
  createdTime?: number;
  /** FXCM entry order ID (realtime). */
  brokerOrderId?: string;
};

type Candle = { time: number; open: number; high: number; low: number; close: number };

export const pendingOrderKind = (side: PendingOrderSide, price: number, market: number): PendingOrderKind =>
  (side === "Buy" ? price <= market : price >= market) ? "limit" : "stop";

export const pendingOrderLabel = (order: Pick<PendingOrder, "type" | "kind">) =>
  `${order.type} ${order.kind === "limit" ? "Limit" : "Stop"}`;

export const pendingOrderLabelZh = (order: Pick<PendingOrder, "type" | "kind">) =>
  `${order.type === "Buy" ? "买入" : "卖出"}${order.kind === "limit" ? "限价" : "止损"}挂单`;

/**
 * Fill of a pending order on the next candle, or null. A gap through the
 * price fills at the open: better than the price for a limit, worse for a
 * stop, which is how both behave against real quotes.
 */
export function resolvePendingFill(order: PendingOrder, candle: Candle): number | null {
  const buy = order.type === "Buy";
  // Limit buys and stop sells wait for the price to come down to them.
  const waitsBelow = buy === (order.kind === "limit");
  if (waitsBelow) {
    if (candle.low > order.price) return null;
    return Math.min(candle.open, order.price);
  }
  if (candle.high < order.price) return null;
  return Math.max(candle.open, order.price);
}

/** SL/TP of a pending order are measured from its own price, not the market. */
export function getPendingRiskError(
  side: PendingOrderSide,
  kind: "sl" | "tp",
  price: number | null,
  entryPrice: number
): string | null {
  if (price === null) return null;
  const label = kind === "sl" ? "止损" : "止盈";
  if (!Number.isFinite(price) || price <= 0) return `${label}价必须是大于 0 的有效价格`;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return "挂单价必须是大于 0 的有效价格";
  const mustBeBelow = (side === "Buy") === (kind === "sl");
  if (mustBeBelow ? price >= entryPrice : price <= entryPrice) {
    return `${label}价必须${mustBeBelow ? "低于" : "高于"}挂单价`;
  }
  return null;
}

export function getPendingOrderError(order: Pick<PendingOrder, "type" | "price" | "units" | "sl" | "tp">) {
  if (!Number.isFinite(order.price) || order.price <= 0) return "挂单价必须是大于 0 的有效价格";
  if (!Number.isSafeInteger(order.units) || order.units <= 0) return "交易数量必须为正整数";
  return getPendingRiskError(order.type, "sl", order.sl, order.price) ||
    getPendingRiskError(order.type, "tp", order.tp, order.price);
}

/** SL/TP from the terminal's distance settings, anchored to the pending price. */
export function pendingBracketsFromDistances(
  side: PendingOrderSide,
  price: number,
  sl: { enabled: boolean; distance: number },
  tp: { enabled: boolean; distance: number },
  priceDecimals: number
) {
  const round = (value: number) => Number(value.toFixed(priceDecimals));
  const direction = side === "Buy" ? 1 : -1;
  return {
    sl: sl.enabled && sl.distance > 0 ? round(price - direction * sl.distance) : null,
    tp: tp.enabled && tp.distance > 0 ? round(price + direction * tp.distance) : null,
  };
}

/** Broker entry rows (snapshot.orders) for one symbol, in chart order shape. */
export function brokerPendingOrders(
  orders: readonly {
    order_id: string; type: string; rate: number | null; amount: number;
    side?: "Buy" | "Sell"; symbol?: string | null; entry?: boolean; stop?: number | null; limit?: number | null;
  }[],
  symbol: string
): PendingOrder[] {
  return orders
    .filter((order) => order.entry && order.symbol === symbol && order.rate != null && order.side)
    .map((order) => ({
      id: order.order_id,
      brokerOrderId: order.order_id,
      type: order.side!,
      kind: order.type === "LE" || order.type === "LTE" ? "limit" : "stop",
      price: order.rate!,
      units: order.amount,
      sl: order.stop ?? null,
      tp: order.limit ?? null,
    }));
}
