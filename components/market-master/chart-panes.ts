/** Indicator panes shown below the main chart, top to bottom. */
export type SubPaneId = "macd" | "volume";

export const SUB_PANE_MIN_HEIGHT = 96;
export const PANE_HEIGHTS_STORAGE_KEY = "marketMasterPaneHeights";

/**
 * Move the border between two stacked panes by `delta` pixels (positive =
 * down). The pair keeps its combined height and neither pane goes below its
 * minimum, so dragging one border never resizes a third pane.
 */
export function resizeAdjacentPanes(
  upper: number,
  lower: number,
  delta: number,
  upperMin: number,
  lowerMin: number
) {
  const total = upper + lower;
  const maxUpper = Math.max(upperMin, total - lowerMin);
  const nextUpper = Math.min(Math.max(upper + delta, upperMin), maxUpper);
  return { upper: nextUpper, lower: total - nextUpper };
}

export function readPaneHeights(): Partial<Record<SubPaneId, number>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PANE_HEIGHTS_STORAGE_KEY) || "{}");
    const heights: Partial<Record<SubPaneId, number>> = {};
    for (const id of ["macd", "volume"] as const) {
      const value = Number(parsed?.[id]);
      if (Number.isFinite(value) && value >= SUB_PANE_MIN_HEIGHT) heights[id] = Math.round(value);
    }
    return heights;
  } catch {
    return {};
  }
}

export function persistPaneHeights(heights: Partial<Record<SubPaneId, number>>) {
  try {
    localStorage.setItem(PANE_HEIGHTS_STORAGE_KEY, JSON.stringify(heights));
  } catch {
    // Storage is a convenience; resizing still works for this session.
  }
}
