"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pencil, MousePointer2, Trash2 } from "lucide-react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
  MouseEventParams,
  CandlestickData,
  CrosshairMode,
  ColorType,
  CandlestickSeries,
} from "lightweight-charts";

import type { CanvasRenderingTarget2D } from "fancy-canvas";

// ==========================================
// 1. 图表插件底层实现 (Primitives API)
// ==========================================

interface Point {
  time: Time;
  price: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

// 渲染器：负责具体的 Canvas 绘制指令
class TrendLineRenderer implements IPrimitivePaneRenderer {
  private _p1: PixelPoint | null;
  private _p2: PixelPoint | null;
  private _hoveredPoint: 1 | 2 | null;

  constructor(
    p1: PixelPoint | null,
    p2: PixelPoint | null,
    hoveredPoint: 1 | 2 | null
  ) {
    this._p1 = p1; // 像素坐标 {x, y}
    this._p2 = p2;
    this._hoveredPoint = hoveredPoint; // 1, 2, 或 null (代表是否悬浮在某个端点上)
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      if (!this._p1 || !this._p2) return;

      // 绘制线条
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2962FF"; // 蓝色
      ctx.beginPath();
      ctx.moveTo(this._p1.x, this._p1.y);
      ctx.lineTo(this._p2.x, this._p2.y);
      ctx.stroke();

      // 绘制端点操作柄 (如果有悬浮或拖拽状态)
      const drawHandle = (point: PixelPoint, isHovered: boolean) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, isHovered ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? "#1E88E5" : "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2962FF";
        ctx.stroke();
      };

      // 只要处于交互模式，就显示两个端点。当前被 hover 的端点会变大
      if (this._hoveredPoint !== null) {
        drawHandle(this._p1, this._hoveredPoint === 1);
        drawHandle(this._p2, this._hoveredPoint === 2);
      }
    });
  }
}

// 视图转换器：将 数据坐标(时间/价格) 转换为 像素坐标(x/y)
class TrendLinePaneView implements IPrimitivePaneView {
  private _source: TrendLinePrimitive;

  constructor(source: TrendLinePrimitive) {
    this._source = source;
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._source.chart || !this._source.series) return null;

    // 时间转 X 坐标
    const x1 = this._source.chart
      .timeScale()
      .timeToCoordinate(this._source.p1.time);
    const x2 = this._source.chart
      .timeScale()
      .timeToCoordinate(this._source.p2.time);

    // 价格转 Y 坐标
    const y1 = this._source.series.priceToCoordinate(this._source.p1.price);
    const y2 = this._source.series.priceToCoordinate(this._source.p2.price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

    return new TrendLineRenderer(
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      this._source.hoveredPoint
    );
  }
}

// 图元主类：附加到图表的对象，管理数据和状态
class TrendLinePrimitive implements ISeriesPrimitive {
  public p1: Point;
  public p2: Point;
  public hoveredPoint: 1 | 2 | null = null;
  public chart: IChartApi | null = null;
  public series: ISeriesApi<"Candlestick"> | null = null;
  public requestUpdate: (() => void) | null = null;

  private _paneViews: TrendLinePaneView[];

  constructor(p1: Point, p2: Point) {
    this.p1 = p1; // { time, price }
    this.p2 = p2;
    this.hoveredPoint = null;
    this._paneViews = [new TrendLinePaneView(this)];
  }

  attached({
    chart,
    series,
    requestUpdate,
  }: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chart = chart;
    this.series = series;
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews() {
    return this._paneViews;
  }

  // 更新点位并触发重绘
  updatePoint(index: 1 | 2, newPoint: Point) {
    if (index === 1) this.p1 = newPoint;
    if (index === 2) this.p2 = newPoint;
    if (this.requestUpdate) this.requestUpdate();
  }

  setHoveredPoint(pointIndex: 1 | 2 | null) {
    if (this.hoveredPoint !== pointIndex) {
      this.hoveredPoint = pointIndex;
      if (this.requestUpdate) this.requestUpdate();
    }
  }
}

// ==========================================
// 2. 模拟 K 线数据生成器
// ==========================================
function generateMockData(): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  // 对齐到 UTC 零点避免 timescale 警告
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  let time = (Math.floor(d.getTime() / 1000) - 100 * 86400) as Time;
  let close = 100;

  for (let i = 0; i < 100; i++) {
    const open = close + (Math.random() - 0.5) * 5;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    close = open + (Math.random() - 0.5) * 5;
    // @ts-ignore
    data.push({ time: (time + i * 86400) as Time, open, high, low, close });
  }
  return data;
}

interface ChartState {
  lines: TrendLinePrimitive[];
  mode: "idle" | "draw";
  activeLine: TrendLinePrimitive | null;
  dragPointIndex: 1 | 2 | null;
  isDrawing: boolean;
  currentMouseX: number | null;
  currentMouseY: number | null;
  currentLogical: Point | null;
}

