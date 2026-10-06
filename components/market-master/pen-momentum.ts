import type { CandlestickData, Time } from "lightweight-charts";
import { AutomaticPenTrend, generateAutomaticPens, type AutomaticPen } from "./automatic-pens";

export type PenMomentumConfig = {
  enabled: boolean;
  atrPeriod: number;
  weakThreshold: number;
  includeDeveloping: boolean;
};

export type PenMomentumPair = {
  id: string;
  trend: AutomaticPenTrend;
  previous: AutomaticPen;
  current: AutomaticPen;
  previousIndex: number;
  currentIndex: number;
  interveningPens: number;
  advance: number;
  referenceAtr: number | null;
  score: number | null;
  weak: boolean | null;
  developing: boolean;
};

export type PenMomentumSnapshot = {
  up: PenMomentumPair | null;
  down: PenMomentumPair | null;
  penCount: number;
  asOf: Time | null;
};

/** Most recent qualifying predecessor, even across intervening broken structures. */
export function findPreviousMatchingPen(pens: readonly AutomaticPen[], currentIndex: number): number | null {
  const current = pens[currentIndex];
  if (!current) return null;
  for (let index = currentIndex - 1; index >= 0; index--) {
    const previous = pens[index];
    if (previous.trend !== current.trend) continue;
    if (
      current.trend * (current.startPoint.price - previous.startPoint.price) > 0 &&
      current.trend * (current.endPoint.price - previous.endPoint.price) > 0
    ) return index;
  }
  return null;
}

function calculateAtr(candles: readonly CandlestickData<Time>[], period: number): Array<number | null> {
  const ranges: number[] = [];
  let sum = 0;
  return candles.map((candle, index) => {
    const previousClose = candles[index - 1]?.close ?? candle.open;
    const range = Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
    ranges.push(range);
    sum += range;
    if (index >= period) sum -= ranges[index - period];
    return index + 1 >= period ? Math.max(0, sum / period) : null;
  });
}

/** Only analyze revealed candles. Each direction compares its latest eligible pen. */
export function calculatePenMomentum(
  candles: readonly CandlestickData<Time>[],
  config: PenMomentumConfig,
  pens: readonly AutomaticPen[] = generateAutomaticPens(candles)
): PenMomentumSnapshot {
  if (!Number.isInteger(config.atrPeriod) || config.atrPeriod < 1 || !Number.isFinite(config.weakThreshold) || config.weakThreshold <= 0) {
    throw new RangeError("Invalid pen momentum parameters");
  }
  const atr = calculateAtr(candles, config.atrPeriod);
  const pairFor = (trend: AutomaticPenTrend): PenMomentumPair | null => {
    const lastIndex = pens.length - (config.includeDeveloping ? 1 : 2);
    for (let currentIndex = lastIndex; currentIndex >= 0; currentIndex--) {
      const current = pens[currentIndex];
      if (current.trend !== trend) continue;
      const previousIndex = findPreviousMatchingPen(pens, currentIndex);
      // Do not fall back to an older signal when the latest pen cannot pair.
      if (previousIndex === null) return null;
      const previous = pens[previousIndex];
      const advance = trend * (current.endPoint.price - previous.endPoint.price);
      // Freeze at the previous endpoint: extending the current pen cannot inflate
      // its own denominator. No future candles contribute to historical ATR.
      const referenceAtr = atr[previous.endPoint.index] ?? null;
      const score = referenceAtr !== null && referenceAtr > 0 ? advance / referenceAtr : null;
      return {
        id: `${trend}:${String(previous.startPoint.time)}:${String(current.startPoint.time)}`,
        trend, previous, current, previousIndex, currentIndex,
        interveningPens: currentIndex - previousIndex - 1,
        advance, referenceAtr, score,
        weak: score === null ? null : score < config.weakThreshold,
        developing: currentIndex === pens.length - 1,
      };
    }
    return null;
  };
  return { up: pairFor(AutomaticPenTrend.Up), down: pairFor(AutomaticPenTrend.Down), penCount: pens.length, asOf: candles[candles.length - 1]?.time ?? null };
}
