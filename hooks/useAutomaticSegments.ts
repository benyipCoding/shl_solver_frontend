import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

import { generateAutomaticPens } from "@/components/market-master/automatic-pens";
import {
  AUTOMATIC_SEGMENTS_COLOR,
  generateAutomaticSegments,
  type AutomaticSegment,
} from "@/components/market-master/automatic-segments";

type SegmentSeriesEntry = {
  segment: AutomaticSegment;
  series: ISeriesApi<"Line", Time>;
};

type UseAutomaticSegmentsArgs = {
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
};

type SegmentTask = {
  token: number;
  cancelled: boolean;
  frameId: number | null;
  timeoutId: number | null;
};

// Keep chart mutations below a frame's budget so large drawings remain interactive.
const SEGMENT_TASK_BUDGET_MS = 8;

const isCandlestickData = (
  candle: CandlestickData<Time> | { time: Time }
): candle is CandlestickData<Time> => "open" in candle && "close" in candle;

const sameSegment = (left: AutomaticSegment, right: AutomaticSegment) =>
  left.trend === right.trend &&
  left.startPoint.time === right.startPoint.time &&
  left.startPoint.price === right.startPoint.price &&
  left.endPoint.time === right.endPoint.time &&
  left.endPoint.price === right.endPoint.price;

