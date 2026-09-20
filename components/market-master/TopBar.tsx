import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ChartNoAxesCombined,
  TriangleAlert,
  RefreshCw,
  Scan,
  X,
  History,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

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
  drawAutomaticSegments,
  automaticSegmentCount = 0,
  isAutomaticSegmentBusy = false,
  clearLines,
  isBacktestMode,
  setIsBacktestMode,
  onExitBacktest,
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
  onSyncLatest,
  isSyncingLatest = false,
  onStartKlineRepair,
  isRepairSelecting = false,
  isRepairingKline = false,
  onOpenBacktestHistory,
  isReplayMode = false,
  isReplayFinished = false,
  replayPlayed = 0,
  replayTotal = 0,
  onRestartReplay,
}: any) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSuperuser = !isAuthLoading && Boolean(user?.is_superuser);
  const canSyncLatest = isSuperuser;
  const canUseAutomaticDraw = isSuperuser;
  const [isExitBacktestConfirmOpen, setIsExitBacktestConfirmOpen] =
    useState(false);
  const continueBacktestButtonRef = useRef<HTMLButtonElement>(null);
  const canEnterBacktest =
    !isDataLoading && !dataError && totalCandles >= minBacktestCandles;
  const isBacktestToggleDisabled = !canEnterBacktest;

  let backtestButtonLabel = "开启逐K回测";
  let backtestButtonTitle = `开启逐K回测模式：将从随机合法时间点开始（初始约 ${initialVisibleCount} 根上下文，前方至少保留 ${minForwardCandles} 根可播放）`;
  if (isDataLoading) {
    backtestButtonLabel = "行情加载中，暂不可开启回测";
    backtestButtonTitle =
      "当前品种/周期的 K 线仍在加载，请等待完成后再开启逐K回测";
  } else if (dataError || totalCandles === 0) {
    backtestButtonLabel = "暂无K线数据，无法开启回测";
    backtestButtonTitle = dataError || "暂无可用 K 线数据，无法开启逐K回测";
  } else if (totalCandles < minBacktestCandles) {
    backtestButtonLabel = "历史不足，无法开启回测";
    backtestButtonTitle = `当前品种/周期仅有 ${totalCandles.toLocaleString()} 根 K 线，逐K回测至少需要 ${minBacktestCandles.toLocaleString()} 根（初始可见 ${initialVisibleCount} + 可往前播放 ${minForwardCandles}）。请切换周期或标的后再试。`;
  }

  const compactBacktestButtonLabel = isDataLoading
    ? "行情加载中"
    : dataError || totalCandles === 0
      ? "暂不可回测"
      : totalCandles < minBacktestCandles
        ? "历史不足"
        : "逐K回测";

  useEffect(() => {
    if (!isExitBacktestConfirmOpen || !isBacktestMode) return;

    const previouslyFocusedElement = document.activeElement as HTMLElement;
    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExitBacktestConfirmOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    continueBacktestButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [isBacktestMode, isExitBacktestConfirmOpen]);

  const requireAuthForBacktest = () => {
    if (isAuthLoading) return false;
    if (user) return true;
    const params = new URLSearchParams();
    params.set("callbackUrl", pathname || "/market-master");
    router.push(`/auth?${params.toString()}`);
    return false;
  };

  const handleEnterBacktest = () => {
    if (!canEnterBacktest) return;
    if (!requireAuthForBacktest()) return;

    setIsExitBacktestConfirmOpen(false);
    setIsBacktestMode(true);
  };

  const handleOpenBacktestHistory = () => {
    if (!requireAuthForBacktest()) return;
    onOpenBacktestHistory?.();
  };

  const confirmExitBacktest = () => {
    setIsExitBacktestConfirmOpen(false);
    setIsPlaying(false);
    if (onExitBacktest) {
      onExitBacktest();
      return;
    }
    setIsBacktestMode(false);
  };

  return (
    <>
      <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-900 px-3 py-2 lg:h-16 lg:flex-nowrap lg:gap-6 lg:px-6 lg:py-0">
        <div className="order-2 flex w-full min-w-0 basis-full items-center gap-3 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-1 lg:w-auto lg:flex-1 lg:basis-auto lg:gap-4 lg:pb-0 2xl:overflow-visible">
          <Link
            href="/"
            className="mr-1 flex shrink-0 items-center gap-2 text-lg font-bold text-white transition-colors hover:text-blue-400 lg:mr-4"
            title="返回主页"
          >
            <CircleDollarSign size={28} className="text-blue-500" />
            <span className="hidden sm:inline">复盘模拟交易</span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <SymbolSearchSelect value={symbol} onChange={setSymbol} />
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="h-[50px] cursor-pointer rounded-md border border-gray-700 bg-gray-800 px-2 text-[15px] text-gray-200 outline-none transition-colors hover:bg-gray-700 sm:h-[42px]"
            >
              {timeframeOptions.map((option: any) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SymbolFavoriteButton symbol={symbol} />
            {canSyncLatest ? (
              <>
                <button
                  type="button"
                  onClick={onSyncLatest}
                  disabled={isSyncingLatest || isBacktestMode || isRepairingKline}
                  className="flex h-[50px] shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-[42px]"
                  title={
                    isBacktestMode
                      ? "请先退出逐K回测再同步最新 K 线"
                      : `优先同步当前 ${symbol} ${timeframe} 到最新日期（只补最新缺口，不回补更早历史）`
                  }
                >
                  {isSyncingLatest ? (
                    <Loader2 size={16} className="shrink-0 animate-spin" />
                  ) : (
                    <RefreshCw size={16} className="shrink-0" />
                  )}
                  <span className="hidden xl:inline">
                    {isSyncingLatest ? "同步中" : "同步最新"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onStartKlineRepair}
                  disabled={
                    isSyncingLatest ||
                    isRepairingKline ||
                    isBacktestMode ||
                    isDataLoading ||
                    Boolean(dataError) ||
                    totalCandles === 0
                  }
                  className={`flex h-[50px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-[42px] ${
                    isRepairSelecting
                      ? "border-amber-400 bg-amber-500/30 text-amber-100"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  }`}
                  title={
                    isBacktestMode
                      ? "请先退出逐K回测再修复 K 线"
                      : isRepairSelecting
                        ? "正在框选时间段，再次点击可取消"
                        : "框选可能有问题的 K 线时间段，优先向福汇重采并以新数据覆盖差异"
                  }
                >
                  {isRepairingKline ? (
                    <Loader2 size={16} className="shrink-0 animate-spin" />
                  ) : (
                    <Scan size={16} className="shrink-0" />
                  )}
                  <span className="hidden xl:inline">
                    {isRepairingKline
                      ? "修复中"
                      : isRepairSelecting
                        ? "框选中"
                        : "修复K线"}
                  </span>
                </button>
              </>
            ) : null}
          </div>

          {isDataLoading ? (
            <div className="text-xs text-blue-400 shrink-0">
              加载真实行情中...
            </div>
          ) : !isHistoryLoading && dataError ? (
            <div
              className="max-w-56 truncate text-xs text-red-400"
              title={dataError}
            >
              {dataError}
            </div>
          ) : null}

          <div className="ml-1 flex h-[50px] shrink-0 gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1 sm:h-[42px] lg:ml-2">
            <button
              onClick={() => setMode("idle")}
              className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
                mode === "idle"
                  ? "bg-gray-700 text-blue-400"
                  : "hover:bg-gray-700 text-gray-400"
              }`}
              title="指针模式 (平移/选中/右键配置)"
            >
              <MousePointer2 size={20} />
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
              <Minus size={20} />
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
              <Square size={18} />
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
              <AlignJustify size={20} />
            </button>
            {canUseAutomaticDraw ? (
              <>
                <button
                  onClick={drawAutomaticPens}
                  disabled={
                    isDataLoading || Boolean(dataError) || totalCandles === 0
                  }
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
                  <ChartSpline size={20} />
                </button>
                <button
                  onClick={drawAutomaticSegments}
                  disabled={
                    isDataLoading ||
                    Boolean(dataError) ||
                    totalCandles === 0 ||
                    isAutomaticSegmentBusy
                  }
                  aria-pressed={automaticSegmentCount > 0}
                  aria-busy={isAutomaticSegmentBusy}
                  className={`flex items-center rounded-md p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:p-1.5 ${
                    automaticSegmentCount > 0
                      ? "bg-gray-700 text-green-400"
                      : "text-gray-400 hover:bg-gray-700 hover:text-green-400"
                  }`}
                  title={
                    isAutomaticSegmentBusy
                      ? "正在分批更新 Segments，请稍候..."
                      : automaticSegmentCount > 0
                        ? `重画 Segments（已绘制 ${automaticSegmentCount} 段，快捷键 R）`
                        : "自动绘制 Segments（快捷键 R）"
                  }
                >
                  {isAutomaticSegmentBusy ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <ChartNoAxesCombined size={20} />
                  )}
                </button>
              </>
            ) : null}
            <button
              onClick={clearLines}
              disabled={isAutomaticSegmentBusy}
              className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 sm:p-2"
              title={
                isAutomaticSegmentBusy
                  ? "正在更新 Segments，请稍候..."
                  : "清空画线"
              }
            >
              <Trash2 size={20} />
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
              <Magnet size={20} />
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
              <ArrowUpDown size={20} />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1 self-center"></div>
            <button
              onClick={() => setIsIndicatorModalOpen(true)}
              className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-blue-400 sm:p-2"
              title="指标配置中心 (Indicators)"
            >
              <BarChart2 size={20} />
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

          {!isBacktestMode ? (
            <>
              <button
                type="button"
                onClick={handleOpenBacktestHistory}
                className="ml-1 flex shrink-0 items-center gap-2 rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700 lg:ml-3"
                title="查看回测记录并还原播放"
              >
                <History size={16} className="shrink-0" />
                <span className="2xl:hidden">记录</span>
                <span className="hidden 2xl:inline">回测记录</span>
              </button>
              <button
                onClick={handleEnterBacktest}
                disabled={isBacktestToggleDisabled}
                className="ml-1 flex shrink-0 items-center gap-2 rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={backtestButtonTitle}
              >
                {isDataLoading ? (
                  <Loader2 size={16} className="shrink-0 animate-spin" />
                ) : (
                  <StepForward size={16} className="shrink-0" />
                )}
                <span className="2xl:hidden">{compactBacktestButtonLabel}</span>
                <span className="hidden 2xl:inline">{backtestButtonLabel}</span>
              </button>

              {isHistoryLoading && (
                <div className="ml-1 shrink-0 text-xs text-blue-300">
                  正在按需加载历史 K 线
                </div>
              )}
            </>
          ) : (
            <div className="ml-1 flex shrink-0 items-center gap-3 rounded-full border border-gray-700 bg-gray-800 px-4 py-1.5 lg:ml-3">
              <span
                className={`min-w-36 text-center text-sm ${
                  isReplayMode && isReplayFinished
                    ? "font-semibold text-amber-300"
                    : "text-gray-400"
                }`}
              >
                {isReplayMode
                  ? isReplayFinished
                    ? "回放已结束"
                    : `回放 ${replayPlayed} / ${replayTotal}`
                  : `K线: ${currentIndex} / ${totalCandles.toLocaleString()}`}
              </span>
              <button
                onClick={handleNextCandle}
                disabled={
                  isDataLoading ||
                  isPlaying ||
                  (isReplayMode
                    ? isReplayFinished
                    : currentIndex >= totalCandles)
                }
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white disabled:opacity-50"
                title={
                  isReplayMode && isReplayFinished
                    ? "回放已结束"
                    : "步进一根 K 线（快捷键 D）"
                }
              >
                <StepForward size={18} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={
                  isDataLoading ||
                  (isReplayMode
                    ? isReplayFinished
                    : currentIndex >= totalCandles)
                }
                className={`p-1.5 rounded text-white disabled:opacity-50 ${
                  isPlaying
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
                title={
                  isReplayMode && isReplayFinished
                    ? "回放已结束"
                    : isPlaying
                      ? "暂停播放（快捷键 P）"
                      : "自动播放（快捷键 P）"
                }
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              {isReplayMode ? (
                <button
                  type="button"
                  onClick={onRestartReplay}
                  disabled={isDataLoading}
                  className="rounded bg-blue-500/15 p-1.5 text-blue-300 transition-colors hover:bg-blue-500/25 hover:text-blue-200 disabled:opacity-50"
                  title="从头播放"
                  aria-label="从头播放"
                >
                  <RotateCcw size={18} />
                </button>
              ) : null}
              <div className="h-5 w-px bg-gray-600" />
              <button
                type="button"
                onClick={() => setIsExitBacktestConfirmOpen(true)}
                className="rounded bg-red-500/15 p-1.5 text-red-400 transition-colors hover:bg-red-500/25 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400"
                title={isReplayMode ? "退出回测回放" : "退出逐K回测"}
                aria-label={isReplayMode ? "退出回测回放" : "退出逐K回测"}
                aria-haspopup="dialog"
                aria-expanded={isExitBacktestConfirmOpen}
              >
                <Square size={18} fill="currentColor" />
              </button>
            </div>
          )}
        </div>

        <div className="order-1 ml-auto flex w-full shrink-0 items-center justify-end gap-3 lg:order-2 lg:w-auto lg:gap-6">
          <div className="flex flex-col items-end leading-tight">
            <span className="hidden text-xs text-gray-500 sm:inline">
              账户余额
            </span>
            <span className="font-mono text-sm font-bold text-white sm:text-base">
              ${balance.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="hidden text-xs text-gray-500 sm:inline">
              未结盈亏
            </span>
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

      {isExitBacktestConfirmOpen &&
        isBacktestMode &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setIsExitBacktestConfirmOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-backtest-dialog-title"
              aria-describedby="exit-backtest-dialog-description"
              className="w-full max-w-md overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
                <div className="flex items-center gap-2">
                  <TriangleAlert size={20} className="text-amber-400" />
                  <h2
                    id="exit-backtest-dialog-title"
                    className="text-base font-bold text-white"
                  >
                    {isReplayMode ? "确认退出回测回放？" : "确认退出逐K回测？"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExitBacktestConfirmOpen(false)}
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                  aria-label="关闭确认弹窗"
                  title="关闭"
                >
                  <X size={18} />
                </button>
              </div>

              <div
                id="exit-backtest-dialog-description"
                className="space-y-2 px-5 py-5 text-sm leading-6 text-gray-300"
              >
                <p>
                  {isReplayMode
                    ? "退出后将结束当前回测回放，并返回最新行情。"
                    : "退出后将结束当前逐K回测，并返回最新行情。"}
                </p>
                <p className="text-gray-400">
                  {isReplayMode
                    ? "回放进度不会写入新的回测记录。"
                    : "当前回测播放位置将不会保留。"}
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-700 px-5 py-4">
                <button
                  ref={continueBacktestButtonRef}
                  type="button"
                  onClick={() => setIsExitBacktestConfirmOpen(false)}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isReplayMode ? "继续回放" : "继续回测"}
                </button>
                <button
                  type="button"
                  onClick={confirmExitBacktest}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  确认退出
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
