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
 * Port of the legacy Pens algorithm. It deliberately uses candle bodies rather
 * than wick highs/lows and confirms a turn only after the extrema span at
 * least minCandleCount candles (inclusive).
 */
export function generateAutomaticPens(
  candlestickData: readonly AutomaticPenCandle[],
  minCandleCount = AUTOMATIC_PENS_MIN_CANDLE_COUNT
): AutomaticPen[] {
  if (candlestickData.length < 2) return [];

  const firstCandle = candlestickData[0];
  const high: AutomaticPenPoint = {
    index: 0,
    price: Math.max(firstCandle.open, firstCandle.close),
    time: firstCandle.time,
  };
  const low: AutomaticPenPoint = {
    index: 0,
    price: Math.min(firstCandle.open, firstCandle.close),
    time: firstCandle.time,
  };

  let currentTrend: AutomaticPenTrend | null = null;
  let startPoint: AutomaticPenPoint | null = null;
  let endPoint: AutomaticPenPoint | null = null;
  const pens: AutomaticPen[] = [];

  const updateOppositeExtreme = (
    newTrend: AutomaticPenTrend,
    currentHigh: number,
    currentLow: number,
    index: number,
    candle: AutomaticPenCandle
  ) => {
    if (newTrend === AutomaticPenTrend.Up) {
      low.index = index;
      low.price = currentLow;
      low.time = candle.time;
    }

    if (newTrend === AutomaticPenTrend.Down) {
      high.index = index;
      high.price = currentHigh;
      high.time = candle.time;
    }
  };

  const updateTrend = (
    newTrend: AutomaticPenTrend,
    currentHigh: number,
    currentLow: number,
    index: number,
    candle: AutomaticPenCandle
  ) => {
    let candleDistance = 0;

    if (currentTrend === newTrend) {
      candleDistance =
        newTrend === AutomaticPenTrend.Up
          ? Math.abs(high.index - (startPoint ? startPoint.index : low.index)) + 1
          : Math.abs((startPoint ? startPoint.index : high.index) - low.index) + 1;

      if (candleDistance >= minCandleCount) {
        endPoint =
          newTrend === AutomaticPenTrend.Up ? { ...high } : { ...low };
        updateOppositeExtreme(
          newTrend,
          currentHigh,
          currentLow,
          index,
          candle
        );
      }
      return;
    }

    candleDistance =
      newTrend === AutomaticPenTrend.Up
        ? Math.abs(high.index - (endPoint ? endPoint.index : low.index)) + 1
        : Math.abs((endPoint ? endPoint.index : high.index) - low.index) + 1;

    if (candleDistance < minCandleCount) return;

    if (startPoint && endPoint) {
      pens.push({
        startPoint,
        endPoint,
        trend: currentTrend ?? newTrend,
      });
    }

    currentTrend = newTrend;
    startPoint =
      newTrend === AutomaticPenTrend.Up ? { ...low } : { ...high };
    endPoint =
      newTrend === AutomaticPenTrend.Up ? { ...high } : { ...low };
    updateOppositeExtreme(newTrend, currentHigh, currentLow, index, candle);
  };

  candlestickData.forEach((candle, index) => {
    if (index === 0) return;

    const currentHigh = Math.max(candle.open, candle.close);
    const currentLow = Math.min(candle.open, candle.close);

    if (currentHigh > high.price) {
      high.index = index;
      high.price = currentHigh;
      high.time = candle.time;
      updateTrend(
        AutomaticPenTrend.Up,
        currentHigh,
        currentLow,
        index,
        candle
      );
    }

    if (currentLow < low.price) {
      low.index = index;
      low.price = currentLow;
      low.time = candle.time;
      updateTrend(
        AutomaticPenTrend.Down,
        currentHigh,
        currentLow,
        index,
        candle
      );
    }

    if (
      index === candlestickData.length - 1 &&
      startPoint &&
      endPoint &&
      currentTrend
    ) {
      pens.push({ startPoint, endPoint, trend: currentTrend });
    }
  });

  return pens;
}
