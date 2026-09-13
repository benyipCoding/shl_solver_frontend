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
  const [automaticPenCount, setAutomaticPenCount] = useState(0);

  const clearAutomaticPens = useCallback(
    (disable = true) => {
      const chart = chartRef.current;
      if (chart) {
        penSeriesRef.current.forEach(({ series }) => chart.removeSeries(series));
      }

      penSeriesRef.current = [];
      if (disable) enabledRef.current = false;
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

    const visibleCandles = series
      .data()
      .filter(isCandlestickData)
      .filter(
        (candle) =>
          candle.time >= visibleRange.from && candle.time <= visibleRange.to
      );
    const pens = generateAutomaticPens(visibleCandles);

    clearAutomaticPens(false);
    enabledRef.current = true;
    penSeriesRef.current = pens.flatMap((pen) => {
      const entry = createAutomaticPenSeries(pen);
      return entry ? [entry] : [];
    });
    setAutomaticPenCount(penSeriesRef.current.length);
  }, [chartRef, clearAutomaticPens, createAutomaticPenSeries, seriesRef]);

  const updateAutomaticPensAfterCandle = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const lastEntry = penSeriesRef.current[penSeriesRef.current.length - 1];
    if (!enabledRef.current || !chart || !lastEntry || !series) return;

    const dataPens = generateAutomaticPens(
      series.data().filter(isCandlestickData)
    );
    const lastDataPen = dataPens[dataPens.length - 1];
    const lastDrawnPen = lastEntry.pen;
    if (!lastDataPen) return;

    if (lastDataPen.startPoint.time !== lastDrawnPen.startPoint.time) {
      const entry = createAutomaticPenSeries(lastDataPen);
      if (!entry) return;
      penSeriesRef.current.push(entry);
      setAutomaticPenCount(penSeriesRef.current.length);
      return;
    }

    if (lastDataPen.endPoint.time === lastDrawnPen.endPoint.time) return;

    chart.removeSeries(lastEntry.series);
    const entry = createAutomaticPenSeries(lastDataPen);
    if (entry) {
      penSeriesRef.current[penSeriesRef.current.length - 1] = entry;
    } else {
      penSeriesRef.current.pop();
    }
    setAutomaticPenCount(penSeriesRef.current.length);
  }, [chartRef, createAutomaticPenSeries, seriesRef]);

  const resetAutomaticPensState = useCallback(() => {
    penSeriesRef.current = [];
    enabledRef.current = false;
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
