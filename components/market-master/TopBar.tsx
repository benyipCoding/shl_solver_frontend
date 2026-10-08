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
  PanelTopDashed,
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
  Bot,
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
  isAutomaticPensEnabled = false,
  onToggleAutomaticPens,
  penMode = "simple",
  onPenModeChange,
  penModeLocked = false,
  automaticPenCount = 0,
  isAutomaticSegmentsEnabled = false,
  onToggleAutomaticSegments,
  automaticSegmentCount = 0,
  isAutomaticSegmentBusy = false,
  onToggleSupportResistance,
  isSupportResistanceEnabled = false,
  supportResistanceCount = 0,
  isSupportResistanceBusy = false,
  supportResistanceError = null,
  clearLines,
  isBacktestMode,
  setIsBacktestMode,
  onExitBacktest,
  currentIndex,
  totalCandles,
  handleNextCandle,
  isAutomaticTradingEnabled = false,
  automaticStepCandles = 1000,
  onToggleAutomaticTrading,
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
  onRestartBacktest,
  canRestartBacktest = false,
  isRestartingBacktest = false,
  isAutomaticRunBusy = false,
}: any) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSuperuser = !isAuthLoading && Boolean(user?.is_superuser);
  const canSyncLatest = isSuperuser;
  const canUseAutomaticDraw = isSuperuser;
  const batchTrading = isAutomaticTradingEnabled && !isReplayMode;
  const penModeLabel = penMode === "strict" ? "严格笔" : "简单笔";
  const penModeSelect = <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400"
    title={penModeLocked ? "本轮已有交易，请先从头再跑后切换" : "严格笔：至少5根且达到起点ATR门槛，或两端跨度至少15根；图表和交易策略共用"}>
    <span className="md:hidden">分笔算法</span>
    <select aria-label="分笔算法" value={penMode} onChange={(event) => onPenModeChange?.(event.target.value)}
      disabled={!onPenModeChange || penModeLocked || isDataLoading || isHistoryLoading || isAutomaticRunBusy || isRestartingBacktest || isReplayMode}
      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-yellow-300 outline-none disabled:opacity-40">
      <option value="simple">简单笔</option><option value="strict">严格笔</option>
    </select>
    {penModeLocked && <span className="md:hidden">从头再跑后可切换</span>}
  </label>;
  const showRestartBacktest = isSuperuser && !isReplayMode && Boolean(onRestartBacktest);
  const restartDisabled = !canRestartBacktest || isDataLoading || isHistoryLoading || Boolean(dataError) || isAutomaticRunBusy || isRestartingBacktest;
  const restartTitle = "剩余持仓按当前价格平仓并保存上一轮，保留同一样本和策略配置，重置账户与进度；可改参数后再播放";
  const stepLabel = batchTrading ? `推进 ${automaticStepCandles} 根 K 线` : "下一根K线";
  const playLabel = batchTrading ? "运行策略到结尾" : isPlaying ? "暂停播放" : "自动播放";
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
      <header className="relative z-40 shrink-0 border-b border-slate-800/80 bg-gray-900/95 px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur lg:flex lg:h-16 lg:flex-nowrap lg:items-center lg:gap-6 lg:px-6 lg:py-0">
        <div className="flex flex-col gap-2 lg:hidden">
          <div
            className={`grid gap-2 ${
              canUseAutomaticDraw
                ? "grid-cols-[minmax(0,1fr)_4rem_2.5rem_2.5rem]"
                : "grid-cols-[minmax(0,1fr)_5.5rem]"
            }`}
          >
            <div className="min-w-0 [&>div]:w-full [&_button]:h-11 [&_button]:rounded-xl [&_button]:border-slate-700/80 [&_button]:bg-slate-800/80 [&_button]:shadow-sm">
              <SymbolSearchSelect value={symbol} onChange={setSymbol} />
            </div>
            <select
              aria-label="K线周期"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
              className="h-11 w-full cursor-pointer rounded-xl border border-slate-700/80 bg-slate-800/80 px-3 text-center text-sm font-semibold text-slate-100 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {timeframeOptions.map(
                (option: { value: string; label: string }) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )
              )}
            </select>
            {canUseAutomaticDraw ? (
              <>
                <button
                  type="button"
                  onClick={onToggleAutomaticPens}
                  disabled={
                    !isAutomaticPensEnabled &&
                    (isDataLoading || Boolean(dataError) || totalCandles === 0)
                  }
                  aria-label={
                    isAutomaticPensEnabled
                      ? `关闭并删除${penModeLabel}`
                      : `开启${penModeLabel}`
                  }
                  aria-pressed={isAutomaticPensEnabled}
                  className={`relative flex h-11 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                    isAutomaticPensEnabled
                      ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-300"
                      : "border-slate-700/80 bg-slate-800/80 text-slate-400 active:bg-slate-700"
                  }`}
                  title={
                    isAutomaticPensEnabled
                      ? `关闭并删除${penModeLabel}（当前 ${automaticPenCount} 笔）`
                      : `开启${penModeLabel}`
                  }
                >
                  <ChartSpline size={19} />
                  {isAutomaticPensEnabled ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-yellow-300 shadow-[0_0_6px_rgba(253,224,71,0.75)]" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={onToggleAutomaticSegments}
                  disabled={
                    !isAutomaticSegmentsEnabled &&
                    (isDataLoading ||
                      Boolean(dataError) ||
                      totalCandles === 0 ||
                      isAutomaticSegmentBusy)
                  }
                  aria-label={
                    isAutomaticSegmentsEnabled
                      ? "关闭并删除自动 Segments"
                      : "开启自动 Segments"
                  }
                  aria-pressed={isAutomaticSegmentsEnabled}
                  aria-busy={isAutomaticSegmentBusy}
                  className={`relative flex h-11 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                    isAutomaticSegmentsEnabled
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-slate-700/80 bg-slate-800/80 text-slate-400 active:bg-slate-700"
                  }`}
                  title={
                    isAutomaticSegmentBusy
                      ? isAutomaticSegmentsEnabled
                        ? "正在绘制 Segments，点击可取消并删除"
                        : "正在删除 Segments"
                      : isAutomaticSegmentsEnabled
                        ? `关闭并删除自动 Segments（当前 ${automaticSegmentCount} 段）`
                        : "开启自动 Segments"
                  }
                >
                  {isAutomaticSegmentBusy ? (
                    <Loader2 size={19} className="animate-spin" />
                  ) : (
                    <ChartNoAxesCombined size={19} />
                  )}
                  {isAutomaticSegmentsEnabled ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.75)]" />
                  ) : null}
                </button>
              </>
            ) : null}
          </div>

          {canUseAutomaticDraw && penModeSelect}
          {!isBacktestMode ? (
            <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-1 shadow-inner">
              <button
                type="button"
                onClick={handleOpenBacktestHistory}
                className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-300 transition-colors active:bg-slate-800"
                title="查看回测记录并还原播放"
              >
                <History size={18} className="text-slate-400" />
                回测记录
              </button>
              <button
                type="button"
                onClick={handleEnterBacktest}
                disabled={isBacktestToggleDisabled}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.24)] transition-colors active:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
                title={backtestButtonTitle}
              >
                {isDataLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
                {canEnterBacktest ? "开启逐K回测" : compactBacktestButtonLabel}
              </button>
            </div>
          ) : (
            <div
              className={`grid gap-1 rounded-2xl border border-slate-800 bg-slate-950/70 p-1 shadow-inner ${
                showRestartBacktest ? "grid-cols-5" : isReplayMode || isSuperuser ? "grid-cols-4" : "grid-cols-3"
              }`}
            >
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={
                  isDataLoading ||
                  (isReplayMode
                    ? isReplayFinished
                    : currentIndex >= totalCandles)
                }
                aria-label={playLabel}
                className={`flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors disabled:opacity-35 ${
                  isPlaying
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-blue-500/15 text-blue-300 active:bg-blue-500/25"
                }`}
              >
                {isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
                <span>{batchTrading ? "运行到结尾" : isPlaying ? "暂停" : "播放"}</span>
              </button>
              <button
                type="button"
                onClick={handleNextCandle}
                disabled={
                  isDataLoading ||
                  isPlaying ||
                  (isReplayMode
                    ? isReplayFinished
                    : currentIndex >= totalCandles)
                }
                aria-label={stepLabel}
                className="flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-slate-300 transition-colors active:bg-slate-800 disabled:opacity-35"
              >
                <StepForward size={20} />
                <span>{batchTrading ? `推进 ${automaticStepCandles} 根` : "下一根"}</span>
              </button>
              {isReplayMode ? (
                <button
                  type="button"
                  onClick={onRestartReplay}
                  disabled={isDataLoading}
                  aria-label="从头播放"
                  className="flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-slate-300 transition-colors active:bg-slate-800 disabled:opacity-35"
                >
                  <RotateCcw size={20} />
                  <span>重播</span>
                </button>
              ) : isSuperuser ? (
                <button
                  type="button"
                  aria-label="自动做单"
                  aria-haspopup="dialog"
                  aria-pressed={isAutomaticTradingEnabled}
                  onClick={onToggleAutomaticTrading}
                  disabled={
                    isDataLoading ||
                    Boolean(dataError) ||
                    (!isAutomaticTradingEnabled && isHistoryLoading)
                  }
                  className={`relative flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors disabled:opacity-35 ${
                    isAutomaticTradingEnabled
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-slate-300 active:bg-slate-800"
                  }`}
                >
                  <Bot size={20} />
                  <span>自动做单</span>
                  <span
                    className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
                      isAutomaticTradingEnabled
                        ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                        : "bg-slate-600"
                    }`}
                  />
                </button>
              ) : null}
              {showRestartBacktest && <button type="button" onClick={onRestartBacktest} disabled={restartDisabled}
                aria-label="从头再跑" title={restartTitle}
                className="flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-blue-300 transition-colors active:bg-blue-500/15 disabled:opacity-35">
                <RotateCcw size={20} /><span>从头再跑</span>
              </button>}
              <button
                type="button"
                onClick={() => setIsExitBacktestConfirmOpen(true)}
                className="flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-rose-400 transition-colors active:bg-rose-500/10"
                aria-label={isReplayMode ? "退出回测回放" : "退出逐K回测"}
                aria-haspopup="dialog"
                aria-expanded={isExitBacktestConfirmOpen}
              >
                <Square size={18} fill="currentColor" />
                <span>退出</span>
              </button>
            </div>
          )}
        </div>

        <div className="order-2 hidden w-full min-w-0 basis-full flex-wrap items-center gap-2 lg:order-1 lg:flex lg:w-auto lg:flex-1 lg:basis-auto lg:flex-nowrap lg:gap-4 lg:overflow-x-auto lg:overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden 2xl:overflow-visible">
          <Link
            href="/"
            className="mr-1 hidden shrink-0 items-center gap-2 text-lg font-bold text-white transition-colors hover:text-blue-400 lg:mr-4 lg:flex"
            title="返回主页"
          >
            <CircleDollarSign size={28} className="text-blue-500" />
            <span className="hidden sm:inline">复盘模拟交易</span>
          </Link>

          <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
            <SymbolSearchSelect value={symbol} onChange={setSymbol} />
            <select
              aria-label="K线周期"
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
            <div className="hidden lg:block">
              <SymbolFavoriteButton symbol={symbol} />
            </div>
            {canSyncLatest ? (
              <>
                <button
                  type="button"
                  onClick={onSyncLatest}
                  disabled={isSyncingLatest || isBacktestMode || isRepairingKline}
                  className="hidden h-[42px] shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 lg:flex"
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
                  className={`hidden h-[42px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:flex ${
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
            <div className="hidden shrink-0 text-xs text-blue-400 lg:block">
              加载真实行情中...
            </div>
          ) : !isHistoryLoading && dataError ? (
            <div
              className="hidden max-w-56 truncate text-xs text-red-400 lg:block"
              title={dataError}
            >
              {dataError}
            </div>
          ) : null}

          <div className="ml-2 hidden h-[42px] shrink-0 gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1 lg:flex">
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
              title="画普通矩形 (Rectangle)"
            >
              <Square size={18} />
            </button>
            <button
              type="button"
              onClick={() => setDrawingTool("zone")}
              aria-label="手动支撑/阻力区"
              aria-pressed={mode === "draw" && drawType === "zone"}
              className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 ${
                mode === "draw" && drawType === "zone"
                  ? "bg-gray-700 text-purple-300"
                  : "hover:bg-gray-700 text-gray-400"
              }`}
              title="手动支撑/阻力区：两次点击确定起点和价格范围，自动向右延伸"
            >
              <PanelTopDashed size={20} />
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
            <button
              type="button"
              onClick={onToggleSupportResistance}
              disabled={!isSupportResistanceEnabled && (isDataLoading || isHistoryLoading || Boolean(dataError) || totalCandles === 0)}
              aria-label="支撑/阻力区"
              aria-pressed={isSupportResistanceEnabled}
              aria-busy={isSupportResistanceBusy}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isSupportResistanceEnabled
                  ? "bg-indigo-500/20 text-indigo-200"
                  : "text-indigo-300 hover:bg-gray-700"
              }`}
              title={isSupportResistanceEnabled
                ? `${supportResistanceError ? `${supportResistanceError}；` : ""}点击关闭并移除所有支撑/阻力区；开启期间自动跟踪，清空画线不影响这些区间`
                : "点击显示支撑/阻力区，并随 K 线自动跟踪；缩放不影响分析"}
            >
              {supportResistanceError ? <TriangleAlert size={18} className="text-amber-300" /> : isSupportResistanceBusy ? <Loader2 size={18} className="animate-spin" /> : <Scan size={18} />}
              <span>支撑/阻力{supportResistanceCount ? ` ${supportResistanceCount}` : ""}</span>
            </button>
            {canUseAutomaticDraw ? (
              <>
                <button
                  type="button"
                  onClick={onToggleAutomaticPens}
                  disabled={
                    !isAutomaticPensEnabled &&
                    (isDataLoading || Boolean(dataError) || totalCandles === 0)
                  }
                  aria-pressed={isAutomaticPensEnabled}
                  className={`flex items-center rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isAutomaticPensEnabled
                      ? "bg-yellow-500/15 text-yellow-300"
                      : "text-gray-400 hover:bg-gray-700 hover:text-yellow-300"
                  }`}
                  title={
                    isAutomaticPensEnabled
                      ? `关闭并删除${penModeLabel}（当前 ${automaticPenCount} 笔，快捷键 F）`
                      : `开启${penModeLabel}（快捷键 F）`
                  }
                >
                  <ChartSpline size={20} />
                </button>
                {penModeSelect}
                <button
                  type="button"
                  onClick={onToggleAutomaticSegments}
                  disabled={
                    !isAutomaticSegmentsEnabled &&
                    (isDataLoading ||
                      Boolean(dataError) ||
                      totalCandles === 0 ||
                      isAutomaticSegmentBusy)
                  }
                  aria-pressed={isAutomaticSegmentsEnabled}
                  aria-busy={isAutomaticSegmentBusy}
                  className={`flex items-center rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isAutomaticSegmentsEnabled
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-gray-400 hover:bg-gray-700 hover:text-emerald-300"
                  }`}
                  title={
                    isAutomaticSegmentBusy
                      ? isAutomaticSegmentsEnabled
                        ? "正在绘制 Segments，点击可取消并删除"
                        : "正在删除 Segments"
                      : isAutomaticSegmentsEnabled
                        ? `关闭并删除自动 Segments（当前 ${automaticSegmentCount} 段，快捷键 R）`
                        : "开启自动 Segments（快捷键 R）"
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
              className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400 sm:p-2"
              title="清空手动画线"
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
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-700 lg:ml-3 lg:h-[42px] lg:shrink-0 lg:flex-none"
                title="查看回测记录并还原播放"
              >
                <History size={18} className="shrink-0" />
                <span className="hidden lg:inline 2xl:hidden">记录</span>
                <span className="lg:hidden 2xl:inline">回测记录</span>
              </button>
              <button
                onClick={handleEnterBacktest}
                disabled={isBacktestToggleDisabled}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 lg:ml-1 lg:h-[42px] lg:shrink-0 lg:flex-none"
                title={backtestButtonTitle}
              >
                {isDataLoading ? (
                  <Loader2 size={18} className="shrink-0 animate-spin" />
                ) : (
                  <StepForward size={18} className="shrink-0" />
                )}
                <span className="lg:hidden">{canEnterBacktest ? "开启逐K回测" : compactBacktestButtonLabel}</span>
                <span className="hidden lg:inline 2xl:hidden">{compactBacktestButtonLabel}</span>
                <span className="hidden 2xl:inline">{backtestButtonLabel}</span>
              </button>

              {isHistoryLoading && (
                <div className="ml-1 hidden shrink-0 text-xs text-blue-300 lg:block">
                  正在按需加载历史 K 线
                </div>
              )}
            </>
          ) : (
            <div className="flex w-full shrink-0 items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-800 p-1 lg:ml-3 lg:w-auto lg:justify-start lg:gap-3 lg:rounded-full lg:px-4 lg:py-1.5">
              <span
                className={`hidden min-w-36 text-center text-sm lg:inline ${
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
                aria-label={stepLabel}
                className="flex h-11 w-11 items-center justify-center rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 lg:h-auto lg:w-auto lg:p-1.5"
                title={
                  isReplayMode && isReplayFinished
                    ? "回放已结束"
                    : `${stepLabel}（快捷键 D）`
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
                aria-label={playLabel}
                className={`flex h-11 w-11 items-center justify-center rounded text-white disabled:opacity-50 lg:h-auto lg:w-auto lg:p-1.5 ${
                  isPlaying
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
                title={
                  isReplayMode && isReplayFinished
                    ? "回放已结束"
                    : batchTrading ? "运行策略到历史数据结尾（快捷键 P）" : isPlaying
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
                  className="flex h-11 w-11 items-center justify-center rounded bg-blue-500/15 text-blue-300 transition-colors hover:bg-blue-500/25 hover:text-blue-200 disabled:opacity-50 lg:h-auto lg:w-auto lg:p-1.5"
                  title="从头播放"
                  aria-label="从头播放"
                >
                  <RotateCcw size={18} />
                </button>
              ) : null}
              {isSuperuser && !isReplayMode && (
                <button
                  type="button"
                  aria-label="自动做单"
                  aria-haspopup="dialog"
                  aria-pressed={isAutomaticTradingEnabled}
                  onClick={onToggleAutomaticTrading}
                  disabled={isDataLoading || Boolean(dataError) || (!isAutomaticTradingEnabled && isHistoryLoading)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 lg:h-auto lg:w-auto lg:px-2 lg:py-1.5 ${isAutomaticTradingEnabled ? "bg-emerald-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                  title="打开策略配置中心：选择策略、设置首单仓位与加仓风险。启用后单步批量推进，播放运行到结尾。"
                >
                  <Bot size={20} className="lg:hidden" />
                  <span className={`hidden h-2 w-2 rounded-full lg:inline-block ${isAutomaticTradingEnabled ? "bg-white" : "bg-gray-500"}`} />
                  <span className="hidden lg:inline">自动做单</span>
                </button>
              )}
              {showRestartBacktest && <button type="button" onClick={onRestartBacktest} disabled={restartDisabled}
                aria-label="从头再跑" title={restartTitle}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-blue-500/15 px-2 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 disabled:opacity-50">
                <RotateCcw size={16} /><span>从头再跑</span>
              </button>}
              <div className="hidden h-5 w-px bg-gray-600 lg:block" />
              <button
                type="button"
                onClick={() => setIsExitBacktestConfirmOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 lg:h-auto lg:w-auto lg:p-1.5"
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

        <div className="order-1 ml-auto hidden w-full shrink-0 items-center justify-end gap-3 lg:order-2 lg:flex lg:w-auto lg:gap-6">
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
