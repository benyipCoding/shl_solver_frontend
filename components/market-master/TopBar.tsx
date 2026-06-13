import React from "react";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import { SymbolSearchSelect } from "@/components/market-master/SymbolSearchSelect";
import {
  CircleDollarSign,
  MousePointer2,
  Minus,
  Square,
  AlignJustify,
  Magnet,
  ArrowUpDown,
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
  timeframeOptions,
  mode,
  setMode,
  drawType,
  setDrawingTool,
  isMagnetEnabled,
  setIsMagnetEnabled,
  isRightPriceAutoScaleEnabled,
  setIsRightPriceAutoScaleEnabled,
  handleAIChartAnalysis,
  isAIAnalyzing,
  setIsIndicatorModalOpen,
  clearLines,
  isBacktestMode,
  setIsBacktestMode,
  currentIndex,
  totalCandles,
  handleNextCandle,
  isPlaying,
  setIsPlaying,
  isDataLoading,
  dataError,
  balance,
  totalFloatingPnl,
}: any) => {
  return (
    <div className="h-16 border-b border-gray-800 flex items-center px-6 bg-gray-900 shrink-0 gap-6">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <h1 className="text-lg font-bold text-white mr-4 flex items-center gap-2">
          <CircleDollarSign className="text-blue-500" /> 复盘模拟交易
        </h1>

        <div className="flex gap-2">
          <SymbolSearchSelect value={symbol} onChange={setSymbol} />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 outline-none hover:bg-gray-700 transition-colors cursor-pointer"
          >
            {timeframeOptions.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isDataLoading ? (
          <div className="text-xs text-blue-400 shrink-0">
            加载真实行情中...
          </div>
        ) : dataError ? (
          <div
            className="max-w-56 truncate text-xs text-red-400"
            title={dataError}
          >
            {dataError}
          </div>
        ) : null}

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
          <button
            onClick={clearLines}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
            title="清空画线"
          >
            <Trash2 size={18} />
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
          <button
            onClick={() =>
              setIsRightPriceAutoScaleEnabled(!isRightPriceAutoScaleEnabled)
            }
            className={`p-1.5 rounded-md flex items-center transition-colors ${
              isRightPriceAutoScaleEnabled
                ? "bg-gray-700 text-blue-400"
                : "hover:bg-gray-700 text-gray-400"
            }`}
            title={
              isRightPriceAutoScaleEnabled
                ? "关闭右侧价格轴自动缩放"
                : "开启右侧价格轴自动缩放"
            }
          >
            <ArrowUpDown size={16} />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1 self-center"></div>
          <button
            onClick={() => setIsIndicatorModalOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors"
            title="指标配置中心 (Indicators)"
          >
            <BarChart2 size={18} />
          </button>
        </div>

        <button
          onClick={handleAIChartAnalysis}
          disabled={isAIAnalyzing || isDataLoading || totalCandles === 0}
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
          onClick={() => setIsBacktestMode(!isBacktestMode)}
          disabled={isDataLoading || totalCandles === 0}
          className={`ml-3 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            isBacktestMode
              ? "border-blue-500/50 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30"
              : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
          title={isBacktestMode ? "退出逐K回测模式" : "开启逐K回测模式"}
        >
          <StepForward size={14} />
          {isBacktestMode ? "退出逐K回测" : "开启逐K回测"}
        </button>

        {isBacktestMode && (
          <div className="flex items-center gap-3 bg-gray-800 px-4 py-1.5 rounded-full border border-gray-700 shrink-0">
            <span className="text-xs text-gray-400 w-32 text-center">
              K线: {currentIndex} / {totalCandles.toLocaleString()}
            </span>
            <button
              onClick={handleNextCandle}
              disabled={
                isDataLoading || isPlaying || currentIndex >= totalCandles
              }
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white disabled:opacity-50"
              title="步进一根 K线"
            >
              <StepForward size={16} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={isDataLoading || currentIndex >= totalCandles}
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
        )}
      </div>

      <div className="flex items-center gap-6 shrink-0">
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
        <UserHeaderActions simpleMode={true} />
      </div>
    </div>
  );
};
