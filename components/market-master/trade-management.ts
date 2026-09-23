export type TradePosition = {
  id: string | number;
  type: "Buy" | "Sell";
  entry: number;
  entryTime: number;
  units: number;
  sl: number | null;
  tp: number | null;
  status: "Open" | "Closed";
  pnl: number;
  closeTime?: number;
  closePrice?: number;
  reason?: string;
  parentTradeId?: string | number;
  closeCount?: number;
  visibleOnChart?: boolean;
};

export const calculateTradePnl = (
  trade: Pick<TradePosition, "type" | "entry" | "units">,
  price: number,
  units = trade.units,
) => (trade.type === "Buy" ? price - trade.entry : trade.entry - price) * units;

export type TradeRiskInputMode = "price" | "points" | "amount";
export type TradeRiskKind = "sl" | "tp";
type RiskPosition = Pick<TradePosition, "type" | "entry" | "units">;

const riskDirection = (side: TradePosition["type"], kind: TradeRiskKind) =>
  (side === "Buy" ? 1 : -1) * (kind === "tp" ? 1 : -1);

/** Default spacing follows the instrument, anchored to the current market. */
export const suggestTradeRiskPrice = (
  side: TradePosition["type"],
  kind: TradeRiskKind,
  currentPrice: number,
  defaultDistance: number,
  priceDecimals: number,
) => {
  const tick = 10 ** -priceDecimals;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return NaN;
  const distance = Math.max(
    tick,
    Math.min(
      Number.isFinite(defaultDistance) && defaultDistance > 0
        ? defaultDistance
        : currentPrice * (kind === "sl" ? 0.01 : 0.02),
      currentPrice / 2,
    ),
  );
  const price = currentPrice + riskDirection(side, kind) * distance;
  return Number(Math.max(tick, price).toFixed(priceDecimals));
};

/** Positive SL values mean loss; positive TP values mean profit, from entry. */
export const tradeRiskInputToPrice = (
  trade: RiskPosition,
  kind: TradeRiskKind,
  input: string,
  mode: TradeRiskInputMode,
  priceDecimals: number,
) => {
  if (input.trim() === "" || !Number.isFinite(Number(input))) return NaN;
  const value = Number(input);
  if (mode === "amount" && trade.units <= 0) return NaN;
  const distance = mode === "amount" ? value / trade.units : value;
  const price =
    mode === "price"
      ? value
      : trade.entry + riskDirection(trade.type, kind) * distance;
  return Number(price.toFixed(priceDecimals));
};

export const formatTradeRiskInput = (
  trade: RiskPosition,
  kind: TradeRiskKind,
  price: number,
  mode: TradeRiskInputMode,
  priceDecimals: number,
) => {
  if (!Number.isFinite(price)) return "";
  if (mode === "price") return price.toFixed(priceDecimals);
  const points = (price - trade.entry) * riskDirection(trade.type, kind);
  const value = mode === "amount" ? points * trade.units : points;
  // Keep enough precision for small FX positions; $0.001 must not become $0.
  return String(Number(value.toFixed(Math.max(priceDecimals, 2))));
};

export const closeTradeRecord = <T extends TradePosition>(
  trade: T,
  closePrice: number,
  reason: string,
  closeTime: number,
) => ({
  ...trade,
  status: "Closed" as const,
  closePrice,
  pnl: calculateTradePnl(trade, closePrice),
  reason,
  closeTime,
});

/** Keep the original position ID for the remainder; each fill has its own marker. */
export const closeTradeUnits = <T extends TradePosition>(
  trade: T,
  units: number,
  closePrice: number,
  closeTime: number,
  reason = "Market Close",
) => {
  if (
    trade.status !== "Open" ||
    !Number.isInteger(units) ||
    units <= 0 ||
    units > trade.units
  ) {
    throw new Error("平仓数量必须为 1 到剩余持仓数量之间的整数");
  }
  const closeCount = (trade.closeCount ?? 0) + 1;
  const isPartial = units < trade.units;
  const closed = closeTradeRecord(
    {
      ...trade,
      id: isPartial ? `${trade.id}:close:${closeCount}` : trade.id,
      parentTradeId: trade.parentTradeId ?? trade.id,
      units,
      closeCount,
    },
    closePrice,
    reason,
    closeTime,
  );
  const remaining = isPartial
    ? { ...trade, units: trade.units - units, closeCount }
    : null;
  return { closed, remaining };
};

export const getRiskPriceError = (
  side: TradePosition["type"],
  kind: "sl" | "tp",
  price: number | null,
  currentPrice: number,
): string | null => {
  if (price === null) return null;
  const label = kind === "sl" ? "止损" : "止盈";
  if (!Number.isFinite(price) || price <= 0)
    return `${label}价必须是大于 0 的有效价格`;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0)
    return "暂无有效市价";
  const mustBeBelow = (side === "Buy") === (kind === "sl");
  if (mustBeBelow ? price >= currentPrice : price <= currentPrice) {
    return `${label}价必须${mustBeBelow ? "低于" : "高于"}当前市价`;
  }
  return null;
};
