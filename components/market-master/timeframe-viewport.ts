import { CHART_WINDOW_BARS, CHART_WINDOW_EDGE } from "./chart-window";

/**
 * Viewport handed from one timeframe to the next for the same instrument.
 * Bar indexes differ between timeframes, so the handoff is the time at the
 * centre of the chart plus the visible bar count: D1 -> H4 keeps the same
 * date in the middle at the same candle width, i.e. zooms into that date.
 */
export type TimeframeViewportAnchor = {
  sourceSymbol: string;
  sourceTimeframe: string;
  /** Middle of the source bar at the visible centre (unix seconds). */
  anchorTime: number;
  /** Visible logical width in bars. */
  barSpan: number;
};

type TimedCandle = { time: number };
type LogicalRange = { from: number; to: number };

const MIN_BAR_SPAN = 10;
// Empty bars allowed right of the newest bar after a switch.
const RIGHT_MARGIN_BARS = 5;
// Leave room inside the bounded chart window so restoring a range does not
// immediately trigger a window shift.
const MAX_BAR_SPAN = CHART_WINDOW_BARS - 2 * CHART_WINDOW_EDGE;

export function captureTimeframeViewportAnchor({
  data,
  count,
  windowFrom,
  logical,
  sourceSymbol,
  sourceTimeframe,
  sourceBarSeconds,
}: {
  data: readonly TimedCandle[];
  /** Bars the user can see: revealed bars in backtest, all bars otherwise. */
  count: number;
  windowFrom: number;
  logical: LogicalRange | null | undefined;
  sourceSymbol: string;
  sourceTimeframe: string;
  sourceBarSeconds: number;
}): TimeframeViewportAnchor | null {
  const lastIndex = Math.min(count, data.length) - 1;
  if (lastIndex < 0 || !logical || !Number.isFinite(logical.from) || !Number.isFinite(logical.to)) {
    return null;
  }
  const from = windowFrom + logical.from;
  const to = windowFrom + logical.to;
  const centerIndex = Math.max(0, Math.min(lastIndex, Math.round((from + to) / 2)));
  return {
    sourceSymbol,
    sourceTimeframe,
    // A D1 label is the start of its day. Use the middle of the bar so H4
    // lands on that day's midday bar instead of the previous evening.
    anchorTime: data[centerIndex].time + Math.max(0, Math.floor(sourceBarSeconds / 2)),
    barSpan: Math.max(1, to - from),
  };
}

/** Last index in data[0, count) whose time is <= target, or 0 if none. */
export function candleIndexAtOrBefore(data: readonly TimedCandle[], count: number, target: number) {
  let lo = 0;
  let hi = Math.min(count, data.length) - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (data[mid].time <= target) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Logical range (source data indexes) centred on the anchor in `data`. Near
 * the newest bar (H4 at today -> D1) the range is shifted left rather than
 * leaving half the chart empty; the anchor stays on screen either way.
 */
export function resolveTimeframeViewportRange(
  data: readonly TimedCandle[],
  count: number,
  anchor: TimeframeViewportAnchor
): LogicalRange | null {
  const available = Math.min(count, data.length);
  if (available <= 0) return null;
  const span = Math.max(MIN_BAR_SPAN, Math.min(MAX_BAR_SPAN, anchor.barSpan));
  const center = candleIndexAtOrBefore(data, available, anchor.anchorTime);
  const to = Math.min(center + span / 2, available - 1 + RIGHT_MARGIN_BARS);
  return { from: to - span, to };
}

/**
 * True when `data` already holds the anchor and enough bars to fill the left
 * half of the restored viewport, so no older page is needed first.
 */
export function timeframeViewportIsLoaded(
  data: readonly TimedCandle[],
  anchor: TimeframeViewportAnchor,
  hasMoreHistory: boolean
) {
  if (!data.length) return false;
  if (!hasMoreHistory) return true;
  if (data[0].time > anchor.anchorTime) return false;
  const center = candleIndexAtOrBefore(data, data.length, anchor.anchorTime);
  return center >= Math.min(MAX_BAR_SPAN, anchor.barSpan) / 2;
}
