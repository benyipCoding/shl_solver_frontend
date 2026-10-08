export const CHART_WINDOW_BARS = 5000;
export const CHART_WINDOW_EDGE = 300;
export type ChartWindow = { from: number; to: number }; // end exclusive, source indexes

export function selectChartWindow(count: number, focus?: { from: number; to: number }): ChartWindow {
  if (!focus) return { from: Math.max(0, count - (CHART_WINDOW_BARS - 2 * CHART_WINDOW_EDGE)), to: count };
  const center = (focus.from + Math.min(focus.to, focus.from + CHART_WINDOW_BARS - 1)) / 2;
  const from = Math.max(0, Math.min(Math.floor(center - CHART_WINDOW_BARS / 2), count - CHART_WINDOW_BARS));
  return { from, to: Math.min(count, from + CHART_WINDOW_BARS) };
}

export function sliceChartWindow<T>(data: readonly T[], window: ChartWindow, offset = 0): T[] {
  return data.slice(Math.max(0, window.from - offset), Math.max(0, window.to - offset));
}

export function exactCandleIndex(data: readonly { time: unknown }[], time: number): number {
  let lo = 0, hi = data.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2), value = data[mid].time as number;
    if (value === time) return mid;
    if (value < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
