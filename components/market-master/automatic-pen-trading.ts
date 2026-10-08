import {
  AutomaticPenTrend,
  createAutomaticPenGenerator,
  type AutomaticPen,
  type AutomaticPenCandle,
  type AutomaticPenPoint,
  type AutomaticPenMode,
} from "./automatic-pens";

export type AutomaticTradingCandle = AutomaticPenCandle & { high?: number; low?: number };
export type AutomaticPenEvent = {
  pen: AutomaticPen;
  previousPen: AutomaticPen | null;
  side: "Buy" | "Sell" | null;
  trendOrigin: AutomaticPenPoint | null;
  breakoutPoint: AutomaticPenPoint | null;
  atr: number | null;
};

/** Evaluate only when the last pen has just been created, not when it extends. */
export function getAutomaticPenTradeSide(pens: readonly AutomaticPen[]): "Buy" | "Sell" | null {
  const index = pens.length - 1;
  if (index < 5) return null;
  const current = pens[index];
  const firstIndex = index - 5;
  const trendStart = pens[firstIndex].startPoint.price;
  // The six-pen structure must start at its directional extreme. A higher
  // high inside a short setup (lower low inside a long setup) starts a new
  // trend: do not borrow pivots from before it to enter on only its fourth pen.
  for (let penIndex = firstIndex; penIndex <= index; penIndex++) {
    if (current.trend * (pens[penIndex].endPoint.price - trendStart) > 0) return null;
  }
  const secondTrendEnd = pens[index - 3].endPoint.price;
  const thirdTrendEnd = pens[index - 1].endPoint.price;
  // The five confirmed setup pens must continue the trend: the third down
  // pen ends below the second (third up pen above the second for a long).
  if (current.trend * (thirdTrendEnd - secondTrendEnd) >= 0) return null;
  const older = pens[index - 5].endPoint.price;
  const recent = pens[index - 2].endPoint.price;
  // The newly formed pullback must still respect the original breakout level.
  // Use the pen's body endpoint (not wicks or a later recovered close).
  if (current.trend === AutomaticPenTrend.Down && recent > older && current.endPoint.price >= older) return "Buy";
  if (current.trend === AutomaticPenTrend.Up && recent < older && current.endPoint.price <= older) return "Sell";
  return null;
}

export function createAutomaticPenTradeTracker(candles: readonly AutomaticTradingCandle[], mode: AutomaticPenMode = "simple", atrWarmup: readonly AutomaticTradingCandle[] = []) {
  const generator = createAutomaticPenGenerator(undefined, 6, mode);
  atrWarmup.forEach(generator.warmup);
  let count = 0;
  let trSum = 0;
  let previousClose: number | null = null;
  let atr: number | null = null;
  const append = (candle: AutomaticTradingCandle) => {
    const high = candle.high ?? Math.max(candle.open, candle.close);
    const low = candle.low ?? Math.min(candle.open, candle.close);
    const tr = Math.max(high - low, previousClose === null ? 0 : Math.abs(high - previousClose), previousClose === null ? 0 : Math.abs(low - previousClose));
    count++;
    if (count <= 14) trSum += tr;
    if (count === 14) atr = trSum / 14;
    else if (atr !== null) atr = (atr * 13 + tr) / 14;
    previousClose = candle.close;
    generator.append(candle);
  };
  // Warm up using already revealed candles. Enabling never backfills trades.
  candles.forEach(append);
  let lastTime = candles[candles.length - 1]?.time;
  const advanceEvent = (candle: AutomaticTradingCandle): AutomaticPenEvent | null => {
    if (lastTime !== undefined && candle.time <= lastTime) return null;
    const previousCount = generator.totalPens;
    append(candle);
    lastTime = candle.time;
    if (generator.totalPens === previousCount) return null;
    const index = generator.pens.length - 1;
    return {
      pen: generator.pens[index],
      previousPen: index > 0 ? generator.pens[index - 1] : null,
      side: getAutomaticPenTradeSide(generator.pens),
      trendOrigin: index >= 5 ? generator.pens[index - 5].startPoint : null,
      breakoutPoint: index >= 5 ? generator.pens[index - 5].endPoint : null,
      atr,
    };
  };
  return {
    advanceEvent,
    advance: (candle: AutomaticTradingCandle) => advanceEvent(candle)?.side ?? null,
  };
}
