import { useCallback, useRef, useState, type RefObject } from "react";
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
  const enabledRef = useRef(false);
  const [automaticSegmentCount, setAutomaticSegmentCount] = useState(0);

  const clearAutomaticSegments = useCallback(() => {
    const chart = chartRef.current;
    if (chart) {
      segmentSeriesRef.current.forEach(({ series }) =>
        chart.removeSeries(series)
      );
    }
    segmentSeriesRef.current = [];
    enabledRef.current = false;
    setAutomaticSegmentCount(0);
  }, [chartRef]);

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
      series.setData([
        { time: segment.startPoint.time, value: segment.startPoint.price },
        { time: segment.endPoint.time, value: segment.endPoint.price },
      ]);
      return { segment, series };
    },
    [chartRef]
  );

  const calculateSegments = useCallback(() => {
    const candles = seriesRef.current?.data().filter(isCandlestickData) ?? [];
    return generateAutomaticSegments(generateAutomaticPens(candles));
  }, [seriesRef]);

  const drawAutomaticSegments = useCallback(() => {
    if (!chartRef.current || !seriesRef.current) return;
    clearAutomaticSegments();
    enabledRef.current = true;
    segmentSeriesRef.current = calculateSegments().flatMap((segment) => {
      const entry = createSegmentSeries(segment);
      return entry ? [entry] : [];
    });
    setAutomaticSegmentCount(segmentSeriesRef.current.length);
  }, [
    calculateSegments,
    chartRef,
    clearAutomaticSegments,
    createSegmentSeries,
    seriesRef,
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
      chart.removeSeries(entries[i].series);
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
  }, [calculateSegments, chartRef, createSegmentSeries, seriesRef]);

  const resetAutomaticSegmentsState = useCallback(() => {
    segmentSeriesRef.current = [];
    enabledRef.current = false;
    setAutomaticSegmentCount(0);
  }, []);

  return {
    automaticSegmentCount,
    clearAutomaticSegments,
    drawAutomaticSegments,
    resetAutomaticSegmentsState,
    updateAutomaticSegmentsAfterCandle,
  };
}
