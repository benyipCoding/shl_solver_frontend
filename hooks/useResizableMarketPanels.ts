import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import {
  BOTTOM_PANEL_DEFAULT_HEIGHT,
  BOTTOM_PANEL_MIN_HEIGHT,
  MACD_PANEL_HEIGHT,
  MAIN_CHART_MIN_HEIGHT,
  MAIN_CONTENT_MIN_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  clamp,
} from "@/components/market-master/market-config";

type ResizeDirection = "right" | "bottom" | null;

type ResizeState = {
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

type UseResizableMarketPanelsArgs = {
  isMacdEnabled: boolean;
  isMaximized: boolean;
};

export function useResizableMarketPanels({
  isMacdEnabled,
  isMaximized,
}: UseResizableMarketPanelsArgs) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const mainColumnRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<ResizeState>({
    direction: null,
    startX: 0,
    startY: 0,
    startWidth: RIGHT_PANEL_DEFAULT_WIDTH,
    startHeight: BOTTOM_PANEL_DEFAULT_HEIGHT,
  });

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(
    RIGHT_PANEL_DEFAULT_WIDTH
  );
  const [bottomPanelHeight, setBottomPanelHeight] = useState(
    BOTTOM_PANEL_DEFAULT_HEIGHT
  );

  useEffect(() => {
    const mobileMedia = window.matchMedia("(max-width: 767px)");
    const syncPanelDefaults = (isMobile: boolean) => {
      if (isMobile) {
        setIsRightPanelOpen(false);
        setIsBottomPanelOpen(false);
      }
    };

    syncPanelDefaults(mobileMedia.matches);
    const handleViewportChange = (event: MediaQueryListEvent) =>
      syncPanelDefaults(event.matches);
    mobileMedia.addEventListener("change", handleViewportChange);
    return () =>
      mobileMedia.removeEventListener("change", handleViewportChange);
  }, []);

  const stopResizeDrag = useCallback(() => {
    if (!resizeStateRef.current.direction) return;
    resizeStateRef.current.direction = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    const handleResizeDragMove = (event: globalThis.MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState.direction) return;

      if (resizeState.direction === "right") {
        const containerWidth =
          layoutRef.current?.clientWidth || window.innerWidth;
        const maxWidth = Math.max(
          RIGHT_PANEL_MIN_WIDTH,
          containerWidth - MAIN_CONTENT_MIN_WIDTH
        );
        setRightPanelWidth(
          clamp(
            resizeState.startWidth + (resizeState.startX - event.clientX),
            RIGHT_PANEL_MIN_WIDTH,
            maxWidth
          )
        );
        return;
      }

      const containerHeight =
        mainColumnRef.current?.clientHeight || window.innerHeight;
      const minTopAreaHeight =
        MAIN_CHART_MIN_HEIGHT + (isMacdEnabled ? MACD_PANEL_HEIGHT : 0);
      const maxHeight = Math.max(
        BOTTOM_PANEL_MIN_HEIGHT,
        containerHeight - minTopAreaHeight
      );
      setBottomPanelHeight(
        clamp(
          resizeState.startHeight + (resizeState.startY - event.clientY),
          BOTTOM_PANEL_MIN_HEIGHT,
          maxHeight
        )
      );
    };

    window.addEventListener("mousemove", handleResizeDragMove);
    window.addEventListener("mouseup", stopResizeDrag);
    return () => {
      window.removeEventListener("mousemove", handleResizeDragMove);
      window.removeEventListener("mouseup", stopResizeDrag);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isMacdEnabled, stopResizeDrag]);

  const startRightPanelResize = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isRightPanelOpen || isMaximized) return;
      event.preventDefault();
      event.stopPropagation();
      resizeStateRef.current = {
        direction: "right",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rightPanelWidth,
        startHeight: bottomPanelHeight,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [bottomPanelHeight, isMaximized, isRightPanelOpen, rightPanelWidth]
  );

  const startBottomPanelResize = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isBottomPanelOpen || isMaximized) return;
      event.preventDefault();
      event.stopPropagation();
      resizeStateRef.current = {
        direction: "bottom",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rightPanelWidth,
        startHeight: bottomPanelHeight,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    },
    [bottomPanelHeight, isBottomPanelOpen, isMaximized, rightPanelWidth]
  );

  return {
    bottomPanelHeight,
    isBottomPanelOpen,
    isRightPanelOpen,
    layoutRef,
    mainColumnRef,
    rightPanelWidth,
    setIsBottomPanelOpen,
    setIsRightPanelOpen,
    startBottomPanelResize,
    startRightPanelResize,
  };
}