export function useAutomaticSegments({
  chartRef,
  seriesRef,
}: UseAutomaticSegmentsArgs) {
  const segmentSeriesRef = useRef<SegmentSeriesEntry[]>([]);
  const trackedSeriesRef = useRef(new Set<ISeriesApi<"Line", Time>>());
  const enabledRef = useRef(false);
  const taskRef = useRef<SegmentTask | null>(null);
  const taskTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const [automaticSegmentCount, setAutomaticSegmentCount] = useState(0);
  const [isAutomaticSegmentBusy, setIsAutomaticSegmentBusy] = useState(false);

  const cancelTask = useCallback(() => {
    const task = taskRef.current;
    if (!task) return;

    task.cancelled = true;
    if (task.frameId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(task.frameId);
    }
    if (task.timeoutId !== null && typeof window !== "undefined") {
      window.clearTimeout(task.timeoutId);
    }
    taskRef.current = null;
    if (mountedRef.current) setIsAutomaticSegmentBusy(false);
  }, []);

  const startTask = useCallback(() => {
    cancelTask();
    const task: SegmentTask = {
      token: ++taskTokenRef.current,
      cancelled: false,
      frameId: null,
      timeoutId: null,
    };
    taskRef.current = task;
    if (mountedRef.current) setIsAutomaticSegmentBusy(true);
    return task;
  }, [cancelTask]);

  const isCurrentTask = useCallback(
    (task: SegmentTask) =>
      !task.cancelled && taskRef.current?.token === task.token,
    []
  );

  const finishTask = useCallback((task: SegmentTask) => {
    if (taskRef.current?.token !== task.token) return;
    taskRef.current = null;
    if (mountedRef.current) setIsAutomaticSegmentBusy(false);
  }, []);

  const scheduleTaskFrame = useCallback(
    (task: SegmentTask, callback: () => void) => {
      if (!isCurrentTask(task)) return;

      const run = () => {
        task.frameId = null;
        task.timeoutId = null;
        callback();
      };

      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        task.frameId = window.requestAnimationFrame(run);
      } else if (typeof window !== "undefined") {
        task.timeoutId = window.setTimeout(run, 16);
      } else {
        run();
      }
    },
    [isCurrentTask]
  );

  const removeSeries = useCallback(
    (chart: IChartApi, series: ISeriesApi<"Line", Time>) => {
      try {
        chart.removeSeries(series);
      } catch {
        // The chart may already have been disposed during a market switch.
      }
      trackedSeriesRef.current.delete(series);
    },
    []
  );

  const removeSeriesInChunks = useCallback(
    (
      task: SegmentTask,
      chart: IChartApi,
      seriesToRemove: ISeriesApi<"Line", Time>[],
      onComplete: () => void
    ) => {
      let index = 0;

      const processChunk = () => {
        if (!isCurrentTask(task)) return;

        const deadline = performance.now() + SEGMENT_TASK_BUDGET_MS;
        while (index < seriesToRemove.length && performance.now() < deadline) {
          removeSeries(chart, seriesToRemove[index]);
          index += 1;
        }

        if (index < seriesToRemove.length) {
          scheduleTaskFrame(task, processChunk);
          return;
        }
        onComplete();
      };

      scheduleTaskFrame(task, processChunk);
    },
    [isCurrentTask, removeSeries, scheduleTaskFrame]
  );

  const clearAutomaticSegments = useCallback(() => {
    cancelTask();
    const chart = chartRef.current;
    segmentSeriesRef.current = [];
    enabledRef.current = false;
    setAutomaticSegmentCount(0);

    if (!chart) {
      trackedSeriesRef.current.clear();
      return;
    }

    const task = startTask();
    removeSeriesInChunks(task, chart, [...trackedSeriesRef.current], () => {
      finishTask(task);
    });
  }, [cancelTask, chartRef, finishTask, removeSeriesInChunks, startTask]);

  const createSegmentSeries = useCallback(
    (segment: AutomaticSegment): SegmentSeriesEntry | null => {
      const chart = chartRef.current;
      if (!chart) return null;
      const series = chart.addSeries(LineSeries, {
        color: AUTOMATIC_SEGMENTS_COLOR,
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: "",
      });
      trackedSeriesRef.current.add(series);
      try {
        series.setData([
          { time: segment.startPoint.time, value: segment.startPoint.price },
          { time: segment.endPoint.time, value: segment.endPoint.price },
        ]);
      } catch {
        removeSeries(chart, series);
        return null;
      }
      return { segment, series };
    },
    [chartRef, removeSeries]
  );

  const calculateSegments = useCallback(() => {
    const candles = seriesRef.current?.data().filter(isCandlestickData) ?? [];
    return generateAutomaticSegments(generateAutomaticPens(candles));
  }, [seriesRef]);

  const drawAutomaticSegments = useCallback(() => {
    if (!chartRef.current || !seriesRef.current) return;
    const chart = chartRef.current;
    const task = startTask();
    segmentSeriesRef.current = [];
    enabledRef.current = false;
    setAutomaticSegmentCount(0);

    removeSeriesInChunks(task, chart, [...trackedSeriesRef.current], () => {
      if (!isCurrentTask(task)) return;

      const segments = calculateSegments();
      const nextEntries: SegmentSeriesEntry[] = [];
      let index = 0;

      const addChunk = () => {
        if (!isCurrentTask(task)) return;

        const deadline = performance.now() + SEGMENT_TASK_BUDGET_MS;
        while (index < segments.length && performance.now() < deadline) {
          const entry = createSegmentSeries(segments[index]);
          if (entry) nextEntries.push(entry);
          index += 1;
        }

        if (index < segments.length) {
          scheduleTaskFrame(task, addChunk);
          return;
        }

        segmentSeriesRef.current = nextEntries;
        enabledRef.current = true;
        setAutomaticSegmentCount(nextEntries.length);
        finishTask(task);
      };

      scheduleTaskFrame(task, addChunk);
    });
  }, [
    calculateSegments,
    chartRef,
    createSegmentSeries,
    finishTask,
    isCurrentTask,
    removeSeriesInChunks,
    scheduleTaskFrame,
    seriesRef,
    startTask,
  ]);

  const updateAutomaticSegmentsAfterCandle = useCallback(() => {
    const chart = chartRef.current;
    if (!enabledRef.current || !chart || !seriesRef.current) return;

    const nextSegments = calculateSegments();
    const entries = segmentSeriesRef.current;
    let unchangedCount = 0;
    while (
      unchangedCount < entries.length &&
      unchangedCount < nextSegments.length &&
      sameSegment(entries[unchangedCount].segment, nextSegments[unchangedCount])
    ) {
      unchangedCount++;
    }

    for (let i = unchangedCount; i < entries.length; i++) {
      removeSeries(chart, entries[i].series);
    }
    const nextEntries = nextSegments
      .slice(unchangedCount)
      .flatMap((segment) => {
        const entry = createSegmentSeries(segment);
        return entry ? [entry] : [];
      });
    segmentSeriesRef.current = entries
      .slice(0, unchangedCount)
      .concat(nextEntries);
    if (segmentSeriesRef.current.length !== entries.length) {
      setAutomaticSegmentCount(segmentSeriesRef.current.length);
    }
  }, [
    calculateSegments,
    chartRef,
    createSegmentSeries,
    removeSeries,
    seriesRef,
  ]);

  const resetAutomaticSegmentsState = useCallback(() => {
    cancelTask();
    segmentSeriesRef.current = [];
    trackedSeriesRef.current.clear();
    enabledRef.current = false;
    setAutomaticSegmentCount(0);
  }, [cancelTask]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelTask();
    };
  }, [cancelTask]);

  return {
    automaticSegmentCount,
    isAutomaticSegmentBusy,
    clearAutomaticSegments,
    drawAutomaticSegments,
    resetAutomaticSegmentsState,
    updateAutomaticSegmentsAfterCandle,
  };
}
