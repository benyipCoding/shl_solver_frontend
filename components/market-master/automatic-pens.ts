import type { CandlestickData, Time } from "lightweight-charts";

export const AUTOMATIC_PENS_COLOR = "#ffff00";
export const AUTOMATIC_PENS_MIN_CANDLE_COUNT = 5;

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

type AutomaticPenCandle = Pick<
  CandlestickData<Time>,
  "time" | "open" | "close"
>;

/**
 * Body extrema define endpoints. A new leg needs at least minCandleCount
 * candles between its endpoints, inclusive. Reversal candidates come only
 * from candles AFTER the current endpoint, never its own opposite body edge.
 * The final pen remains developing until a qualifying reversal appears.
 */
export function generateAutomaticPens(
  candlestickData: readonly AutomaticPenCandle[],
  minCandleCount = AUTOMATIC_PENS_MIN_CANDLE_COUNT
): AutomaticPen[] {
  if (candlestickData.length < 2) return [];

  const point = (index: number, upper: boolean): AutomaticPenPoint => ({
    index,
    time: candlestickData[index].time,
    price: upper
      ? Math.max(candlestickData[index].open, candlestickData[index].close)
      : Math.min(candlestickData[index].open, candlestickData[index].close),
  });
  const spansEnoughCandles = (start: AutomaticPenPoint, end: AutomaticPenPoint) =>
    end.index - start.index + 1 >= minCandleCount;

  let high = point(0, true);
  let low = point(0, false);
  let active: AutomaticPen | null = null;
  let reversalExtreme: AutomaticPenPoint | null = null;
  const pens: AutomaticPen[] = [];

  for (let index = 1; index < candlestickData.length; index++) {
    const currentHigh = point(index, true);
    const currentLow = point(index, false);

    if (!active) {
      // Preserve the initial high-before-low discovery order of the legacy rule.
      if (currentHigh.price > high.price) {
        high = currentHigh;
        if (spansEnoughCandles(low, high)) {
          active = { startPoint: low, endPoint: high, trend: AutomaticPenTrend.Up };
          continue;
        }
      }
      if (currentLow.price < low.price) {
        low = currentLow;
        if (spansEnoughCandles(high, low)) {
          active = { startPoint: high, endPoint: low, trend: AutomaticPenTrend.Down };
        }
      }
      continue;
    }

    const isUp: boolean = active.trend === AutomaticPenTrend.Up;
    const trendExtreme: AutomaticPenPoint = isUp ? currentHigh : currentLow;
    if (active.trend * (trendExtreme.price - active.endPoint.price) > 0) {
      active.endPoint = trendExtreme;
      reversalExtreme = null;
      // A candle extending the trend cannot also seed a reversal from that
      // endpoint: OHLC does not establish the order of moves within the candle.
      continue;
    }

    const candidate: AutomaticPenPoint = isUp ? currentLow : currentHigh;
    if (
      reversalExtreme &&
      active.trend * (reversalExtreme.price - candidate.price) <= 0
    ) continue;
    reversalExtreme = candidate;

    if (
      active.trend * (active.endPoint.price - candidate.price) > 0 &&
      spansEnoughCandles(active.endPoint, candidate)
    ) {
      pens.push(active);
      active = {
        startPoint: active.endPoint,
        endPoint: candidate,
        trend: isUp ? AutomaticPenTrend.Down : AutomaticPenTrend.Up,
      };
      reversalExtreme = null;
    }
  }

  if (active) pens.push(active);
  return pens;
}
