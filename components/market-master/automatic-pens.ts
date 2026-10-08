import type { CandlestickData, Time } from "lightweight-charts";

export const AUTOMATIC_PENS_COLOR = "#ffff00";
export const AUTOMATIC_PENS_MIN_CANDLE_COUNT = 5;
export const AUTOMATIC_PENS_MAX_VISIBLE = 200;
const AUTOMATIC_PENS_VIEWPORT_BUFFER = 20;

export enum AutomaticPenTrend {
  Up = 1,
  Down = -1,
}

export type AutomaticPenPoint = {
  index: number;
  time: Time;
  price: number;
};

export type AutomaticPen = {
  startPoint: AutomaticPenPoint;
  endPoint: AutomaticPenPoint;
  trend: AutomaticPenTrend;
};

export type AutomaticPenCandle = Pick<
  CandlestickData<Time>,
  "time" | "open" | "close"
>;

/**
 * Body extrema define endpoints. A new leg needs at least minCandleCount
 * candles between its endpoints, inclusive. Reversal candidates come only
 * from candles AFTER the current endpoint, never its own opposite body edge.
 * The final pen remains developing until a qualifying reversal appears.
 */
export function createAutomaticPenGenerator(
  minCandleCount = AUTOMATIC_PENS_MIN_CANDLE_COUNT,
  retainedPens = Number.POSITIVE_INFINITY,
) {
  const spansEnoughCandles = (start: AutomaticPenPoint, end: AutomaticPenPoint) =>
    end.index - start.index + 1 >= minCandleCount;

  let index = -1;
  let high: AutomaticPenPoint;
  let low: AutomaticPenPoint;
  let active: AutomaticPen | null = null;
  let reversalExtreme: AutomaticPenPoint | null = null;
  const pens: AutomaticPen[] = [];
  let totalPens = 0;
  const addPen = (pen: AutomaticPen) => {
    pens.push(pen);
    totalPens++;
    if (pens.length > retainedPens) pens.splice(0, pens.length - retainedPens);
  };

  const append = (candle: AutomaticPenCandle) => {
    index++;
    const currentHigh = { index, time: candle.time, price: Math.max(candle.open, candle.close) };
    const currentLow = { index, time: candle.time, price: Math.min(candle.open, candle.close) };
    if (index === 0) {
      high = currentHigh;
      low = currentLow;
      return;
    }

    if (!active) {
      // Preserve the initial high-before-low discovery order of the legacy rule.
      if (currentHigh.price > high.price) {
        high = currentHigh;
        if (spansEnoughCandles(low, high)) {
          active = { startPoint: low, endPoint: high, trend: AutomaticPenTrend.Up };
          addPen(active);
          return;
        }
      }
      if (currentLow.price < low.price) {
        low = currentLow;
        if (spansEnoughCandles(high, low)) {
          active = { startPoint: high, endPoint: low, trend: AutomaticPenTrend.Down };
          addPen(active);
        }
      }
      return;
    }

    const isUp: boolean = active.trend === AutomaticPenTrend.Up;
    const trendExtreme: AutomaticPenPoint = isUp ? currentHigh : currentLow;
    if (active.trend * (trendExtreme.price - active.endPoint.price) > 0) {
      active = { ...active, endPoint: trendExtreme };
      pens[pens.length - 1] = active;
      reversalExtreme = null;
      // A candle extending the trend cannot also seed a reversal from that
      // endpoint: OHLC does not establish the order of moves within the candle.
      return;
    }

    const candidate: AutomaticPenPoint = isUp ? currentLow : currentHigh;
    if (
      reversalExtreme &&
      active.trend * (reversalExtreme.price - candidate.price) <= 0
    ) return;
    reversalExtreme = candidate;

    if (
      active.trend * (active.endPoint.price - candidate.price) > 0 &&
      spansEnoughCandles(active.endPoint, candidate)
    ) {
      active = {
        startPoint: active.endPoint,
        endPoint: candidate,
        trend: isUp ? AutomaticPenTrend.Down : AutomaticPenTrend.Up,
      };
      addPen(active);
      reversalExtreme = null;
    }
  };

  // Keep confirmed geometry for historical panning, without chart objects or
  // rescanning it on append. Previously returned pen objects are never mutated.
  return { append, get pens(): readonly AutomaticPen[] { return pens; }, get totalPens() { return totalPens; } };
}

export function generateAutomaticPens(
  candlestickData: readonly AutomaticPenCandle[],
  minCandleCount = AUTOMATIC_PENS_MIN_CANDLE_COUNT
): AutomaticPen[] {
  const generator = createAutomaticPenGenerator(minCandleCount);
  candlestickData.forEach(generator.append);
  return [...generator.pens];
}

/** Binary-search history, then copy only a bounded, contiguous drawing window. */
export function selectAutomaticPensForViewport(
  pens: readonly AutomaticPen[],
  range: { from: Time; to: Time } | null
): readonly AutomaticPen[] {
  if (!range || pens.length === 0) return [];
  const lowerBound = (after: (pen: AutomaticPen) => boolean) => {
    let low = 0;
    let high = pens.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (after(pens[middle])) high = middle;
      else low = middle + 1;
    }
    return low;
  };
  const first = lowerBound((pen) => pen.endPoint.time >= range.from);
  const end = lowerBound((pen) => pen.startPoint.time > range.to);
  // Include crossing lines and a small buffer for smooth scrolling. When an
  // overview contains more than the cap, prefer its most recent pens.
  const to = Math.min(pens.length, end + AUTOMATIC_PENS_VIEWPORT_BUFFER);
  const from = Math.max(0, first - AUTOMATIC_PENS_VIEWPORT_BUFFER, to - AUTOMATIC_PENS_MAX_VISIBLE);
  return pens.slice(from, to);
}
