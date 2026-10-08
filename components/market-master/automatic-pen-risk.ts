import { AutomaticPenTrend } from "./automatic-pens";
import type { AutomaticPenEvent } from "./automatic-pen-trading";
import { calculateTradePnl, type TradePosition } from "./trade-management";
import { DEFAULT_AUTOMATIC_TRADING_CONFIG, type AutomaticTradingConfig } from "./automatic-trading-config";

export const AUTOMATIC_STOP_ATR_MULTIPLIER = 0.2;
export const AUTOMATIC_TAKE_PROFIT_R = 10;
export const AUTOMATIC_ADD_RISK_FRACTION = 0.5;
export const AUTOMATIC_PEN_FAILURE_REASON = "分笔突破失效";
export const AUTOMATIC_PEN_SHORT_EXIT_REASON = "分笔短线减仓";

const direction = (side: TradePosition["type"]) => side === "Buy" ? 1 : -1;
const roundOutward = (price: number, decimals: number, up: boolean) => {
  const scale = 10 ** decimals;
  return (up ? Math.ceil(price * scale) : Math.floor(price * scale)) / scale;
};

export const automaticStopBuffer = (atr: number | null, decimals: number, settings = DEFAULT_AUTOMATIC_TRADING_CONFIG) =>
  Math.max((atr ?? 0) * settings.stopAtrMultiplier, settings.minStopTicks * 10 ** -decimals);

export const automaticStopAtPivot = (side: TradePosition["type"], pivot: number, atr: number | null, decimals: number, settings = DEFAULT_AUTOMATIC_TRADING_CONFIG) =>
  roundOutward(pivot - direction(side) * automaticStopBuffer(atr, decimals, settings), decimals, side === "Sell");

/** Estimated profit at the current stop, using remaining units, not mark-to-market P&L. */
export function automaticLockedProfit(trade: TradePosition): number {
  if (!trade.automaticPen || trade.status !== "Open" || trade.sl === null) return 0;
  const profit = calculateTradePnl(trade, trade.sl);
  return Number.isFinite(profit) ? Math.max(0, profit) : 0;
}

export type AutomaticOrderPlan = {
  units: number;
  sl: number;
  tp: number;
  automaticPen: NonNullable<TradePosition["automaticPen"]>;
};

export function planAutomaticPenOrder(
  event: AutomaticPenEvent,
  entry: number,
  terminalUnits: number,
  trades: readonly TradePosition[],
  decimals: number,
  settings?: AutomaticTradingConfig,
  balance = 0,
): AutomaticOrderPlan | null {
  if (!event.side || !event.trendOrigin || !Number.isFinite(entry) || entry <= 0) return null;
  const side = event.side;
  const config = settings ?? { ...DEFAULT_AUTOMATIC_TRADING_CONFIG, firstOrderUnits: terminalUnits };
  const sl = automaticStopAtPivot(side, event.trendOrigin.price, event.atr, decimals, config);
  const risk = direction(side) * (entry - sl);
  if (!Number.isFinite(sl) || sl <= 0 || !Number.isFinite(risk) || risk <= 0) return null;
  let latest: TradePosition | null = null;
  for (const trade of trades) {
    if (trade.status === "Open" && trade.automaticPen && trade.type === side && (!latest || trade.entryTime > latest.entryTime)) latest = trade;
  }
  let units = config.firstOrderUnits;
  let budget: number | undefined;
  if (latest) {
    if (latest.automaticPen?.fundedChildId) return null;
    budget = automaticLockedProfit(latest) * config.addRiskPercent / 100;
  } else if (config.firstOrderMode !== "units") {
    budget = config.firstOrderMode === "amount" ? config.firstOrderRiskAmount : balance * config.firstOrderRiskPercent / 100;
  }
  if (budget !== undefined) {
    if (!Number.isFinite(budget) || budget <= 0) return null;
    units = Math.floor(budget / risk);
    // Guard the dollar cap against floating-point rounding at an integer boundary.
    if (units * risk > budget) units--;
  }
  if (!Number.isSafeInteger(units) || units < 1) return null;
  const tick = 10 ** -decimals;
  const tp = Math.max(tick, roundOutward(entry + direction(side) * risk * config.takeProfitR, decimals, side === "Buy"));
  if (!Number.isFinite(tp) || direction(side) * (tp - entry) <= 0) return null;
  return { units, sl, tp, automaticPen: {
    initialStop: sl,
    initialRisk: risk,
    stopAtrMultiplier: config.stopAtrMultiplier,
    minStopTicks: config.minStopTicks,
    shortExitPercent: config.shortExitEnabled ? config.shortExitPercent : 0,
    ...(budget !== undefined ? { riskBudget: budget } : {}),
    ...(event.breakoutPoint && typeof event.pen.startPoint.time === "number" ? {
      entryPenStartTime: event.pen.startPoint.time,
      breakoutPrice: event.breakoutPoint.price,
    } : {}),
    ...(latest ? { fundedBy: String(latest.id) } : {}),
  } };
}

