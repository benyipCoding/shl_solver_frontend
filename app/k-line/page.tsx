"use client";

import { useRef, useState } from "react";
import { Pencil, MousePointer2, Trash2 } from "lucide-react";
import { TrendLinePrimitive } from "@/utils/k-line/trend-line";
import { ChartState, useChart } from "@/hooks/useChart";

// ==========================================
// 3. React 主组件 (状态机与交互管理)
// ==========================================
export default function ChartApp() {
  const chartContainerRef = useRef<HTMLDivElement>(null);

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

  const { seriesRef } = useChart({
    containerRef: chartContainerRef,
    mode,
    setMode,
    setLines,
    stateRef,
  });

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
