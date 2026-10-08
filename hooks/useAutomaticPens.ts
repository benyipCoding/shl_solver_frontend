import { useCallback, useRef, useState, type RefObject } from "react";
import type { DataChangedScope, IChartApi, ISeriesApi, Logical, Time } from "lightweight-charts";

import {
  createAutomaticPenGenerator,
  selectAutomaticPensForViewport,
  type AutomaticPen,
  type AutomaticPenCandle,
  type AutomaticPenMode,
} from "@/components/market-master/automatic-pens";
import { AutomaticPensPrimitive } from "@/components/market-master/automatic-pens-primitive";
import { exactCandleIndex } from "@/components/market-master/chart-window";

type UseAutomaticPensArgs = {
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
  source?: () => { candles: readonly AutomaticPenCandle[]; count: number };
};

export function useAutomaticPens({ chartRef, seriesRef, source }: UseAutomaticPensArgs) {
  const primitiveRef = useRef<AutomaticPensPrimitive | null>(null);
  const generatorRef = useRef<ReturnType<typeof createAutomaticPenGenerator> | null>(null);
  const modeRef = useRef<AutomaticPenMode>("simple");
  const drawnPensRef = useRef<readonly AutomaticPen[]>([]);
  const startTimeRef = useRef<Time | null>(null);
  const warmupStartTimeRef = useRef<Time | null>(null);
  const lastTimeRef = useRef<Time | null>(null);
  const caughtUpRef = useRef(false);
  const lastSourceBarRef = useRef<AutomaticPenCandle | null>(null);
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
    warmupStartTimeRef.current = null;
    lastTimeRef.current = null;
    caughtUpRef.current = false;
    lastSourceBarRef.current = null;
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
    const input = source?.();
    if (input && until === undefined && caughtUpRef.current && lastSourceBarRef.current === input.candles[input.count - 1]) return;
    const generator = createAutomaticPenGenerator(undefined, undefined, modeRef.current);
    lastTimeRef.current = null;
    caughtUpRef.current = true;
    // Only setData/rewind/same-bar edits need a replay. Ordinary append never
    // calls series.data(), which copies the entire candle history in the chart.
    const candles = input?.candles ?? series.data();
    const count = input?.count ?? candles.length;
    const exactStart = typeof startTime === "number" ? exactCandleIndex(candles, startTime) : -1;
    const start = exactStart >= 0 ? exactStart : candles.findIndex((candle) => candle.time >= startTime);
    for (let i = Math.max(0, start - 101); i < count; i++) {
      const candle = candles[i];
      if (!("open" in candle)) continue;
      if (candle.time < startTime) {
        if (warmupStartTimeRef.current == null || candle.time >= warmupStartTimeRef.current) generator.warmup(candle);
        continue;
      }
      if (until !== undefined && candle.time > until) {
        caughtUpRef.current = false;
        continue;
      }
      generator.append(candle);
      lastTimeRef.current = candle.time;
      lastSourceBarRef.current = candle;
    }
    generatorRef.current = generator;
  }, [seriesRef, source]);

  const setAutomaticPenMode = useCallback((mode: AutomaticPenMode) => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    if (!generatorRef.current) return;
    caughtUpRef.current = false;
    rebuildAutomaticPens();
    renderAutomaticPens();
  }, [rebuildAutomaticPens, renderAutomaticPens]);

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
    // A long pen may cross the chart window with an endpoint outside setData.
    // Project by source candle indexes so missing endpoint timestamps do not hide it.
    const primitive = new AutomaticPensPrimitive(source ? (time) => {
      const first = series.dataByIndex(0)?.time;
      if (typeof first !== "number" || typeof time !== "number") return null;
      const { candles } = source();
      const from = exactCandleIndex(candles, first), point = exactCandleIndex(candles, time);
      return from < 0 || point < 0 ? null : timeScale.logicalToCoordinate((point - from) as Logical);
    } : undefined);
    primitiveRef.current = primitive;
    series.attachPrimitive(primitive);
    startTimeRef.current = first.time;
    warmupStartTimeRef.current = source?.().candles[0]?.time ?? series.dataByIndex(0)?.time ?? first.time;
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
  }, [chartRef, seriesRef, clearAutomaticPens, rebuildAutomaticPens, renderAutomaticPens, source]);

  const updateAutomaticPensAfterCandle = useCallback((candle?: AutomaticPenCandle, render = true) => {
    const generator = generatorRef.current;
    if (!generator || !chartRef.current || !seriesRef.current) return;
    if (candle && caughtUpRef.current && lastTimeRef.current !== null && candle.time > lastTimeRef.current) {
      generator.append(candle);
      lastTimeRef.current = candle.time;
      lastSourceBarRef.current = candle;
    } else {
      // Also catches multiple revealed candles and corrections to the last bar.
      rebuildAutomaticPens();
    }
    if (render) renderAutomaticPens();
  }, [chartRef, seriesRef, rebuildAutomaticPens, renderAutomaticPens]);

  return { automaticPenCount, clearAutomaticPens, drawAutomaticPens, resetAutomaticPensState, updateAutomaticPensAfterCandle, getAutomaticPenStartTime, setAutomaticPenMode };
}
