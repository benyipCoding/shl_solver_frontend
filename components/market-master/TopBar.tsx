import React from "react";
import Link from "next/link";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import {
  SymbolFavoriteButton,
  SymbolSearchSelect,
} from "@/components/market-master/SymbolSearchSelect";
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
  ChartSpline,
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
  drawAutomaticPens,
  automaticPenCount = 0,
  clearLines,
  isBacktestMode,
  setIsBacktestMode,
  currentIndex,
  totalCandles,
  handleNextCandle,
  isPlaying,
  setIsPlaying,
  isDataLoading,
  isHistoryLoading = false,
  dataError,
  balance,
  totalFloatingPnl,
  minBacktestCandles = 2200,
  initialVisibleCount = 200,
  minForwardCandles = 2000,
}: any) => {
  const canEnterBacktest =
    !isDataLoading &&
    !isHistoryLoading &&
    !dataError &&
    totalCandles >= minBacktestCandles;
  const isBacktestToggleDisabled = !isBacktestMode && !canEnterBacktest;

  let backtestButtonLabel = "开启逐K回测";
  let backtestButtonTitle = `开启逐K回测模式：将从随机合法时间点开始（初始约 ${initialVisibleCount} 根上下文，前方至少保留 ${minForwardCandles} 根可播放）`;
  if (isBacktestMode) {
    backtestButtonLabel = "退出逐K回测";
    backtestButtonTitle = "退出逐K回测模式";
  } else if (isDataLoading) {
    backtestButtonLabel = "行情加载中，暂不可开启回测";
    backtestButtonTitle =
      "当前品种/周期的 K 线仍在加载，请等待完成后再开启逐K回测";
  } else if (isHistoryLoading) {
    backtestButtonLabel = "历史K线加载中...";
    backtestButtonTitle =
      "正在分页拉取该品种当前周期的全部历史 K 线，请等待全部加载完成后再开启逐K回测";
  } else if (dataError || totalCandles === 0) {
    backtestButtonLabel = "暂无K线数据，无法开启回测";
    backtestButtonTitle = dataError || "暂无可用 K 线数据，无法开启逐K回测";
  } else if (totalCandles < minBacktestCandles) {
    backtestButtonLabel = "历史不足，无法开启回测";
    backtestButtonTitle = `当前品种/周期仅有 ${totalCandles.toLocaleString()} 根 K 线，逐K回测至少需要 ${minBacktestCandles.toLocaleString()} 根（初始可见 ${initialVisibleCount} + 可往前播放 ${minForwardCandles}）。请切换周期或标的后再试。`;
  }

  const compactBacktestButtonLabel = isBacktestMode
    ? "退出回测"
    : isDataLoading
      ? "行情加载中"
      : isHistoryLoading
        ? "历史加载中"
        : dataError || totalCandles === 0
          ? "暂不可回测"
          : totalCandles < minBacktestCandles
            ? "历史不足"
            : "逐K回测";

  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-900 px-3 py-2 lg:h-16 lg:flex-nowrap lg:gap-6 lg:px-6 lg:py-0">
      <div className="order-2 flex w-full min-w-0 basis-full items-center gap-3 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-1 lg:w-auto lg:flex-1 lg:basis-auto lg:gap-4 lg:pb-0 2xl:overflow-visible">
        <Link
          href="/"
          className="mr-1 flex shrink-0 items-center gap-2 text-lg font-bold text-white transition-colors hover:text-blue-400 lg:mr-4"
          title="返回主页"
        >
          <CircleDollarSign className="text-blue-500" />
          <span className="hidden sm:inline">复盘模拟交易</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <SymbolSearchSelect value={symbol} onChange={setSymbol} />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="cursor-pointer rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-gray-200 outline-none transition-colors hover:bg-gray-700 sm:py-1"
          >
            {timeframeOptions.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <SymbolFavoriteButton symbol={symbol} />
        </div>

        {isDataLoading ? (
          <div className="text-xs text-blue-400 shrink-0">
            加载真实行情中...
          </div>
        ) : isHistoryLoading ? (
          <div className="text-xs text-blue-300 shrink-0">
            加载历史 K 线中 ({totalCandles.toLocaleString()} 根)...
          </div>
        ) : dataError ? (
          <div
            className="max-w-56 truncate text-xs text-red-400"
            title={dataError}
          >
            {dataError}
          </div>
        ) : null}

        <div className="ml-1 flex shrink-0 gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1 lg:ml-2">
          <button
            onClick={() => setMode("idle")}
            className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
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
            className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
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
            className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
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
            className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
              mode === "draw" && drawType === "fib"
                ? "bg-gray-700 text-blue-400"
                : "hover:bg-gray-700 text-gray-400"
            }`}
            title="斐波那契回调 (Fib Retracement)"
          >
            <AlignJustify size={16} />
          </button>
          <button
            onClick={drawAutomaticPens}
            disabled={isDataLoading || Boolean(dataError) || totalCandles === 0}
            aria-pressed={automaticPenCount > 0}
            className={`flex items-center rounded-md p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:p-1.5 ${
              automaticPenCount > 0
                ? "bg-gray-700 text-yellow-300"
                : "text-gray-400 hover:bg-gray-700 hover:text-yellow-300"
            }`}
            title={
              automaticPenCount > 0
                ? `重画当前可视区 Pens（已绘制 ${automaticPenCount} 笔，快捷键 F）`
                : "自动绘制当前可视区 Pens（快捷键 F）"
            }
          >
            <ChartSpline size={16} />
          </button>
          <button
            onClick={clearLines}
            className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400 sm:p-2"
            title="清空画线"
          >
            <Trash2 size={18} />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1 self-center"></div>

          <button
            onClick={() => setIsMagnetEnabled(!isMagnetEnabled)}
            className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
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
            className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
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
            className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-blue-400 sm:p-2"
            title="指标配置中心 (Indicators)"
          >
            <BarChart2 size={18} />
          </button>
        </div>

        {/* <button
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
        </button> */}

        <button
          onClick={() => {
            if (!isBacktestMode && !canEnterBacktest) return;
            setIsBacktestMode(!isBacktestMode);
          }}
          disabled={isBacktestToggleDisabled}
          className={`ml-1 flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:ml-3 ${
            isBacktestMode
              ? "border-blue-500/50 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30"
              : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
          title={backtestButtonTitle}
        >
          {!isBacktestMode && (isDataLoading || isHistoryLoading) ? (
            <Loader2 size={14} className="animate-spin shrink-0" />
          ) : (
            <StepForward size={14} className="shrink-0" />
          )}
          <span className="2xl:hidden">{compactBacktestButtonLabel}</span>
          <span className="hidden 2xl:inline">{backtestButtonLabel}</span>
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

      <div className="order-1 ml-auto flex w-full shrink-0 items-center justify-end gap-3 lg:order-2 lg:w-auto lg:gap-6">
        <div className="flex flex-col items-end leading-tight">
          <span className="hidden text-xs text-gray-500 sm:inline">账户余额</span>
          <span className="font-mono text-sm font-bold text-white sm:text-base">
            ${balance.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="hidden text-xs text-gray-500 sm:inline">未结盈亏</span>
          <span
            className={`font-mono text-sm font-bold sm:text-base ${
              totalFloatingPnl >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {totalFloatingPnl > 0 ? "+" : ""}
            {totalFloatingPnl.toFixed(2)}
          </span>
        </div>
        <UserHeaderActions simpleMode={true} />
      </div>
    </header>
  );
};
