import type { CandlestickData, Time } from "lightweight-charts";

export const AUTOMATIC_PENS_COLOR = "#ffff00";
export const AUTOMATIC_PENS_MIN_CANDLE_COUNT = 5;
export const AUTOMATIC_PENS_MAX_VISIBLE = 200;
export type AutomaticPenMode = "simple" | "strict";
export const STRICT_PENS_RULES = { atrPeriod: 14, backgroundAtrPeriod: 100, minMoveAtrMultiple: 1, timeOnlyMinCandleCount: 15 } as const;
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
> & Partial<Pick<CandlestickData<Time>, "high" | "low">>;

/**
 * Body extrema define endpoints. A new leg needs at least minCandleCount
 * candles between its endpoints, inclusive. Reversal candidates come only
 * from candles AFTER the current endpoint, never its own opposite body edge.
 * The final pen remains developing until a qualifying reversal appears.
 */
export function createAutomaticPenGenerator(
  minCandleCount = AUTOMATIC_PENS_MIN_CANDLE_COUNT,
  retainedPens = Number.POSITIVE_INFINITY,
  mode: AutomaticPenMode = "simple",
) {
  // A fixed-size TR ring keeps strict pens O(1) per candle, even in million-bar runs.
  const ranges = new Float64Array(STRICT_PENS_RULES.backgroundAtrPeriod);
  let rangeCount = 0, shortSum = 0, backgroundSum = 0;
  let previousClose: number | null = null;
  const updateMinimumMove = (candle: AutomaticPenCandle) => {
    if (mode !== "strict") return 0;
    const high = candle.high ?? Math.max(candle.open, candle.close);
    const low = candle.low ?? Math.min(candle.open, candle.close);
    const previous = previousClose ?? candle.open;
    const tr = Math.max(high - low, Math.abs(high - previous), Math.abs(low - previous));
    const { atrPeriod, backgroundAtrPeriod, minMoveAtrMultiple } = STRICT_PENS_RULES;
    if (rangeCount >= atrPeriod) shortSum -= ranges[(rangeCount - atrPeriod) % backgroundAtrPeriod];
    if (rangeCount >= backgroundAtrPeriod) backgroundSum -= ranges[rangeCount % backgroundAtrPeriod];
    ranges[rangeCount % backgroundAtrPeriod] = tr;
    shortSum += tr;
    backgroundSum += tr;
    rangeCount++;
    previousClose = candle.close;
    return minMoveAtrMultiple * Math.max(0, shortSum / Math.min(rangeCount, atrPeriod), backgroundSum / Math.min(rangeCount, backgroundAtrPeriod));
  };
  const qualifies = (start: AutomaticPenPoint, end: AutomaticPenPoint, minimumMove: number) => {
    const span = end.index - start.index + 1;
    return span >= minCandleCount && (mode === "simple" ||
      span >= STRICT_PENS_RULES.timeOnlyMinCandleCount || Math.abs(end.price - start.price) >= minimumMove);
  };

  let index = -1;
  let high: AutomaticPenPoint;
  let low: AutomaticPenPoint;
  let highMinimumMove = 0, lowMinimumMove = 0, endpointMinimumMove = 0;
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
    const minimumMove = updateMinimumMove(candle);
    index++;
    const currentHigh = { index, time: candle.time, price: Math.max(candle.open, candle.close) };
    const currentLow = { index, time: candle.time, price: Math.min(candle.open, candle.close) };
    if (index === 0) {
      high = currentHigh;
      low = currentLow;
      highMinimumMove = lowMinimumMove = minimumMove;
      return;
    }

    if (!active) {
      // Preserve the initial high-before-low discovery order of the legacy rule.
      if (currentHigh.price > high.price) {
        high = currentHigh;
        highMinimumMove = minimumMove;
        if (qualifies(low, high, lowMinimumMove)) {
          active = { startPoint: low, endPoint: high, trend: AutomaticPenTrend.Up };
          endpointMinimumMove = minimumMove;
          addPen(active);
          return;
        }
      }
      if (currentLow.price < low.price) {
        low = currentLow;
        lowMinimumMove = minimumMove;
        if (qualifies(high, low, highMinimumMove)) {
          active = { startPoint: high, endPoint: low, trend: AutomaticPenTrend.Down };
          endpointMinimumMove = minimumMove;
          addPen(active);
        }
      }
      return;
    }

    const isUp: boolean = active.trend === AutomaticPenTrend.Up;
    const trendExtreme: AutomaticPenPoint = isUp ? currentHigh : currentLow;
    if (active.trend * (trendExtreme.price - active.endPoint.price) > 0) {
      active = { ...active, endPoint: trendExtreme };
      endpointMinimumMove = minimumMove;
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
      qualifies(active.endPoint, candidate, endpointMinimumMove)
    ) {
      active = {
        startPoint: active.endPoint,
        endPoint: candidate,
        trend: isUp ? AutomaticPenTrend.Down : AutomaticPenTrend.Up,
      };
      addPen(active);
      endpointMinimumMove = minimumMove;
      reversalExtreme = null;
    }
  };

  // Keep confirmed geometry for historical panning, without chart objects or
  // rescanning it on append. Previously returned pen objects are never mutated.
  return { append, warmup: updateMinimumMove, get pens(): readonly AutomaticPen[] { return pens; }, get totalPens() { return totalPens; } };
}

export function generateAutomaticPens(
  candlestickData: readonly AutomaticPenCandle[],
  minCandleCount = AUTOMATIC_PENS_MIN_CANDLE_COUNT,
  mode: AutomaticPenMode = "simple",
): AutomaticPen[] {
  const generator = createAutomaticPenGenerator(minCandleCount, undefined, mode);
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
