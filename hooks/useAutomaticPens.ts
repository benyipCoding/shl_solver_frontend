import { useCallback, useRef, useState, type RefObject } from "react";
import type { DataChangedScope, IChartApi, ISeriesApi, Time } from "lightweight-charts";

import {
  createAutomaticPenGenerator,
  selectAutomaticPensForViewport,
  type AutomaticPen,
  type AutomaticPenCandle,
} from "@/components/market-master/automatic-pens";
import { AutomaticPensPrimitive } from "@/components/market-master/automatic-pens-primitive";

type UseAutomaticPensArgs = {
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
};

export function useAutomaticPens({ chartRef, seriesRef }: UseAutomaticPensArgs) {
  const primitiveRef = useRef<AutomaticPensPrimitive | null>(null);
  const generatorRef = useRef<ReturnType<typeof createAutomaticPenGenerator> | null>(null);
  const drawnPensRef = useRef<readonly AutomaticPen[]>([]);
  const startTimeRef = useRef<Time | null>(null);
  const lastTimeRef = useRef<Time | null>(null);
  const caughtUpRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const countRef = useRef(0);
  const [automaticPenCount, setAutomaticPenCount] = useState(0);
  const getAutomaticPenStartTime = useCallback(() => startTimeRef.current, []);

  const renderAutomaticPens = useCallback(() => {
    const chart = chartRef.current;
    const generator = generatorRef.current;
    if (!chart || !generator) return;
    const pens = selectAutomaticPensForViewport(generator.pens, chart.timeScale().getVisibleRange());
    const previous = drawnPensRef.current;
    if (pens.length === previous.length && pens.every((pen, index) => pen === previous[index])) return;
    // Save identities so offscreen changes do not request redundant redraws.
    drawnPensRef.current = pens;
    primitiveRef.current?.setPens(pens);
    if (countRef.current !== pens.length) {
      countRef.current = pens.length;
      setAutomaticPenCount(pens.length);
    }
  }, [chartRef]);

  const resetAutomaticPensState = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    primitiveRef.current = null;
    generatorRef.current = null;
    drawnPensRef.current = [];
    startTimeRef.current = null;
    lastTimeRef.current = null;
    caughtUpRef.current = false;
    countRef.current = 0;
    setAutomaticPenCount(0);
  }, []);

  const clearAutomaticPens = useCallback(() => {
    resetAutomaticPensState();
  }, [resetAutomaticPensState]);

  const rebuildAutomaticPens = useCallback((until?: Time) => {
    const series = seriesRef.current;
    const startTime = startTimeRef.current;
    if (!series || startTime === null) return;
    const generator = createAutomaticPenGenerator();
    lastTimeRef.current = null;
    caughtUpRef.current = true;
    // Only setData/rewind/same-bar edits need a replay. Ordinary append never
    // calls series.data(), which copies the entire candle history in the chart.
    for (const candle of series.data()) {
      if (!("open" in candle) || candle.time < startTime) continue;
      if (until !== undefined && candle.time > until) {
        caughtUpRef.current = false;
        continue;
      }
      generator.append(candle);
      lastTimeRef.current = candle.time;
    }
    generatorRef.current = generator;
  }, [seriesRef]);

  const drawAutomaticPens = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleRange();
    if (!range) return;
    const first = series.data().find((candle) => "open" in candle && candle.time >= range.from && candle.time <= range.to);
    if (!first) return;

    clearAutomaticPens();
    const primitive = new AutomaticPensPrimitive();
    primitiveRef.current = primitive;
    series.attachPrimitive(primitive);
    startTimeRef.current = first.time;
    rebuildAutomaticPens(range.to);
    renderAutomaticPens();
    const onDataChanged = (scope: DataChangedScope) => {
      if (scope !== "full") return;
      rebuildAutomaticPens();
      renderAutomaticPens();
    };
    timeScale.subscribeVisibleTimeRangeChange(renderAutomaticPens);
    series.subscribeDataChanged(onDataChanged);
    unsubscribeRef.current = () => {
      timeScale.unsubscribeVisibleTimeRangeChange(renderAutomaticPens);
      series.unsubscribeDataChanged(onDataChanged);
      series.detachPrimitive(primitive);
    };
  }, [chartRef, seriesRef, clearAutomaticPens, rebuildAutomaticPens, renderAutomaticPens]);

  const updateAutomaticPensAfterCandle = useCallback((candle?: AutomaticPenCandle) => {
    const generator = generatorRef.current;
    if (!generator || !chartRef.current || !seriesRef.current) return;
    if (candle && caughtUpRef.current && lastTimeRef.current !== null && candle.time > lastTimeRef.current) {
      generator.append(candle);
      lastTimeRef.current = candle.time;
    } else {
      // Also catches multiple revealed candles and corrections to the last bar.
      rebuildAutomaticPens();
    }
    renderAutomaticPens();
  }, [chartRef, seriesRef, rebuildAutomaticPens, renderAutomaticPens]);

  return { automaticPenCount, clearAutomaticPens, drawAutomaticPens, resetAutomaticPensState, updateAutomaticPensAfterCandle, getAutomaticPenStartTime };
}
