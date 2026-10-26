import { useCallback, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";

import {
  SUB_PANE_MIN_HEIGHT,
  persistPaneHeights,
  readPaneHeights,
  resizeAdjacentPanes,
  type SubPaneId,
} from "@/components/market-master/chart-panes";
import { MAIN_CHART_MIN_HEIGHT } from "@/components/market-master/market-config";

type PaneId = "main" | SubPaneId;
type PaneHeights = Partial<Record<SubPaneId, number>>;

// Saved heights as an external store: the server render and hydration use
// the defaults, then the client switches to the stored heights.
const NO_HEIGHTS: PaneHeights = {};
let storedHeights: PaneHeights | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getHeights = () => (storedHeights ??= readPaneHeights());
const getServerHeights = () => NO_HEIGHTS;
const setStoredHeights = (update: (previous: PaneHeights) => PaneHeights) => {
  storedHeights = update(getHeights());
  listeners.forEach((listener) => listener());
};

type DragState = {
  pointerId: number;
  startY: number;
  upper: PaneId;
  lower: SubPaneId;
  upperHeight: number;
  lowerHeight: number;
};

/**
 * Heights of the indicator panes below the main chart. The main chart is the
 * flexible pane, so a sub-pane height is the only state; dragging the border
 * above a sub-pane trades height with the pane directly above it (the main
 * chart or another sub-pane). Charts follow via their ResizeObservers.
 */
export function useChartPaneHeights() {
  const paneRefs = useRef<Record<PaneId, HTMLDivElement | null>>({ main: null, macd: null, volume: null });
  const dragRef = useRef<DragState | null>(null);
  const heights = useSyncExternalStore(subscribe, getHeights, getServerHeights);
  const [draggingPane, setDraggingPane] = useState<SubPaneId | null>(null);

  const paneRef = useCallback(
    (id: PaneId) => (element: HTMLDivElement | null) => {
      paneRefs.current[id] = element;
    },
    []
  );

  const startPaneResize = useCallback(
    (upper: PaneId, lower: SubPaneId) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const upperEl = paneRefs.current[upper];
      const lowerEl = paneRefs.current[lower];
      if (!upperEl || !lowerEl) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        upper,
        lower,
        upperHeight: upperEl.getBoundingClientRect().height,
        lowerHeight: lowerEl.getBoundingClientRect().height,
      };
      setDraggingPane(lower);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    },
    []
  );

  const movePaneResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = resizeAdjacentPanes(
      drag.upperHeight,
      drag.lowerHeight,
      event.clientY - drag.startY,
      drag.upper === "main" ? MAIN_CHART_MIN_HEIGHT : SUB_PANE_MIN_HEIGHT,
      SUB_PANE_MIN_HEIGHT
    );
    setStoredHeights((previous) => ({
      ...previous,
      // The main chart is flexible: it absorbs whatever the sub-pane gives up.
      ...(drag.upper === "main" ? {} : { [drag.upper]: Math.round(next.upper) }),
      [drag.lower]: Math.round(next.lower),
    }));
  }, []);

  const endPaneResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingPane(null);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    persistPaneHeights(getHeights());
  }, []);

  /** Double-click a border: return the pane below it to its default height. */
  const resetPaneHeight = useCallback((lower: SubPaneId) => {
    setStoredHeights((previous) => {
      const next = { ...previous };
      delete next[lower];
      persistPaneHeights(next);
      return next;
    });
  }, []);

  return { draggingPane, endPaneResize, heights, movePaneResize, paneRef, resetPaneHeight, startPaneResize };
}
