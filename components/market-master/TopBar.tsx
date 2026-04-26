import React from "react";
import {
  CircleDollarSign,
  MousePointer2,
  Minus,
  Square,
  AlignJustify,
  Magnet,
  Sparkles,
  Loader2,
  BarChart2,
  Trash2,
  StepForward,
  Pause,
  Play,
} from "lucide-react";

export const TopBar = ({
  symbol,
  setSymbol,
  timeframe,
  setTimeframe,
  mode,
  setMode,
  drawType,
  setDrawingTool,
  isMagnetEnabled,
  setIsMagnetEnabled,
  handleAIChartAnalysis,
  isAIAnalyzing,
  setIsIndicatorModalOpen,
  clearLines,
  currentIndex,
  handleNextCandle,
  isPlaying,
  setIsPlaying,
  balance,
  totalFloatingPnl,
}: any) => {
  return (
    <div className="h-16 border-b border-gray-800 flex items-center px-6 justify-between bg-gray-900 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-white mr-4 flex items-center gap-2">
          <CircleDollarSign className="text-blue-500" /> 复盘模拟交易
        </h1>

        <div className="flex gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 outline-none hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <option value="XAU/USD">XAU/USD</option>
            <option value="GBP/USD">GBP/USD</option>
            <option value="EUR/USD">EUR/USD</option>
          </select>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 outline-none hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <option value="D1">D1</option>
            <option value="H4">H4</option>
            <option value="m30">m30</option>
          </select>
        </div>

        <div className="flex bg-gray-800 rounded-lg p-1 gap-1 border border-gray-700 ml-2">
          <button
            onClick={() => setMode("idle")}
            className={`p-1.5 rounded-md flex items-center transition-colors ${
              mode === "idle"
                ? "bg-gray-700 text-blue-400"
                : "hover:bg-gray-700 text-gray-400"
            }`}
            title="指针模式 (平移/选中/右键配置)"
          >
            <MousePointer2 size={16} />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1 self-center"></div>
          <button
            onClick={() => setDrawingTool("line")}
            className={`p-1.5 rounded-md flex items-center transition-colors ${
              mode === "draw" && drawType === "line"
                ? "bg-gray-700 text-blue-400"
                : "hover:bg-gray-700 text-gray-400"
            }`}
            title="画直线 (Trend Line)"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setDrawingTool("rectangle")}
            className={`p-1.5 rounded-md flex items-center transition-colors ${
              mode === "draw" && drawType === "rectangle"
                ? "bg-gray-700 text-blue-400"
                : "hover:bg-gray-700 text-gray-400"
            }`}
            title="画阻力矩形 (Rectangle)"
          >
            <Square size={14} />
          </button>
          <button
            onClick={() => setDrawingTool("fib")}
            className={`p-1.5 rounded-md flex items-center transition-colors ${
              mode === "draw" && drawType === "fib"
                ? "bg-gray-700 text-blue-400"
                : "hover:bg-gray-700 text-gray-400"
            }`}
            title="斐波那契回调 (Fib Retracement)"
          >
            <AlignJustify size={16} />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1 self-center"></div>
          <button
            onClick={() => setIsMagnetEnabled(!isMagnetEnabled)}
            className={`p-1.5 rounded-md flex items-center transition-colors ${
              isMagnetEnabled
                ? "bg-gray-700 text-blue-400"
                : "hover:bg-gray-700 text-gray-400"
            }`}
            title={
              isMagnetEnabled ? "关闭磁力吸附" : "开启磁力吸附 (快捷精准画图)"
            }
          >
            <Magnet size={16} />
          </button>
        </div>

        <button
          onClick={handleAIChartAnalysis}
          disabled={isAIAnalyzing}
          className="flex items-center gap-1.5 ml-3 px-3 py-1.5 rounded-lg bg-linear-to-r from-indigo-600/20 to-purple-600/20 hover:from-indigo-600 hover:to-purple-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all font-bold text-xs shadow-[0_0_10px_rgba(79,70,229,0.15)] disabled:opacity-50"
          title="AI 自动扫描盘面形态、支撑阻力与趋势"
        >
          {isAIAnalyzing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          AI 智能扫描
        </button>

        <button
          onClick={() => setIsIndicatorModalOpen(true)}
          className="p-2 ml-auto rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors"
          title="指标配置中心 (Indicators)"
        >
          <BarChart2 size={18} />
        </button>
        <button
          onClick={clearLines}
          className="p-2 ml-1 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
          title="清空画线"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3 bg-gray-800 px-4 py-1.5 rounded-full border border-gray-700">
        <span className="text-xs text-gray-400 w-24 text-center">
          K线: {currentIndex} / 500
        </span>
        <button
          onClick={handleNextCandle}
          disabled={isPlaying || currentIndex >= 500}
          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white disabled:opacity-50"
          title="步进一根 K线"
        >
          <StepForward size={16} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={currentIndex >= 500}
          className={`p-1.5 rounded text-white disabled:opacity-50 ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-500"
              : "bg-blue-600 hover:bg-blue-500"
          }`}
          title={isPlaying ? "暂停播放" : "自动播放"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500">账户余额</span>
          <span className="font-mono font-bold text-white">
            ${balance.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500">未结盈亏</span>
          <span
            className={`font-mono font-bold ${
              totalFloatingPnl >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {totalFloatingPnl > 0 ? "+" : ""}
            {totalFloatingPnl.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
