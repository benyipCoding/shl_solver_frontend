import { useCallback, useRef, useState, type RefObject } from "react";
import {
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import {
  AUTOMATIC_PENS_COLOR,
  generateAutomaticPens,
  type AutomaticPen,
} from "@/components/market-master/automatic-pens";

type AutomaticPenSeriesEntry = {
  pen: AutomaticPen;
  series: ISeriesApi<"Line", Time>;
};

type UseAutomaticPensArgs = {
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
};

const isCandlestickData = (
  candle: CandlestickData<Time> | { time: Time }
): candle is CandlestickData<Time> => "open" in candle && "close" in candle;

export function useAutomaticPens({
  chartRef,
  seriesRef,
}: UseAutomaticPensArgs) {
  const penSeriesRef = useRef<AutomaticPenSeriesEntry[]>([]);
  const enabledRef = useRef(false);
  const startTimeRef = useRef<Time | null>(null);
  const [automaticPenCount, setAutomaticPenCount] = useState(0);

  const clearAutomaticPens = useCallback(
    (disable = true) => {
      const chart = chartRef.current;
      if (chart) {
        penSeriesRef.current.forEach(({ series }) => chart.removeSeries(series));
      }

      penSeriesRef.current = [];
      if (disable) {
        enabledRef.current = false;
        startTimeRef.current = null;
      }
      setAutomaticPenCount(0);
    },
    [chartRef]
  );

  const createAutomaticPenSeries = useCallback(
    (pen: AutomaticPen) => {
      const chart = chartRef.current;
      if (!chart) return null;

      const penSeries = chart.addSeries(LineSeries, {
        color: AUTOMATIC_PENS_COLOR,
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: "",
      });
      penSeries.setData([
        { time: pen.startPoint.time, value: pen.startPoint.price },
        { time: pen.endPoint.time, value: pen.endPoint.price },
      ]);

      return { pen, series: penSeries };
    },
    [chartRef]
  );

  const drawAutomaticPens = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const visibleRange = chart.timeScale().getVisibleRange();
    if (!visibleRange) return;

    // Start from the visible candles; later updates retain this drawing boundary.
    const candles = series
      .data()
      .filter(isCandlestickData)
      .filter((candle) => candle.time <= visibleRange.to);
    const startIndex = candles.findIndex((candle) => candle.time >= visibleRange.from);
    if (startIndex < 0) return;
    const pens = generateAutomaticPens(candles.slice(startIndex));

    clearAutomaticPens(false);
    enabledRef.current = true;
    startTimeRef.current = candles[startIndex].time;
    penSeriesRef.current = pens.flatMap((pen) => {
      const entry = createAutomaticPenSeries(pen);
      return entry ? [entry] : [];
    });
    setAutomaticPenCount(penSeriesRef.current.length);
  }, [chartRef, clearAutomaticPens, createAutomaticPenSeries, seriesRef]);

  const updateAutomaticPensAfterCandle = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const startTime = startTimeRef.current;
    if (!enabledRef.current || !chart || !series || startTime === null) return;

    const candles = series.data().filter(isCandlestickData);
    const startIndex = candles.findIndex((candle) => candle.time >= startTime);
    const pens = startIndex < 0
      ? []
      : generateAutomaticPens(candles.slice(startIndex));

    // Also handles zero initial pens, several newly revealed legs, and same-bar
    // price changes. Reuse chart series so unchanged lines do not flicker.
    const entries = penSeriesRef.current;
    for (let index = entries.length - 1; index >= pens.length; index--) {
      chart.removeSeries(entries[index].series);
      entries.pop();
    }
    pens.forEach((pen, index) => {
      const entry = entries[index];
      if (!entry) {
        const created = createAutomaticPenSeries(pen);
        if (created) entries.push(created);
        return;
      }
      const previous = entry.pen;
      if (
        previous.startPoint.time !== pen.startPoint.time ||
        previous.startPoint.price !== pen.startPoint.price ||
        previous.endPoint.time !== pen.endPoint.time ||
        previous.endPoint.price !== pen.endPoint.price
      ) {
        entry.series.setData([
          { time: pen.startPoint.time, value: pen.startPoint.price },
          { time: pen.endPoint.time, value: pen.endPoint.price },
        ]);
      }
      entry.pen = pen;
    });
    setAutomaticPenCount(entries.length);
  }, [chartRef, createAutomaticPenSeries, seriesRef]);

  const resetAutomaticPensState = useCallback(() => {
    penSeriesRef.current = [];
    enabledRef.current = false;
    startTimeRef.current = null;
    setAutomaticPenCount(0);
  }, []);

  return {
    automaticPenCount,
    clearAutomaticPens,
    drawAutomaticPens,
    resetAutomaticPensState,
    updateAutomaticPensAfterCandle,
  };
}