// ==========================================
// 3. React 主组件 (状态机与交互管理)
// ==========================================
export default function ChartApp() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // 工具栏状态
  const [mode, setMode] = useState<"idle" | "draw">("idle"); // 'idle' | 'draw'
  const [lines, setLines] = useState<TrendLinePrimitive[]>([]); // 仅作 UI 记录，实际渲染靠 linesRef

  // 交互控制 Ref (避免触发 React 频繁重新渲染)
  const stateRef = useRef<ChartState>({
    lines: [],
    mode: "idle",
    activeLine: null,
    dragPointIndex: null, // 1 或 2
    isDrawing: false,
    currentMouseX: null,
    currentMouseY: null,
    currentLogical: null, // { time, price }
  });

  // 初始化图表与事件绑定
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. 初始化图表
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#f0f3fa" },
        horzLines: { color: "#f0f3fa" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      width: chartContainerRef.current.clientWidth,
      height: 600,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#ef5350",
      downColor: "#26a69a",
      borderVisible: false,
      wickUpColor: "#ef5350",
      wickDownColor: "#26a69a",
    });

    // @ts-ignore
    series.setData(generateMockData());
    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
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
        const container = chartContainerRef.current;
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

      if (!chartContainerRef.current) return;

      for (const line of state.lines) {
        if (line.hoveredPoint !== null) {
          state.dragPointIndex = line.hoveredPoint;
          state.activeLine = line;

          // 【关键】：开始拖拽时，禁用图表的原生滑动和缩放
          chart.applyOptions({ handleScroll: false, handleScale: false });
          chartContainerRef.current.style.cursor = "grabbing";
          break;
        }
      }
    };

    const mouseupHandler = () => {
      const state = stateRef.current;
      if (state.dragPointIndex !== null) {
        state.dragPointIndex = null;
        state.activeLine = null;

        if (!chartContainerRef.current) return;

        // 【关键】：拖拽结束，恢复图表的滑动和缩放
        chart.applyOptions({ handleScroll: true, handleScale: true });
        chartContainerRef.current.style.cursor = "crosshair";
      }
    };

    // 绑定事件
    chart.subscribeCrosshairMove(crosshairMoveHandler);
    chart.subscribeClick(clickHandler);

    const container = chartContainerRef.current;
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

  // UI 操作逻辑
  const toggleDrawMode = () => {
    const newMode = mode === "idle" ? "draw" : "idle";
    setMode(newMode);
    stateRef.current.mode = newMode;
    if (newMode === "idle" && stateRef.current.isDrawing) {
      stateRef.current.isDrawing = false;
      stateRef.current.activeLine = null;
    }
  };

  const clearAllLines = () => {
    if (!seriesRef.current) return;
    const series = seriesRef.current; // capture for closure
    stateRef.current.lines.forEach((line) => {
      series.detachPrimitive(line);
    });
    stateRef.current.lines = [];
    setLines([]);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-6 font-sans">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
        {/* 工具栏 */}
        <div className="h-16 border-b border-slate-200 flex items-center px-6 justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-800 mr-4">
              自定义画线 K线图
            </h1>

            <button
              onClick={() => {
                setMode("idle");
                stateRef.current.mode = "idle";
              }}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
                mode === "idle"
                  ? "bg-blue-100 text-blue-700"
                  : "hover:bg-slate-200 text-slate-600"
              }`}
              title="指针模式 (可以拖拽图表或拖拽线条端点)"
            >
              <MousePointer2 size={18} />
              <span className="text-sm font-medium">指针模式</span>
            </button>

            <button
              onClick={toggleDrawMode}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
                mode === "draw"
                  ? "bg-blue-100 text-blue-700"
                  : "hover:bg-slate-200 text-slate-600"
              }`}
              title="画线模式 (点击两次生成线条)"
            >
              <Pencil size={18} />
              <span className="text-sm font-medium">画线工具</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              已绘制线条：{lines.length}
            </span>
            <button
              onClick={clearAllLines}
              className="p-2 rounded-lg flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors"
            >
              <Trash2 size={18} />
              <span className="text-sm font-medium">清空全部</span>
            </button>
          </div>
        </div>

        {/* 图表容器 */}
        <div className="flex-1 relative w-full h-full">
          {/* Chart loaded state removed as it is now synchronous */}
          <div
            ref={chartContainerRef}
            className="absolute inset-0 outline-none"
            style={{ cursor: mode === "draw" ? "crosshair" : "default" }}
          />

          {mode === "draw" && (
            <div className="absolute top-4 left-4 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-md animate-pulse pointer-events-none">
              画线模式：在图表上点击两下确定一条线段
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