/** Check only the seventh pen belonging to this order's original setup. */
function isOrderSeventhPen(trade: TradePosition, event: AutomaticPenEvent): boolean {
  const setup = trade.automaticPen;
  const sixth = event.previousPen;
  if (trade.status !== "Open" || !setup || !sixth || setup.entryPenStartTime === undefined) return false;
  const trend = direction(trade.type);
  return sixth.startPoint.time === setup.entryPenStartTime && sixth.trend === -trend && event.pen.trend === trend;
}

export function shouldExitAutomaticPenOnFailedBreakout(trade: TradePosition, event: AutomaticPenEvent): boolean {
  const breakoutPrice = trade.automaticPen?.breakoutPrice;
  if (!isOrderSeventhPen(trade, event) || breakoutPrice === undefined || !event.previousPen) return false;
  // Its final body extreme remembers every extension, even if price has already
  // recovered across the breakout level by the seventh pen's confirmation.
  return direction(trade.type) * (event.previousPen.endPoint.price - breakoutPrice) < 0;
}

/** Use the order's saved settings and remaining units; old orders are not opted in. */
export function automaticPenShortExitUnits(trade: TradePosition, event: AutomaticPenEvent): number {
  const percent = trade.automaticPen?.shortExitPercent;
  if (!isOrderSeventhPen(trade, event) || trade.automaticPen?.shortExitDone ||
      percent === undefined || !Number.isFinite(percent) || percent <= 0 || percent > 100) return 0;
  return Math.floor(trade.units * percent / 100);
}

/** New trend pen confirms the preceding pullback pivot. Only tighten survivors. */
export function trailAutomaticPenStops<T extends TradePosition>(
  trades: readonly T[], event: AutomaticPenEvent, currentPrice: number, decimals: number,
): { trades: T[]; changed: T[] } {
  const changed: T[] = [];
  const side = event.pen.trend === AutomaticPenTrend.Up ? "Buy" : "Sell";
  const pivot = event.pen.startPoint;
  // Trading timestamps are Unix seconds; non-intraday chart time types cannot
  // safely be compared with an order's entry timestamp.
  if (typeof pivot.time !== "number") return { trades: [...trades], changed };
  const pivotTime = pivot.time;
  const next = trades.map((trade) => {
    if (!trade.automaticPen || trade.status !== "Open" || trade.type !== side || pivotTime < trade.entryTime) return trade;
    const sl = automaticStopAtPivot(side, pivot.price, event.atr, decimals, {
      ...DEFAULT_AUTOMATIC_TRADING_CONFIG,
      stopAtrMultiplier: trade.automaticPen.stopAtrMultiplier ?? AUTOMATIC_STOP_ATR_MULTIPLIER,
      minStopTicks: trade.automaticPen.minStopTicks ?? 2,
    });
    if (!Number.isFinite(sl) || sl <= 0 || direction(side) * (currentPrice - sl) <= 0) return trade;
    if (trade.sl !== null && direction(side) * (sl - trade.sl) <= 0) return trade;
    const updated = { ...trade, sl };
    changed.push(updated);
    return updated;
  });
  return { trades: next, changed };
}

/** OHLC execution: gaps fill at open, then ambiguous intrabar touches favor SL. */
export function resolveAutomaticPenExit(trade: TradePosition, candle: { open: number; high: number; low: number }) {
  const buy = trade.type === "Buy";
  const { sl, tp } = trade;
  if (sl !== null && (buy ? candle.open <= sl : candle.open >= sl)) return { price: candle.open, reason: "SL Hit" };
  if (tp !== null && (buy ? candle.open >= tp : candle.open <= tp)) return { price: tp, reason: "TP Hit" };
  if (sl !== null && (buy ? candle.low <= sl : candle.high >= sl)) return { price: sl, reason: "SL Hit" };
  if (tp !== null && (buy ? candle.high >= tp : candle.low <= tp)) return { price: tp, reason: "TP Hit" };
  return null;
}
