import type { CandlestickData, Time } from "lightweight-charts";

export const AUTOMATIC_PENS_COLOR = "#ffff00";
export const AUTOMATIC_PENS_MIN_CANDLE_COUNT = 5;
export const AUTOMATIC_PENS_RULES = {
  atrPeriod: 14,
  backgroundAtrPeriod: 100,
  minMoveAtrMultiple: 2,
} as const;

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
  "time" | "open" | "close" | "high" | "low"
>;

type AutomaticPenOptions = {
  /** Earlier candles warm up ATR but cannot become pen endpoints. */
  startIndex?: number;
  minMoveAtrMultiple?: number;
};

function calculateMinimumMoves(
  candles: readonly AutomaticPenCandle[],
  multiple: number
): number[] {
  const ranges: number[] = [];
  let shortSum = 0;
  let backgroundSum = 0;
  return candles.map((candle, index) => {
    const previousClose = index > 0 ? candles[index - 1].close : candle.open;
    const range = Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
    ranges.push(range);
    shortSum += range;
    backgroundSum += range;
    const { atrPeriod, backgroundAtrPeriod } = AUTOMATIC_PENS_RULES;
    if (index >= atrPeriod) shortSum -= ranges[index - atrPeriod];
    if (index >= backgroundAtrPeriod) {
      backgroundSum -= ranges[index - backgroundAtrPeriod];
    }
    return multiple * Math.max(
      0,
      shortSum / Math.min(index + 1, atrPeriod),
      backgroundSum / Math.min(index + 1, backgroundAtrPeriod)
    );
  });
}

/**
 * Body extrema define endpoints; wick/gap true ranges define normal volatility.
 * Each new leg must pass both the inclusive candle span and the price threshold
 * sampled at its starting extreme. Waiting alone cannot lower that threshold.
 * The final pen is still developing; earlier pens are confirmed by a reversal.
 */
export function generateAutomaticPens(
  candlestickData: readonly AutomaticPenCandle[],
  minCandleCount = AUTOMATIC_PENS_MIN_CANDLE_COUNT,
  {
    startIndex = 0,
    minMoveAtrMultiple = AUTOMATIC_PENS_RULES.minMoveAtrMultiple,
  }: AutomaticPenOptions = {}
): AutomaticPen[] {
  if (!Number.isInteger(minCandleCount) || minCandleCount < 2) {
    throw new RangeError("minCandleCount must be an integer of at least 2");
  }
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new RangeError("startIndex must be a nonnegative integer");
  }
  if (!Number.isFinite(minMoveAtrMultiple) || minMoveAtrMultiple < 0) {
    throw new RangeError("minMoveAtrMultiple must be finite and nonnegative");
  }
  if (candlestickData.length - startIndex < 2) return [];

  const minimumMoves = calculateMinimumMoves(candlestickData, minMoveAtrMultiple);
  const point = (index: number, high: boolean): AutomaticPenPoint => ({
    index,
    time: candlestickData[index].time,
    price: high
      ? Math.max(candlestickData[index].open, candlestickData[index].close)
      : Math.min(candlestickData[index].open, candlestickData[index].close),
  });
  const qualifies = (start: AutomaticPenPoint, end: AutomaticPenPoint) =>
    end.index - start.index + 1 >= minCandleCount &&
    Math.abs(end.price - start.price) > 0 &&
    Math.abs(end.price - start.price) >= minimumMoves[start.index];

  let high = point(startIndex, true);
  let low = point(startIndex, false);
  let active: AutomaticPen | null = null;
  const pens: AutomaticPen[] = [];

  for (let index = startIndex + 1; index < candlestickData.length; index++) {
    const currentHigh = point(index, true);
    const currentLow = point(index, false);

    if (!active) {
      const newHigh = currentHigh.price > high.price;
      const newLow = currentLow.price < low.price;
      if (newHigh) high = currentHigh;
      if (newLow) low = currentLow;
      if (newHigh && qualifies(low, high)) {
        active = { startPoint: low, endPoint: high, trend: AutomaticPenTrend.Up };
        low = currentLow;
      } else if (newLow && qualifies(high, low)) {
        active = { startPoint: high, endPoint: low, trend: AutomaticPenTrend.Down };
        high = currentHigh;
      }
      continue;
    }

    if (active.trend === AutomaticPenTrend.Up) {
      if (currentHigh.price > active.endPoint.price) {
        active.endPoint = currentHigh;
        low = currentLow;
      } else if (currentLow.price < low.price) {
        low = currentLow;
        if (qualifies(active.endPoint, low)) {
          pens.push(active);
          active = {
            startPoint: active.endPoint,
            endPoint: low,
            trend: AutomaticPenTrend.Down,
          };
          high = currentHigh;
        }
      }
    } else {
      if (currentLow.price < active.endPoint.price) {
        active.endPoint = currentLow;
        high = currentHigh;
      } else if (currentHigh.price > high.price) {
        high = currentHigh;
        if (qualifies(active.endPoint, high)) {
          pens.push(active);
          active = {
            startPoint: active.endPoint,
            endPoint: high,
            trend: AutomaticPenTrend.Up,
          };
          low = currentLow;
        }
      }
    }
  }

  if (active) pens.push(active);
  return pens;
}
