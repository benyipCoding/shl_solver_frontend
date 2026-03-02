import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  CandlestickSeries,
} from "lightweight-charts";
import { TrendLinePrimitive, Point } from "@/utils/k-line/trend-line";
import { generateMockData } from "@/utils/k-line/data";
import {
  DEFAULT_CHART_OPTIONS,
  DEFAULT_CANDLESTICK_SERIES_OPTIONS,
} from "@/constants/k-line";

export interface ChartState {
  lines: TrendLinePrimitive[];
  mode: "idle" | "draw";
  activeLine: TrendLinePrimitive | null;
  dragPointIndex: 1 | 2 | null;
  isDrawing: boolean;
  currentMouseX: number | null;
  currentMouseY: number | null;
  currentLogical: Point | null;
}

interface UseChartParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  mode: "idle" | "draw";
  setMode: (mode: "idle" | "draw") => void;
  setLines: (lines: TrendLinePrimitive[]) => void;
  stateRef: React.MutableRefObject<ChartState>;
}

export function useChart({
  containerRef,
  mode,
  setMode,
  setLines,
  stateRef,
}: UseChartParams) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. 初始化图表
    const chart = createChart(containerRef.current, {
      ...DEFAULT_CHART_OPTIONS,
      width: containerRef.current.clientWidth,
    });

    const series = chart.addSeries(
      CandlestickSeries,
      DEFAULT_CANDLESTICK_SERIES_OPTIONS
    );

    // @ts-ignore
    series.setData(generateMockData());
    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    // 2. 监听十字线移动：实时获取鼠标的逻辑坐标和像素坐标
    const crosshairMoveHandler = (param: MouseEventParams) => {
      if (!param.point) return;
      const state = stateRef.current;

      state.currentMouseX = param.point.x;
      state.currentMouseY = param.point.y;

      // 提取当前的业务逻辑坐标 (时间, 价格)
      const time = param.time;
      const price = series.coordinateToPrice(param.point.y);
      if (time && price !== null) {
        // @ts-ignore
        state.currentLogical = { time, price };
      }

      // 状态机处理
      if (state.mode === "draw" && state.isDrawing && state.activeLine) {
        // 正在画线：动态更新终点
        if (state.currentLogical) {
          state.activeLine.updatePoint(2, state.currentLogical);
        }
      } else if (
        state.mode === "idle" &&
        state.dragPointIndex !== null &&
        state.activeLine
      ) {
        // 正在拖拽端点：更新选中的端点位置
        let dragTime = time;
        if (!dragTime) {
          // @ts-ignore
          const logicalTime = chart.timeScale().coordinateToTime(param.point.x);
          if (logicalTime !== null) dragTime = logicalTime;
        }
        if (dragTime && price !== null) {
          // @ts-ignore
          state.activeLine.updatePoint(state.dragPointIndex, {
            time: dragTime,
            price,
          });
        }
      } else if (state.mode === "idle" && !state.dragPointIndex) {
        // 闲置状态：检测是否悬浮在某个线条的端点上 (Hit Testing)
        let foundHover = false;

        // Ensure container ref is valid for style changes
        const container = containerRef.current;
        if (!container) return;

        for (const line of state.lines) {
          if (!line.chart || !line.series) continue;

          const x1 = line.chart.timeScale().timeToCoordinate(line.p1.time);
          const y1 = line.series.priceToCoordinate(line.p1.price);
          const x2 = line.chart.timeScale().timeToCoordinate(line.p2.time);
          const y2 = line.series.priceToCoordinate(line.p2.price);

          if (x1 === null || y1 === null || x2 === null || y2 === null)
            continue;

          const dist1 = Math.hypot(param.point.x - x1, param.point.y - y1);
          const dist2 = Math.hypot(param.point.x - x2, param.point.y - y2);

          if (dist1 < 10) {
            line.setHoveredPoint(1);
            container.style.cursor = "grab";
            foundHover = true;
          } else if (dist2 < 10) {
            line.setHoveredPoint(2);
            container.style.cursor = "grab";
            foundHover = true;
          } else {
            line.setHoveredPoint(null);
          }
        }
        if (!foundHover) {
          container.style.cursor = "crosshair";
        }
      }
    };

    // 3. 监听图表点击：用于画线模式
    const clickHandler = (param: MouseEventParams) => {
      const state = stateRef.current;
      if (state.mode !== "draw" || !state.currentLogical) return;

      if (!state.isDrawing) {
        // 第一次点击：开始画线
        const newLine = new TrendLinePrimitive(
          state.currentLogical,
          state.currentLogical
        );
        series.attachPrimitive(newLine);
        state.activeLine = newLine;
        state.isDrawing = true;
        state.lines.push(newLine);
      } else {
        // 第二次点击：完成画线
        state.isDrawing = false;
        state.activeLine = null;
        setMode("idle"); // 自动切回指针模式
        state.mode = "idle";
        setLines([...state.lines]); // 触发UI更新显示线条数量
      }
    };

    // 4. 拦截鼠标按下/抬起：用于拖拽调整
    const mousedownHandler = () => {
      const state = stateRef.current;
      if (state.mode !== "idle") return;

      if (!containerRef.current) return;

      for (const line of state.lines) {
        if (line.hoveredPoint !== null) {
          state.dragPointIndex = line.hoveredPoint;
          state.activeLine = line;

          // 【关键】：开始拖拽时，禁用图表的原生滑动和缩放
          chart.applyOptions({ handleScroll: false, handleScale: false });
          containerRef.current.style.cursor = "grabbing";
          break;
        }
      }
    };

    const mouseupHandler = () => {
      const state = stateRef.current;
      if (state.dragPointIndex !== null) {
        state.dragPointIndex = null;
        state.activeLine = null;

        if (!containerRef.current) return;

        // 【关键】：拖拽结束，恢复图表的滑动和缩放
        chart.applyOptions({ handleScroll: true, handleScale: true });
        containerRef.current.style.cursor = "crosshair";
      }
    };

    // 绑定事件
    chart.subscribeCrosshairMove(crosshairMoveHandler);
    chart.subscribeClick(clickHandler);

    const container = containerRef.current;
    container.addEventListener("mousedown", mousedownHandler);
    window.addEventListener("mouseup", mouseupHandler);

    // 卸载与清理
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.unsubscribeCrosshairMove(crosshairMoveHandler);
      chart.unsubscribeClick(clickHandler);
      container.removeEventListener("mousedown", mousedownHandler);
      window.removeEventListener("mouseup", mouseupHandler);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []); // 依赖项置空，只在mount时初始化

  return {
    chartRef,
    seriesRef,
  };
}
