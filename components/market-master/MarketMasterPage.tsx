// @ts-nocheck
"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type Time,
} from "lightweight-charts";

import { MarketMasterOverlays } from "@/components/market-master/MarketMasterOverlays";
import { MarketWorkspace } from "@/components/market-master/MarketWorkspace";
import {
  PendingMarketChangeDialog,
  type PendingMarketChange,
} from "@/components/market-master/PendingMarketChangeDialog";
import {
  TradeCloseConfirmDialog,
  type PendingTradeClose,
} from "@/components/market-master/TradeCloseConfirmDialog";
import { TopBar } from "@/components/market-master/TopBar";
import {
  getDefaultSymbol,
  INITIAL_FAVORITES,
  persistLastSymbol,
} from "@/components/market-master/SymbolSearchSelect";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/context/FetchContext";
import toast from "react-hot-toast";
import {
  ShapePrimitive,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  distToSegmentSquared,
} from "@/components/market-master/chart-utils";
import { useAutomaticPens } from "@/hooks/useAutomaticPens";
import { useAutomaticSegments } from "@/hooks/useAutomaticSegments";
import {
  AI_ZONE_STYLES,
  buildChartInsight,
  buildProfileDiagnosis,
  buildSingleTradeDiagnosis,
  MOCK_AI_DELAY_MS,
  PROFILE_INSUFFICIENT_TEXT,
  PROFILE_MIN_CLOSED_TRADES,
} from "@/components/market-master/mock-ai";
import {
  CANDLE_TOOLTIP_OFFSET,
  DEFAULT_TIMEFRAME,
  INITIAL_BACKTEST_BALANCE,
  INITIAL_VISIBLE_COUNT,
  MIN_BACKTEST_CANDLES,
  MIN_FORWARD_CANDLES,
  SELECTED_LINE_WIDTH_BOOST,
  TIMEFRAME_OPTIONS,
  applySyncedCrosshair,
  cloneIndicatorConfig,
  createDefaultIndicatorConfig,
  createInitialAiReviewModal,
  findPointByTime,
  formatChartTimeLabel,
  getDefaultRiskDistance,
  getInstrumentProfile,
  getIntervalByTimeframe,
  getTimeframeByInterval,
  loadPersistedIndicatorConfig,
  persistLastTimeframe,
  persistIndicatorConfig,
  pickRandomBacktestStartIndex,
  resolveLastTimeframe,
  type InstrumentContext,
} from "@/components/market-master/market-config";
import {
  KLINE_PAGE_SIZE,
  fetchKlinePage,
  getOldestRawDatetime,
  mergeCandleData,
  normalizeCandles,
  type KlinePageMeta,
  type NormalizedCandle,
} from "@/components/market-master/market-data";
import {
  createBacktestPersistClient,
  toPersistSide,
} from "@/components/market-master/backtest-persistence";
import { BacktestHistoryModal } from "@/components/market-master/BacktestHistoryModal";
import {
  findCandleIndexByTime,
  fromPersistCloseReason,
  fromPersistSide,
  parseReplayTradeId,
  sortReplayEvents,
  toUnixSeconds,
} from "@/components/market-master/backtest-replay";
import { useResizableMarketPanels } from "@/hooks/useResizableMarketPanels";

const BOLLINGER_LINE_DEFINITIONS = [
  { key: "upper", colorKey: "upperColor" },
  { key: "middle", colorKey: "middleColor" },
  { key: "lower", colorKey: "lowerColor" },
];

const toBollingerLineData = (data: any[], key: string) =>
  data.map((point) =>
    point[key] == null
      ? { time: point.time }
      : { time: point.time, value: point[key] }
  );

const CLOSED_TRADE_PROFIT_COLOR = "#15803d";
const CLOSED_TRADE_LOSS_COLOR = "#b91c1c";
const CLOSED_TRADE_MARKER_SIZE = 2.4;

const getActiveCandle = (data: any[] = [], currentIndex = 0) =>
  data[currentIndex - 1] ?? null;

const closeTradeRecord = (
  trade: any,
  closePrice: number,
  reason: string,
  closeTime: any
) => {
  const pnl =
    trade.type === "Buy"
      ? (closePrice - trade.entry) * trade.units
      : (trade.entry - closePrice) * trade.units;

  return {
    ...trade,
    status: "Closed",
    closePrice,
    pnl,
    reason,
    closeTime,
  };
};

const getTradeMarkerColor = (trade: any, markPrice = 0) => {
  if (trade?.status === "Closed") {
    return Number(trade.pnl) >= 0
      ? CLOSED_TRADE_PROFIT_COLOR
      : CLOSED_TRADE_LOSS_COLOR;
  }

  const price = markPrice || trade?.entry || 0;
  const pnl =
    trade?.type === "Buy"
      ? (price - trade.entry) * trade.units
      : (trade.entry - price) * trade.units;

  return pnl >= 0 ? CLOSED_TRADE_PROFIT_COLOR : CLOSED_TRADE_LOSS_COLOR;
};

const buildTradeMarkers = (trade: any, markPrice = 0) => {
  if (trade?.entryTime == null) return [];

  const isBuy = trade.type === "Buy";
  const color = getTradeMarkerColor(trade, markPrice);
  const markers = [
    {
      time: trade.entryTime,
      position: isBuy ? "belowBar" : "aboveBar",
      shape: isBuy ? "arrowUp" : "arrowDown",
      color,
      size: CLOSED_TRADE_MARKER_SIZE,
      id: `${trade.id}-entry`,
    },
  ];

  if (trade.status === "Closed" && trade.closeTime != null) {
    markers.push({
      time: trade.closeTime,
      position: isBuy ? "aboveBar" : "belowBar",
      shape: isBuy ? "arrowDown" : "arrowUp",
      color,
      size: CLOSED_TRADE_MARKER_SIZE,
      id: `${trade.id}-exit`,
    });
  }

  return markers;
};

const parseTradeMarkerId = (objectId: unknown) => {
  const raw = String(objectId ?? "");
  if (raw.endsWith("-entry")) {
    return { tradeId: raw.slice(0, -"-entry".length), kind: "entry" as const };
  }
  if (raw.endsWith("-exit")) {
    return { tradeId: raw.slice(0, -"-exit".length), kind: "exit" as const };
  }
  return null;
};

const ceiledEven = (value: number) => {
  const ceiled = Math.ceil(value);
  return ceiled % 2 !== 0 ? ceiled - 1 : ceiled;
};

const ceiledOdd = (value: number) => {
  const ceiled = Math.ceil(value);
  return ceiled % 2 === 0 ? ceiled - 1 : ceiled;
};

const getTradeMarkerLayout = (barSpacing = 6, sizeMultiplier = CLOSED_TRADE_MARKER_SIZE) => {
  const clamped = Math.min(Math.max(barSpacing, 12), 30);
  const shapeSize = ceiledEven(ceiledOdd(clamped)) * sizeMultiplier;
  const shapeMargin = Math.max(ceiledOdd(clamped * 0.1), 3);
  return { shapeSize, shapeMargin };
};

const findCandleByTime = (candles: any[] = [], time: unknown) => {
  for (let index = candles.length - 1; index >= 0; index -= 1) {
    if (candles[index]?.time === time) return candles[index];
  }
  return null;
};

const findTradeMarkerAtPoint = (
  chart: any,
  series: any,
  candles: any[] = [],
  trades: any[] = [],
  point: { x: number; y: number } | null | undefined
) => {
  if (!chart || !series || !point) return null;

  const timeScale = chart.timeScale?.();
  if (!timeScale) return null;

  const { shapeSize, shapeMargin } = getTradeMarkerLayout(
    timeScale.options?.().barSpacing
  );
  const halfSize = shapeSize / 2;
  const hitRadiusX = Math.max(halfSize, 16) + 8;
  const hitRadiusY = halfSize + shapeMargin + 10;
  const orderedTrades = [...trades].sort((left, right) => {
    if (left?.status === "Open" && right?.status !== "Open") return -1;
    if (right?.status === "Open" && left?.status !== "Open") return 1;
    return 0;
  });

  for (const trade of orderedTrades) {
    const isBuy = trade?.type === "Buy";
    const candidates = [
      {
        time: trade?.entryTime,
        kind: "entry" as const,
        belowBar: isBuy,
      },
      trade?.status === "Closed" && trade?.closeTime != null
        ? {
            time: trade.closeTime,
            kind: "exit" as const,
            belowBar: !isBuy,
          }
        : null,
    ];

    for (const candidate of candidates) {
      if (!candidate || candidate.time == null) continue;
      const x = timeScale.timeToCoordinate(candidate.time);
      const candle = findCandleByTime(candles, candidate.time);
      const anchorPrice = candidate.belowBar ? candle?.low : candle?.high;
      const yAnchor =
        anchorPrice == null ? null : series.priceToCoordinate(anchorPrice);
      if (x == null || yAnchor == null) continue;

      const y = candidate.belowBar
        ? yAnchor + halfSize + shapeMargin
        : yAnchor - halfSize - shapeMargin;
      if (
        Math.abs(point.x - x) <= hitRadiusX &&
        Math.abs(point.y - y) <= hitRadiusY
      ) {
        return { tradeId: String(trade.id), kind: candidate.kind };
      }
    }
  }

  return null;
};

const resolveTradeMarkerHit = (
  chart: any,
  series: any,
  candles: any[] = [],
  trades: any[] = [],
  param: { hoveredObjectId?: unknown; point?: { x: number; y: number } }
) =>
  parseTradeMarkerId(param?.hoveredObjectId) ||
  findTradeMarkerAtPoint(chart, series, candles, trades, param?.point);

const sortSeriesMarkersByTime = (markers: any[] = []) =>
  [...markers].sort((left, right) => {
    const leftTime = typeof left.time === "number" ? left.time : 0;
    const rightTime = typeof right.time === "number" ? right.time : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.id || "").localeCompare(String(right.id || ""));
  });

export function MarketMasterPage() {
  const { customFetch } = useFetch();
  const { user, isLoading: isAuthLoading } = useAuth();
  const canUseAutomaticDraw = !isAuthLoading && Boolean(user?.is_superuser);
  const persistRef = useRef(createBacktestPersistClient());
  const wasBacktestModeRef = useRef(false);
  const clientSessionIdRef = useRef<string | null>(null);
  const replayDetailRef = useRef<any>(null);
  const pendingReplayRef = useRef<any>(null);
  const replayEventsRef = useRef<any[]>([]);
  const replayAllEventsRef = useRef<any[]>([]);
  const replayCursorUnixRef = useRef<number | null>(null);
  const replayStartCurrentIndexRef = useRef(0);
  const replayEndCurrentIndexRef = useRef(0);
  const replayFinishedNotifiedRef = useRef(false);
  const isReplayModeRef = useRef(false);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayBounds, setReplayBounds] = useState({
    startCurrent: 0,
    endCurrent: 0,
  });
  const [isBacktestHistoryOpen, setIsBacktestHistoryOpen] = useState(false);
  const [replayingSessionId, setReplayingSessionId] = useState<string | null>(
    null
  );
  const [pendingReplayToken, setPendingReplayToken] = useState(0);

  useEffect(() => {
    persistRef.current.configure({
      enabled: !isAuthLoading && Boolean(user),
      fetchFn: (input, init) => customFetch(input, init, true),
    });
  }, [customFetch, isAuthLoading, user]);
  const chartContainerRef = useRef<any>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const {
    automaticPenCount,
    clearAutomaticPens,
    drawAutomaticPens,
    resetAutomaticPensState,
    updateAutomaticPensAfterCandle,
  } = useAutomaticPens({ chartRef, seriesRef });
  const {
    automaticSegmentCount,
    isAutomaticSegmentBusy,
    clearAutomaticSegments,
    drawAutomaticSegments,
    resetAutomaticSegmentsState,
    updateAutomaticSegmentsAfterCandle,
  } = useAutomaticSegments({ chartRef, seriesRef });
  const handleDrawAutomaticPens = useCallback(() => {
    if (!canUseAutomaticDraw) return;
    drawAutomaticPens();
  }, [canUseAutomaticDraw, drawAutomaticPens]);
  const handleDrawAutomaticSegments = useCallback(() => {
    if (!canUseAutomaticDraw) return;
    drawAutomaticSegments();
  }, [canUseAutomaticDraw, drawAutomaticSegments]);
  const emaSeriesRefs = useRef<any>({});
  const bollingerSeriesRefs = useRef<any>({});

  const subChartContainerRef = useRef<any>(null);
  const subChartRef = useRef<any>(null);
  const macdHistSeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const macdSignalSeriesRef = useRef<any>(null);
  const isSyncingCrosshairRef = useRef(false);

  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [indicatorModalPos, setIndicatorModalPos] = useState({
    x: 250,
    y: 200,
  });
  const indDragRef = useRef<any>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const [selectedIndTab, setSelectedIndTab] = useState("EMA");
  const [indConfig, setIndConfig] = useState(createDefaultIndicatorConfig);
  const [draftConfig, setDraftConfigState] = useState(
    createDefaultIndicatorConfig
  );
  const setDraftConfig = useCallback((updater) => {
    setDraftConfigState((prev) => {
      const nextConfig =
        typeof updater === "function"
          ? updater(cloneIndicatorConfig(prev))
          : updater;

      return cloneIndicatorConfig(nextConfig);
    });
  }, []);

  const [isMagnetEnabled, setIsMagnetEnabled] = useState(true);
  const [isRightPriceAutoScaleEnabled, setIsRightPriceAutoScaleEnabled] =
    useState(true);
  const magnetRef = useRef(isMagnetEnabled);
  useEffect(() => {
    magnetRef.current = isMagnetEnabled;
  }, [isMagnetEnabled]);

  const isMaximized = false;
  const {
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
  } = useResizableMarketPanels({
    isMacdEnabled: indConfig.macd.enabled,
    isMaximized,
  });

  const [symbol, setSymbol] = useState(INITIAL_FAVORITES[0]);
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);
  const timeframeRef = useRef(timeframe);
  const [isBacktestMode, setIsBacktestMode] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSyncingLatest, setIsSyncingLatest] = useState(false);
  const [marketDataEpoch, setMarketDataEpoch] = useState(0);
  const [totalCandles, setTotalCandles] = useState(0);
  const [dataError, setDataError] = useState("");
  const [instrumentContext, setInstrumentContext] = useState<InstrumentContext>(
    {
      symbol: "",
      assetType: null,
      currency: null,
      exchange: null,
    }
  );

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    setSymbol(getDefaultSymbol());
    setTimeframe(resolveLastTimeframe());

    const persistedConfig = loadPersistedIndicatorConfig();
    if (!persistedConfig) return;

    const nextConfig = cloneIndicatorConfig(persistedConfig);
    setIndConfig(nextConfig);
    setDraftConfig(nextConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    persistLastSymbol(symbol);
  }, [isMounted, symbol]);

  useEffect(() => {
    if (!isMounted) return;
    persistLastTimeframe(timeframe);
  }, [isMounted, timeframe]);

  useEffect(() => {
    if (!isMounted) return;
    persistIndicatorConfig(indConfig);
  }, [isMounted, indConfig]);

  const fullDataRef = useRef<any[]>([]);
  const fullEmaDataRef = useRef<any>({});
  const fullBollingerDataRef = useRef<any[]>([]);
  const fullMacdDataRef = useRef<any[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const [isPlaying, setIsPlaying] = useState(false);
  const currentPrice = fullDataRef.current[currentIndex - 1]?.close || 0;
  const activeInstrumentProfile = getInstrumentProfile({
    symbol,
    assetType:
      instrumentContext.symbol === symbol ? instrumentContext.assetType : null,
    referencePrice:
      instrumentContext.symbol === symbol && currentPrice > 0
        ? currentPrice
        : null,
  });
  const priceDecimals = activeInstrumentProfile.priceDecimals;

  useEffect(() => {
    const minMove = 1 / Math.pow(10, priceDecimals);
    const priceFormatConfig = {
      type: "price",
      precision: priceDecimals,
      minMove: minMove,
    };

    if (seriesRef.current) {
      seriesRef.current.applyOptions({ priceFormat: priceFormatConfig });
    }

    Object.values(emaSeriesRefs.current).forEach((series: any) => {
      series.applyOptions({ priceFormat: priceFormatConfig });
    });

    Object.values(bollingerSeriesRefs.current).forEach((series: any) => {
      series.applyOptions({ priceFormat: priceFormatConfig });
    });

    if (macdLineSeriesRef.current) {
      macdLineSeriesRef.current.applyOptions({
        priceFormat: priceFormatConfig,
      });
    }
    if (macdSignalSeriesRef.current) {
      macdSignalSeriesRef.current.applyOptions({
        priceFormat: priceFormatConfig,
      });
    }
  }, [priceDecimals]);

  const [legendData, setLegendData] = useState(null);
  const [candleTooltip, setCandleTooltip] = useState(null);
  const candleTooltipRef = useRef(null);
  const candleTooltipElRef = useRef(null);

  const hideCandleTooltip = useCallback(() => {
    candleTooltipRef.current = null;
    setCandleTooltip(null);
  }, []);

  useLayoutEffect(() => {
    if (
      !candleTooltip ||
      !candleTooltipElRef.current ||
      !chartContainerRef.current
    )
      return;

    const { width, height } =
      candleTooltipElRef.current.getBoundingClientRect();
    if (!width || !height) return;

    const containerWidth = chartContainerRef.current.clientWidth;
    const posX = candleTooltip.point.x + CANDLE_TOOLTIP_OFFSET.x;
    const posY = candleTooltip.point.y - height - CANDLE_TOOLTIP_OFFSET.y;
    const nextLeft =
      posX + width < containerWidth
        ? posX
        : Math.max(
            CANDLE_TOOLTIP_OFFSET.x,
            containerWidth - width - CANDLE_TOOLTIP_OFFSET.x
          );
    const nextTop =
      candleTooltip.point.y >= height ? posY : CANDLE_TOOLTIP_OFFSET.y;

    if (nextLeft === candleTooltip.left && nextTop === candleTooltip.top)
      return;

    setCandleTooltip((prev) =>
      prev ? { ...prev, left: nextLeft, top: nextTop } : prev
    );
  }, [candleTooltip]);

  useEffect(() => {
    if (!candleTooltip) return;

    const closeByWheel = () => hideCandleTooltip();
    document.addEventListener("wheel", closeByWheel);

    const container = chartContainerRef.current;
    let panStart = null;
    const onChartMouseDown = (event) => {
      if (event.button !== 0) return;
      if (candleTooltipElRef.current?.contains(event.target)) return;
      const state = stateRef.current;
      if (
        state.hoveredOrderLine ||
        state.lines.some((line) => line.hoveredPoint !== null)
      )
        return;
      panStart = { x: event.clientX, y: event.clientY };
    };
    const onChartMouseMove = (event) => {
      if (!panStart) return;
      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      if (dx * dx + dy * dy < 16) return;
      panStart = null;
      hideCandleTooltip();
    };
    const onChartMouseUp = () => {
      panStart = null;
    };

    container?.addEventListener("mousedown", onChartMouseDown);
    window.addEventListener("mousemove", onChartMouseMove);
    window.addEventListener("mouseup", onChartMouseUp);

    return () => {
      document.removeEventListener("wheel", closeByWheel);
      container?.removeEventListener("mousedown", onChartMouseDown);
      window.removeEventListener("mousemove", onChartMouseMove);
      window.removeEventListener("mouseup", onChartMouseUp);
    };
  }, [candleTooltip, hideCandleTooltip]);

  useEffect(() => {
    hideCandleTooltip();
  }, [symbol, timeframe, hideCandleTooltip]);

  const [balance, setBalance] = useState(INITIAL_BACKTEST_BALANCE);
  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  const [trades, setTrades] = useState([]);
  const [orderUnits, setOrderUnits] = useState(100);
  const [slEnabled, setSlEnabled] = useState(true);
  const [slDistance, setSlDistance] = useState(20);
  const [tpEnabled, setTpEnabled] = useState(true);
  const [tpDistance, setTpDistance] = useState(40);

  const tradesRef = useRef<any[]>(trades);
  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);
  const orderLinesRef = useRef<any>({});
  const seriesMarkersRef = useRef<any>(null);
  const closedTradeMarkersRef = useRef<any[]>([]);
  const updateTradePriceRef = useRef<any>();
  const requestCloseTradeFromMarkerRef = useRef<(tradeId: any) => void>(
    () => {}
  );
  const ignoreContextMenuCloseRef = useRef(false);

  const syncTradeMarkers = useCallback((tradeList: any[] = []) => {
    const markPrice =
      getActiveCandle(fullDataRef.current, currentIndexRef.current)?.close || 0;
    const nextMarkers = sortSeriesMarkersByTime(
      tradeList.flatMap((trade) => buildTradeMarkers(trade, markPrice))
    );
    closedTradeMarkersRef.current = nextMarkers;
    seriesMarkersRef.current?.setMarkers(nextMarkers);
  }, []);

  const clearClosedTradeMarkers = useCallback(() => {
    closedTradeMarkersRef.current = [];
    seriesMarkersRef.current?.setMarkers([]);
  }, []);

  const resetBacktestAccount = useCallback(() => {
    balanceRef.current = INITIAL_BACKTEST_BALANCE;
    setBalance(INITIAL_BACKTEST_BALANCE);
    tradesRef.current = [];
    setTrades([]);
    clearClosedTradeMarkers();
  }, [clearClosedTradeMarkers]);

  const commitTrades = useCallback((nextTrades: any[]) => {
    tradesRef.current = nextTrades;
    setTrades(nextTrades);
  }, []);

  const settleClosedTrades = useCallback(
    (
      nextTrades: any[],
      newlyClosed: any[] = [],
      balanceChange = 0,
      barIndex?: number
    ) => {
      commitTrades(nextTrades);
      syncTradeMarkers(nextTrades);
      if (balanceChange !== 0) {
        const nextBalance = balanceRef.current + balanceChange;
        balanceRef.current = nextBalance;
        setBalance(nextBalance);
      }
      if (isReplayModeRef.current) return;
      const resolvedBarIndex = barIndex ?? currentIndexRef.current - 1;
      newlyClosed.forEach((trade) => {
        if (trade?.closeTime == null || trade?.closePrice == null) return;
        persistRef.current.recordClose({
          client_trade_id: String(trade.id),
          bar_time: trade.closeTime,
          bar_index: resolvedBarIndex,
          price: trade.closePrice,
          close_reason: trade.reason,
        });
      });
    },
    [commitTrades, syncTradeMarkers]
  );

  updateTradePriceRef.current = (tradeId: any, type: any, newPrice: any) => {
    if (isReplayModeRef.current) return;
    commitTrades(
      tradesRef.current.map((t) =>
        t.id === tradeId ? { ...t, [type]: newPrice } : t
      )
    );
    const activeCandle = getActiveCandle(
      fullDataRef.current,
      currentIndexRef.current
    );
    if (activeCandle?.time == null || (type !== "sl" && type !== "tp")) return;
    persistRef.current.recordModify({
      client_trade_id: String(tradeId),
      kind: type,
      bar_time: activeCandle.time,
      bar_index: currentIndexRef.current - 1,
      price: newPrice,
    });
  };

  const applyReplayEventsUpTo = useCallback(
    (barTimeUnix: number) => {
      if (!isReplayModeRef.current) return;
      const remaining: any[] = [];
      const due: any[] = [];
      replayEventsRef.current.forEach((event) => {
        const eventTime = toUnixSeconds(event.bar_time);
        if (eventTime != null && eventTime <= barTimeUnix) due.push(event);
        else remaining.push(event);
      });
      replayEventsRef.current = remaining;
      if (!due.length) return;

      let nextTrades = [...tradesRef.current];
      let balanceChange = 0;
      due.forEach((event) => {
        const tradeId = parseReplayTradeId(event.client_trade_id);
        if (event.event_type === "OPEN") {
          nextTrades = [
            {
              id: tradeId,
              type: fromPersistSide(event.side),
              entry: Number(event.price),
              sl: event.sl_price != null ? Number(event.sl_price) : null,
              tp: event.tp_price != null ? Number(event.tp_price) : null,
              units: Number(event.units || 0),
              status: "Open",
              pnl: 0,
              visibleOnChart: true,
              entryTime: toUnixSeconds(event.bar_time),
            },
            ...nextTrades,
          ];
          return;
        }

        if (event.event_type === "MODIFY_SL") {
          nextTrades = nextTrades.map((trade) =>
            String(trade.id) === String(tradeId)
              ? { ...trade, sl: Number(event.price) }
              : trade
          );
          return;
        }

        if (event.event_type === "MODIFY_TP") {
          nextTrades = nextTrades.map((trade) =>
            String(trade.id) === String(tradeId)
              ? { ...trade, tp: Number(event.price) }
              : trade
          );
          return;
        }

        if (event.event_type !== "CLOSE") return;
        nextTrades = nextTrades.map((trade) => {
          if (String(trade.id) !== String(tradeId) || trade.status !== "Open") {
            return trade;
          }
          const closedTrade = closeTradeRecord(
            trade,
            Number(event.price),
            fromPersistCloseReason(event.close_reason),
            toUnixSeconds(event.bar_time)
          );
          balanceChange += closedTrade.pnl;
          return closedTrade;
        });
      });

      commitTrades(nextTrades);
      syncTradeMarkers(nextTrades);
      if (balanceChange !== 0) {
        const nextBalance = balanceRef.current + balanceChange;
        balanceRef.current = nextBalance;
        setBalance(nextBalance);
      }
    },
    [commitTrades, syncTradeMarkers]
  );

  const [aiReviewModal, setAiReviewModal] = useState(
    createInitialAiReviewModal
  );
  const [pendingMarketChange, setPendingMarketChange] =
    useState<PendingMarketChange | null>(null);
  const [pendingTradeClose, setPendingTradeClose] =
    useState<PendingTradeClose | null>(null);

  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);

  const selectedShapeIdRef = useRef<string | null>(null);
  const selectedIndicatorRef = useRef<any>({ kind: null, id: null });
  const indConfigRef = useRef(indConfig);
  useEffect(() => {
    indConfigRef.current = indConfig;
  }, [indConfig]);

  const applyIndicatorSelectionStyles = useCallback(
    (configOverride: any = null) => {
      const cfg = configOverride || indConfigRef.current;
      const selected = selectedIndicatorRef.current;

      cfg.emas.forEach((ema: any) => {
        const series = emaSeriesRefs.current[ema.id];
        if (!series) return;
        series.applyOptions({
          lineWidth:
            ema.lineWidth +
            (selected.kind === "ema" && selected.id === ema.id
              ? SELECTED_LINE_WIDTH_BOOST
              : 0),
        });
      });

      BOLLINGER_LINE_DEFINITIONS.forEach(({ key }) => {
        const series = bollingerSeriesRefs.current[key];
        if (!series) return;
        series.applyOptions({
          lineWidth:
            cfg.bollinger.lineWidth +
            (selected.kind === "bollinger" && selected.id === key
              ? SELECTED_LINE_WIDTH_BOOST
              : 0),
        });
      });

      if (macdLineSeriesRef.current) {
        macdLineSeriesRef.current.applyOptions({
          lineWidth:
            cfg.macd.lineWidth +
            (selected.kind === "macd" ? SELECTED_LINE_WIDTH_BOOST : 0),
        });
      }

      if (macdSignalSeriesRef.current) {
        macdSignalSeriesRef.current.applyOptions({
          lineWidth:
            cfg.macd.lineWidth +
            (selected.kind === "signal" ? SELECTED_LINE_WIDTH_BOOST : 0),
        });
      }
    },
    []
  );

  const setSelectedIndicator = useCallback(
    (nextSelection: any) => {
      const next = nextSelection || { kind: null, id: null };
      const prev = selectedIndicatorRef.current;
      if (prev.kind === next.kind && prev.id === next.id) return;
      selectedIndicatorRef.current = next;
      applyIndicatorSelectionStyles();
    },
    [applyIndicatorSelectionStyles]
  );

  const detachShapeFromMainSeries = useCallback((shape: any) => {
    if (!shape || !seriesRef.current) return;
    // Primitive detach may wait for next invalidation to repaint; force one now.
    const requestUpdate = shape.requestUpdate;
    seriesRef.current.detachPrimitive(shape);
    if (typeof requestUpdate === "function") requestUpdate();
  }, []);

  const [mode, setMode] = useState("idle");
  const [drawType, setDrawType] = useState("line");
  const [, setLines] = useState([]);

  const [contextMenu, setContextMenu] = useState(null);
  const [shapeConfigModal, setShapeConfigModal] = useState({
    visible: false,
    shapeId: null,
  });

  const stateRef = useRef<any>({
    lines: [],
    mode: "idle",
    drawType: "line",
    activeLine: null,
    dragPointIndex: null,
    isDrawing: false,
    currentLogical: null,
    hoveredOrderLine: null,
    draggingOrderLine: null,
    draggingOrderLinePrice: null,
    isHovering: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartCoords: null,
    dragStartP1: null,
    dragStartP2: null,
    lastHoveredTime: null,
  });

  const setSelectedShape = useCallback((shape: any) => {
    const prevId = selectedShapeIdRef.current;
    if (prevId && (!shape || prevId !== shape.id)) {
      const prevShape = stateRef.current.lines.find((l) => l.id === prevId);
      prevShape?.setSelected?.(false);
    }

    if (!shape) {
      selectedShapeIdRef.current = null;
      return;
    }

    selectedShapeIdRef.current = shape.id;
    shape.setSelected?.(true);
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelectedShape(null);
    setSelectedIndicator(null);
  }, [setSelectedShape, setSelectedIndicator]);

  const getEpochTime = useCallback((time: any) => {
    if (typeof time === "number") return time;
    if (time && typeof time.timestamp === "number") return time.timestamp;
    return null;
  }, []);

  const findClosestEmaAtPoint = useCallback(
    (time: any, y: number) => {
      if (!seriesRef.current) return null;
      const targetTime = getEpochTime(time);
      if (targetTime === null) return null;

      const index = fullDataRef.current.findIndex((d) => d.time === targetTime);
      if (index === -1) return null;

      let best: any = null;
      const threshold = 8;
      indConfigRef.current.emas.forEach((ema: any) => {
        const emaPoint = fullEmaDataRef.current[ema.id]?.[index];
        if (!emaPoint) return;
        const yCoord = seriesRef.current.priceToCoordinate(emaPoint.value);
        if (yCoord === null) return;
        const dist = Math.abs(y - yCoord);
        if (dist <= threshold && (!best || dist < best.dist)) {
          best = { id: ema.id, dist };
        }
      });

      return best?.id || null;
    },
    [getEpochTime]
  );

  const findClosestMacdAtPoint = useCallback(
    (time: any, y: number) => {
      const targetTime = getEpochTime(time);
      if (targetTime === null) return null;

      const index = fullMacdDataRef.current.findIndex(
        (d) => d.time === targetTime
      );
      if (index === -1) return null;

      const point = fullMacdDataRef.current[index];
      if (!point) return null;

      const threshold = 8;
      let best: any = null;

      if (macdLineSeriesRef.current) {
        const yMacd = macdLineSeriesRef.current.priceToCoordinate(point.macd);
        if (yMacd !== null) {
          const dist = Math.abs(y - yMacd);
          if (dist <= threshold) {
            best = { kind: "macd", dist };
          }
        }
      }

      if (macdSignalSeriesRef.current) {
        const ySignal = macdSignalSeriesRef.current.priceToCoordinate(
          point.signal
        );
        if (ySignal !== null) {
          const dist = Math.abs(y - ySignal);
          if (dist <= threshold && (!best || dist < best.dist)) {
            best = { kind: "signal", dist };
          }
        }
      }

      return best?.kind || null;
    },
    [getEpochTime]
  );

  const findClosestBollingerAtPoint = useCallback(
    (time: any, y: number) => {
      if (!seriesRef.current || !indConfigRef.current.bollinger.enabled)
        return null;
      const targetTime = getEpochTime(time);
      if (targetTime === null) return null;

      const index = fullDataRef.current.findIndex((d) => d.time === targetTime);
      const point = fullBollingerDataRef.current[index];
      if (index === -1 || !point) return null;

      let best: any = null;
      const threshold = 8;
      BOLLINGER_LINE_DEFINITIONS.forEach(({ key }) => {
        if (point[key] == null) return;
        const yCoord = seriesRef.current.priceToCoordinate(point[key]);
        if (yCoord === null) return;
        const dist = Math.abs(y - yCoord);
        if (dist <= threshold && (!best || dist < best.dist)) {
          best = { key, dist };
        }
      });

      return best?.key || null;
    },
    [getEpochTime]
  );

  useEffect(() => {
    applyIndicatorSelectionStyles();
  }, [indConfig, applyIndicatorSelectionStyles]);

  const updateLegend = useCallback((hoveredTime, configOverride = null) => {
    const activeConfig = configOverride || indConfigRef.current;
    let index = currentIndexRef.current - 1;
    const timeToUse = hoveredTime || stateRef.current.lastHoveredTime;
    if (timeToUse) {
      const foundIndex = fullDataRef.current.findIndex(
        (d) => d.time === timeToUse
      );
      if (foundIndex !== -1 && foundIndex < currentIndexRef.current)
        index = foundIndex;
    }
    if (index >= 0 && index < fullDataRef.current.length) {
      const d = fullDataRef.current[index];
      const m = fullMacdDataRef.current[index];
      const emasData = activeConfig.emas
        .map((ema) => {
          const eData = fullEmaDataRef.current[ema.id];
          return {
            period: ema.period,
            color: ema.color,
            value: eData && eData[index] ? eData[index].value : null,
          };
        })
        .filter((ema) => ema.value !== null);
      const bollingerPoint = activeConfig.bollinger.enabled
        ? fullBollingerDataRef.current[index]
        : null;

      setLegendData({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        emas: emasData,
        bollinger:
          bollingerPoint?.middle != null
            ? {
                period: activeConfig.bollinger.period,
                standardDeviation: activeConfig.bollinger.standardDeviation,
                middleColor: activeConfig.bollinger.middleColor,
                upperColor: activeConfig.bollinger.upperColor,
                lowerColor: activeConfig.bollinger.lowerColor,
                middle: bollingerPoint.middle,
                upper: bollingerPoint.upper,
                lower: bollingerPoint.lower,
              }
            : null,
        macd: m ? m.macd : null,
        signal: m ? m.signal : null,
        hist: m ? m.hist : null,
      });
    }
  }, []);

  useEffect(() => {
    if (isDataLoading || currentIndex === 0) {
      setLegendData(null);
      return;
    }

    updateLegend(stateRef.current.lastHoveredTime);
  }, [currentIndex, symbol, timeframe, updateLegend, indConfig, isDataLoading]);

  const focusLatestCandles = useCallback((dataOverride: any[] = []) => {
    const data = dataOverride.length ? dataOverride : fullDataRef.current;
    if (!chartRef.current || !data.length) return;

    const visibleCount = Math.min(INITIAL_VISIBLE_COUNT, data.length);
    const from = data[Math.max(data.length - visibleCount, 0)]?.time;
    const to = data[data.length - 1]?.time;

    if (from == null || to == null) return;

    const applyRange = () => {
      if (!chartRef.current) return;
      chartRef.current.timeScale().setVisibleRange({ from, to });
      if (subChartRef.current) {
        subChartRef.current.timeScale().setVisibleRange({ from, to });
      }
    };

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(applyRange);
      return;
    }

    applyRange();
  }, []);

  const syncDisplayedData = useCallback(
    (
      dataOverride: any[] = [],
      nextIndexOverride?: number,
      nextBacktestMode: boolean = false,
      shouldFitContent: boolean = false,
      options?: {
        prependedCount?: number;
        shouldFocusLatest?: boolean;
      }
    ) => {
      const data = dataOverride.length ? dataOverride : fullDataRef.current;
      const activeConfig = indConfigRef.current;
      const prependedCount = options?.prependedCount ?? 0;
      const shouldFocusLatest = options?.shouldFocusLatest ?? !nextBacktestMode;
      const nextIndex = Math.min(
        Math.max(nextIndexOverride ?? currentIndexRef.current, 0),
        data.length
      );
      const candleData = nextBacktestMode ? data.slice(0, nextIndex) : data;

      const logicalRange =
        prependedCount > 0 && chartRef.current
          ? chartRef.current.timeScale().getVisibleLogicalRange()
          : null;
      const subLogicalRange =
        prependedCount > 0 && subChartRef.current
          ? subChartRef.current.timeScale().getVisibleLogicalRange()
          : null;

      if (seriesRef.current) {
        seriesRef.current.setData(candleData);
      }

      activeConfig.emas.forEach((ema: any) => {
        const emaSeries = emaSeriesRefs.current[ema.id];
        const emaData = fullEmaDataRef.current[ema.id] || [];
        if (!emaSeries) return;
        emaSeries.setData(
          nextBacktestMode ? emaData.slice(0, nextIndex) : emaData
        );
      });

      if (activeConfig.bollinger.enabled) {
        const bollingerData = nextBacktestMode
          ? fullBollingerDataRef.current.slice(0, nextIndex)
          : fullBollingerDataRef.current;
        BOLLINGER_LINE_DEFINITIONS.forEach(({ key }) => {
          bollingerSeriesRefs.current[key]?.setData(
            toBollingerLineData(bollingerData, key)
          );
        });
      }

      if (
        macdHistSeriesRef.current &&
        macdLineSeriesRef.current &&
        macdSignalSeriesRef.current
      ) {
        const macdData = nextBacktestMode
          ? fullMacdDataRef.current.slice(0, nextIndex)
          : fullMacdDataRef.current;

        macdHistSeriesRef.current.setData(
          macdData.map((d) => ({
            time: d.time,
            value: d.hist,
            color: activeConfig.macd.histColors[d.colorType],
          }))
        );
        macdLineSeriesRef.current.setData(
          macdData.map((d) => ({ time: d.time, value: d.macd }))
        );
        macdSignalSeriesRef.current.setData(
          macdData.map((d) => ({ time: d.time, value: d.signal }))
        );
      }

      if (nextBacktestMode) {
        if (shouldFitContent) {
          // 随机起点可能已揭示上千根历史，聚焦最近一段而非 fitContent 全挤在一起
          focusLatestCandles(candleData);
        }
        return;
      }

      if (prependedCount > 0 && logicalRange && chartRef.current) {
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: logicalRange.from + prependedCount,
          to: logicalRange.to + prependedCount,
        });
        if (subLogicalRange && subChartRef.current) {
          subChartRef.current.timeScale().setVisibleLogicalRange({
            from: subLogicalRange.from + prependedCount,
            to: subLogicalRange.to + prependedCount,
          });
        }
        return;
      }

      if (shouldFocusLatest) {
        focusLatestCandles(data);
      }
    },
    [focusLatestCandles]
  );

  const recomputeIndicators = useCallback((data: NormalizedCandle[]) => {
    const activeConfig = indConfigRef.current;
    const newEmaData: Record<string, ReturnType<typeof calculateEMA>> = {};
    activeConfig.emas.forEach((ema: { id: string; period: number }) => {
      newEmaData[ema.id] = calculateEMA(data, ema.period);
    });
    fullEmaDataRef.current = newEmaData;
    fullBollingerDataRef.current = calculateBollingerBands(
      data,
      activeConfig.bollinger.period,
      activeConfig.bollinger.standardDeviation
    );
    fullMacdDataRef.current = calculateMACD(
      data,
      activeConfig.macd.fast,
      activeConfig.macd.slow,
      activeConfig.macd.signal
    );
  }, []);

  const handleIndDragStart = (e: any) => {
    indDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: indicatorModalPos.x,
      initialY: indicatorModalPos.y,
    };
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleIndDragMove = (e: any) => {
      if (!indDragRef.current.isDragging) return;
      const dx = e.clientX - indDragRef.current.startX;
      const dy = e.clientY - indDragRef.current.startY;
      setIndicatorModalPos({
        x: indDragRef.current.initialX + dx,
        y: Math.max(0, indDragRef.current.initialY + dy),
      });
    };
    const handleIndDragEnd = () => {
      indDragRef.current.isDragging = false;
      document.body.style.userSelect = "";
    };
    if (isIndicatorModalOpen) {
      window.addEventListener("mousemove", handleIndDragMove);
      window.addEventListener("mouseup", handleIndDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleIndDragMove);
      window.removeEventListener("mouseup", handleIndDragEnd);
    };
  }, [isIndicatorModalOpen, indicatorModalPos]);

  const handleAddDraftEma = () => {
    setDraftConfig((prev) => ({
      ...prev,
      emas: [
        ...prev.emas,
        {
          id: "ema_" + Date.now(),
          period: 100,
          color: "#ef5350",
          lineWidth: 1.5,
        },
      ],
    }));
  };
  const handleRemoveDraftEma = (id: any) => {
    setDraftConfig((prev) => ({
      ...prev,
      emas: prev.emas.filter((e) => e.id !== id),
    }));
  };
  const handleUpdateDraftEma = (id: any, field: any, value: any) => {
    setDraftConfig((prev) => ({
      ...prev,
      emas: prev.emas.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  };

  useEffect(() => {
    if (!isMounted) return;

    let cancelled = false;

    const clearChartData = () => {
      clearAutomaticPens();
      clearAutomaticSegments();
      fullDataRef.current = [];
      fullEmaDataRef.current = {};
      fullBollingerDataRef.current = [];
      fullMacdDataRef.current = [];
      setCurrentIndex(0);
      setTotalCandles(0);
      setLegendData(null);

      if (seriesRef.current) {
        seriesRef.current.setData([]);
      }

      Object.values(emaSeriesRefs.current).forEach((emaSeries: any) => {
        emaSeries.setData([]);
      });

      Object.values(bollingerSeriesRefs.current).forEach(
        (bollingerSeries: any) => {
          bollingerSeries.setData([]);
        }
      );

      if (macdHistSeriesRef.current) macdHistSeriesRef.current.setData([]);
      if (macdLineSeriesRef.current) macdLineSeriesRef.current.setData([]);
      if (macdSignalSeriesRef.current) macdSignalSeriesRef.current.setData([]);
    };

    const removeOrderLines = () => {
      Object.values(orderLinesRef.current).forEach((lines: any) => {
        if (lines.entry && seriesRef.current)
          seriesRef.current.removePriceLine(lines.entry);
        if (lines.sl && seriesRef.current)
          seriesRef.current.removePriceLine(lines.sl);
        if (lines.tp && seriesRef.current)
          seriesRef.current.removePriceLine(lines.tp);
      });
      orderLinesRef.current = {};
    };

    const applyLoadedMarketData = (
      marketData: KlinePageMeta,
      data: NormalizedCandle[],
      options?: { prependedCount?: number; isInitialPage?: boolean }
    ) => {
      const { prependedCount = 0, isInitialPage = false } = options || {};
      const { assetType, currency, exchange, latestClose } = marketData;

      if (isInitialPage) {
        setInstrumentContext({
          symbol,
          assetType: assetType || null,
          currency,
          exchange,
        });
        const nextRiskDistance = getDefaultRiskDistance(
          symbol,
          assetType,
          Number(latestClose) || data[data.length - 1]?.close || null
        );
        setSlDistance(nextRiskDistance.sl);
        setTpDistance(nextRiskDistance.tp);
      }

      fullDataRef.current = data;
      recomputeIndicators(data);
      setTotalCandles(data.length);

      let nextCurrentIndex = currentIndexRef.current;
      let nextBacktestMode = isBacktestMode;

      if (isInitialPage) {
        if (isBacktestMode) {
          const randomStart = pickRandomBacktestStartIndex(data.length);
          if (randomStart == null) {
            // 新品种/周期历史不足，自动退出回测
            nextBacktestMode = false;
            setIsBacktestMode(false);
            nextCurrentIndex = data.length;
          } else {
            nextCurrentIndex = randomStart;
          }
        } else {
          nextCurrentIndex = data.length;
        }
        setCurrentIndex(nextCurrentIndex);
      } else if (prependedCount > 0 && nextBacktestMode) {
        nextCurrentIndex = Math.min(
          currentIndexRef.current + prependedCount,
          data.length
        );
        setCurrentIndex(nextCurrentIndex);
      } else if (!nextBacktestMode) {
        nextCurrentIndex = data.length;
        setCurrentIndex(nextCurrentIndex);
      }

      syncDisplayedData(
        data,
        nextCurrentIndex,
        nextBacktestMode,
        isInitialPage && nextBacktestMode,
        {
          prependedCount,
          shouldFocusLatest: isInitialPage,
        }
      );
    };

    const loadHistoricalPages = async (
      interval: string,
      initialPage: KlinePageMeta,
      initialData: NormalizedCandle[]
    ) => {
      if (initialPage.rawCandles.length < KLINE_PAGE_SIZE) {
        return;
      }

      setIsHistoryLoading(true);
      let mergedData = initialData;
      let cursorEndDate = getOldestRawDatetime(initialPage.rawCandles);

      try {
        while (!cancelled && cursorEndDate) {
          const nextPage = await fetchKlinePage(customFetch, {
            symbol,
            interval,
            outputsize: KLINE_PAGE_SIZE,
            endDate: cursorEndDate,
          });

          if (cancelled) return;

          const olderData = normalizeCandles(nextPage.rawCandles);
          if (!olderData.length) {
            break;
          }

          const previousLength = mergedData.length;
          mergedData = mergeCandleData(mergedData, olderData);
          const prependedCount = mergedData.length - previousLength;

          if (prependedCount <= 0) {
            break;
          }

          applyLoadedMarketData(nextPage, mergedData, { prependedCount });

          if (nextPage.rawCandles.length < KLINE_PAGE_SIZE) {
            break;
          }

          cursorEndDate = getOldestRawDatetime(nextPage.rawCandles);
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    const loadMarketData = async () => {
      setIsPlaying(false);
      clearAllSelections();
      tradesRef.current = [];
      setTrades([]);
      removeOrderLines();
      clearClosedTradeMarkers();
      setDataError("");
      setIsDataLoading(true);
      setIsHistoryLoading(false);
      setTotalCandles(0);
      setLegendData(null);
      setInstrumentContext({
        symbol: "",
        assetType: null,
        currency: null,
        exchange: null,
      });

      const { sl, tp } = getDefaultRiskDistance(symbol);
      setSlDistance(sl);
      setTpDistance(tp);

      try {
        const interval = getIntervalByTimeframe(timeframe);
        const firstPage = await fetchKlinePage(customFetch, {
          symbol,
          interval,
          outputsize: KLINE_PAGE_SIZE,
        });

        const newData = normalizeCandles(firstPage.rawCandles);
        if (!newData.length) {
          throw new Error(
            `当前标的 ${symbol} 暂无可用 K 线数据，请切换周期或标的`
          );
        }

        if (cancelled) return;

        applyLoadedMarketData(firstPage, newData, { isInitialPage: true });
        setIsDataLoading(false);

        await loadHistoricalPages(interval, firstPage, newData);
      } catch (error: any) {
        if (cancelled) return;

        clearChartData();
        setDataError(error?.message || "获取 K 线数据失败");
      } finally {
        if (!cancelled) {
          setIsDataLoading(false);
          setIsHistoryLoading(false);
        }
      }
    };

    void loadMarketData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clearAllSelections,
    customFetch,
    isMounted,
    recomputeIndicators,
    symbol,
    timeframe,
    syncDisplayedData,
    clearAutomaticSegments,
    marketDataEpoch,
  ]);

  useEffect(() => {
    if (!isBacktestMode) {
      clearClosedTradeMarkers();
      return;
    }
    syncTradeMarkers(trades);
  }, [
    clearClosedTradeMarkers,
    currentPrice,
    isBacktestMode,
    syncTradeMarkers,
    trades,
  ]);

  const applyReplayWindow = useCallback(
    (detail: any, options?: { announce?: boolean; restarted?: boolean }) => {
      const data = fullDataRef.current;
      const startUnix = toUnixSeconds(detail?.start_bar_time);
      const startBarIndex = findCandleIndexByTime(data, startUnix);
      if (startBarIndex < 0) return false;

      const cursorUnix = toUnixSeconds(detail?.cursor_bar_time) ?? startUnix;
      let endBarIndex = findCandleIndexByTime(data, cursorUnix);
      if (endBarIndex < startBarIndex) endBarIndex = startBarIndex;

      const startCurrent = startBarIndex + 1;
      const endCurrent = Math.min(endBarIndex + 1, data.length);
      const hasPlayableCandles = endCurrent > startCurrent;

      replayDetailRef.current = detail;
      replayAllEventsRef.current = sortReplayEvents(detail.events || []);
      replayEventsRef.current = [...replayAllEventsRef.current];
      replayCursorUnixRef.current = cursorUnix;
      replayStartCurrentIndexRef.current = startCurrent;
      replayEndCurrentIndexRef.current = endCurrent;
      replayFinishedNotifiedRef.current = !hasPlayableCandles;

      isReplayModeRef.current = true;
      setIsReplayMode(true);
      setIsPlaying(false);
      resetBacktestAccount();
      clearAutomaticPens();
      clearAutomaticSegments();
      currentIndexRef.current = startCurrent;
      setCurrentIndex(startCurrent);
      setReplayBounds({ startCurrent, endCurrent });
      syncDisplayedData(data, startCurrent, true, true);

      const startCandle = data[startBarIndex];
      if (startCandle?.time != null) {
        applyReplayEventsUpTo(startCandle.time);
      }

      if (options?.restarted) {
        toast.success("已从头开始回放");
      } else if (options?.announce) {
        if (!hasPlayableCandles) {
          toast("回放已结束：原回测未推进 K 线");
        } else {
          toast.success("已还原回测，可播放或步进查看成交");
        }
      }
      return true;
    },
    [
      applyReplayEventsUpTo,
      clearAutomaticPens,
      clearAutomaticSegments,
      resetBacktestAccount,
      syncDisplayedData,
    ]
  );

  useEffect(() => {
    if (isDataLoading || !fullDataRef.current.length) return;

    if (isBacktestMode) {
      if (wasBacktestModeRef.current) return;

      const replayDetail = replayDetailRef.current;
      if (replayDetail) {
        if (!applyReplayWindow(replayDetail, { announce: true })) {
          toast.error("当前 K 线无法覆盖该回测起点，无法还原播放");
          replayDetailRef.current = null;
          replayEventsRef.current = [];
          replayAllEventsRef.current = [];
          replayCursorUnixRef.current = null;
          replayStartCurrentIndexRef.current = 0;
          replayEndCurrentIndexRef.current = 0;
          setReplayBounds({ startCurrent: 0, endCurrent: 0 });
          isReplayModeRef.current = false;
          setIsReplayMode(false);
          setIsBacktestMode(false);
          return;
        }

        wasBacktestModeRef.current = true;
        clientSessionIdRef.current = null;
        return;
      }

      const randomStart = pickRandomBacktestStartIndex(
        fullDataRef.current.length
      );
      if (randomStart == null) {
        setIsBacktestMode(false);
        return;
      }

      wasBacktestModeRef.current = true;
      isReplayModeRef.current = false;
      setIsReplayMode(false);
      clientSessionIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `session-${Date.now()}`;
      setIsPlaying(false);
      resetBacktestAccount();
      clearAutomaticPens();
      clearAutomaticSegments();
      setCurrentIndex(randomStart);
      syncDisplayedData(fullDataRef.current, randomStart, true, true);

      const startCandle = fullDataRef.current[randomStart - 1];
      if (startCandle?.time == null) {
        wasBacktestModeRef.current = false;
        clientSessionIdRef.current = null;
        setIsBacktestMode(false);
        return;
      }

      persistRef.current.startSession({
        client_session_id: clientSessionIdRef.current,
        symbol,
        interval: getIntervalByTimeframe(timeframe),
        timeframe,
        start_bar_time: startCandle?.time,
        start_bar_index: randomStart - 1,
        initial_visible_bars: INITIAL_VISIBLE_COUNT,
        cursor_bar_time: startCandle?.time,
        cursor_bar_index: randomStart - 1,
        initial_balance: INITIAL_BACKTEST_BALANCE,
      });
      return;
    }

    if (wasBacktestModeRef.current) {
      const barIndex = currentIndexRef.current - 1;
      const candle = fullDataRef.current[barIndex];
      if (!isReplayModeRef.current) {
        persistRef.current.completeSession({
          cursor_bar_time: candle?.time ?? null,
          cursor_bar_index: barIndex,
          ending_balance: balanceRef.current,
          mark_price: candle?.close || 0,
        });
      }
      wasBacktestModeRef.current = false;
      clientSessionIdRef.current = null;
      isReplayModeRef.current = false;
      setIsReplayMode(false);
      replayDetailRef.current = null;
      replayEventsRef.current = [];
      replayAllEventsRef.current = [];
      replayCursorUnixRef.current = null;
      replayStartCurrentIndexRef.current = 0;
      replayEndCurrentIndexRef.current = 0;
      replayFinishedNotifiedRef.current = false;
      setReplayBounds({ startCurrent: 0, endCurrent: 0 });
      resetBacktestAccount();
    }

    setIsPlaying(false);
    clearAutomaticPens();
    clearAutomaticSegments();
    clearClosedTradeMarkers();

    const nextCurrentIndex = fullDataRef.current.length;
    setCurrentIndex(nextCurrentIndex);
    syncDisplayedData(fullDataRef.current, nextCurrentIndex, false, false);
  }, [
    applyReplayWindow,
    clearAutomaticPens,
    clearAutomaticSegments,
    clearClosedTradeMarkers,
    isBacktestMode,
    isDataLoading,
    resetBacktestAccount,
    symbol,
    syncDisplayedData,
    timeframe,
  ]);

  useEffect(() => {
    const detail = pendingReplayRef.current;
    if (!detail) return;
    if (isBacktestMode) return;

    const nextTimeframe =
      detail.timeframe || getTimeframeByInterval(detail.interval);
    const onTargetMarket =
      symbol === detail.symbol && timeframe === nextTimeframe;

    if (!onTargetMarket) {
      if (symbol !== detail.symbol) setSymbol(detail.symbol);
      if (timeframe !== nextTimeframe) setTimeframe(nextTimeframe);
      return;
    }

    if (dataError) {
      pendingReplayRef.current = null;
      setReplayingSessionId(null);
      toast.error(dataError || "无法加载该回测对应的 K 线数据");
      return;
    }

    if (isDataLoading || isHistoryLoading || !fullDataRef.current.length) {
      return;
    }

    pendingReplayRef.current = null;
    replayDetailRef.current = detail;
    isReplayModeRef.current = true;
    setIsReplayMode(true);
    setReplayingSessionId(null);
    setIsBacktestMode(true);
  }, [
    dataError,
    isBacktestMode,
    isDataLoading,
    isHistoryLoading,
    pendingReplayToken,
    symbol,
    timeframe,
    totalCandles,
  ]);

  useEffect(() => {
    const onPageHide = () => {
      if (!wasBacktestModeRef.current || isReplayModeRef.current) return;
      const barIndex = currentIndexRef.current - 1;
      const candle = fullDataRef.current[barIndex];
      persistRef.current.completeSession({
        cursor_bar_time: candle?.time ?? null,
        cursor_bar_index: barIndex,
        ending_balance: balanceRef.current,
        mark_price: candle?.close || 0,
      });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const applyIndicatorConfig = () => {
    const nextConfig = cloneIndicatorConfig(draftConfig);
    const currentEmaIds = nextConfig.emas.map((e) => e.id);
    if (
      selectedIndicatorRef.current.kind === "ema" &&
      !currentEmaIds.includes(selectedIndicatorRef.current.id)
    ) {
      selectedIndicatorRef.current = { kind: null, id: null };
    }
    if (
      !nextConfig.macd.enabled &&
      (selectedIndicatorRef.current.kind === "macd" ||
        selectedIndicatorRef.current.kind === "signal")
    ) {
      selectedIndicatorRef.current = { kind: null, id: null };
    }
    if (
      !nextConfig.bollinger.enabled &&
      selectedIndicatorRef.current.kind === "bollinger"
    ) {
      selectedIndicatorRef.current = { kind: null, id: null };
    }

    const newEmaData = {};
    nextConfig.emas.forEach((ema) => {
      newEmaData[ema.id] = calculateEMA(fullDataRef.current, ema.period);
    });
    fullEmaDataRef.current = newEmaData;
    fullBollingerDataRef.current = calculateBollingerBands(
      fullDataRef.current,
      nextConfig.bollinger.period,
      nextConfig.bollinger.standardDeviation
    );
    fullMacdDataRef.current = calculateMACD(
      fullDataRef.current,
      nextConfig.macd.fast,
      nextConfig.macd.slow,
      nextConfig.macd.signal
    );

    indConfigRef.current = nextConfig;
    setIndConfig(nextConfig);
    setDraftConfig(nextConfig);
    setIsIndicatorModalOpen(false);

    if (chartRef.current) {
      Object.keys(emaSeriesRefs.current).forEach((id) => {
        if (!currentEmaIds.includes(id)) {
          chartRef.current.removeSeries(emaSeriesRefs.current[id]);
          delete emaSeriesRefs.current[id];
          delete fullEmaDataRef.current[id];
        }
      });
      nextConfig.emas.forEach((ema) => {
        let series = emaSeriesRefs.current[ema.id];
        if (!series) {
          series = chartRef.current.addSeries(LineSeries, {
            color: ema.color,
            lineWidth: ema.lineWidth,
            priceScaleId: "right",
            lastValueVisible: false,
            priceLineVisible: false,
            title: "",
            priceFormat: {
              type: "price",
              precision: priceDecimals,
              minMove: 1 / Math.pow(10, priceDecimals),
            },
          });
          emaSeriesRefs.current[ema.id] = series;
        } else {
          series.applyOptions({ color: ema.color, lineWidth: ema.lineWidth });
        }
        series.setData(
          fullEmaDataRef.current[ema.id].slice(0, currentIndexRef.current)
        );
      });

      if (nextConfig.bollinger.enabled) {
        BOLLINGER_LINE_DEFINITIONS.forEach(({ key, colorKey }) => {
          let series = bollingerSeriesRefs.current[key];
          if (!series) {
            series = chartRef.current.addSeries(LineSeries, {
              color: nextConfig.bollinger[colorKey],
              lineWidth: nextConfig.bollinger.lineWidth,
              priceScaleId: "right",
              lastValueVisible: false,
              priceLineVisible: false,
              title: "",
              priceFormat: {
                type: "price",
                precision: priceDecimals,
                minMove: 1 / Math.pow(10, priceDecimals),
              },
            });
            bollingerSeriesRefs.current[key] = series;
          } else {
            series.applyOptions({
              color: nextConfig.bollinger[colorKey],
              lineWidth: nextConfig.bollinger.lineWidth,
            });
          }
          series.setData(
            toBollingerLineData(
              fullBollingerDataRef.current.slice(0, currentIndexRef.current),
              key
            )
          );
        });
      } else {
        BOLLINGER_LINE_DEFINITIONS.forEach(({ key }) => {
          const series = bollingerSeriesRefs.current[key];
          if (!series) return;
          chartRef.current.removeSeries(series);
          delete bollingerSeriesRefs.current[key];
        });
      }
    }

    if (
      macdHistSeriesRef.current &&
      macdLineSeriesRef.current &&
      macdSignalSeriesRef.current
    ) {
      macdHistSeriesRef.current.applyOptions({
        visible: nextConfig.macd.enabled,
      });
      macdLineSeriesRef.current.applyOptions({
        visible: nextConfig.macd.enabled,
        color: nextConfig.macd.macdColor,
        lineWidth: nextConfig.macd.lineWidth,
      });
      macdSignalSeriesRef.current.applyOptions({
        visible: nextConfig.macd.enabled,
        color: nextConfig.macd.signalColor,
        lineWidth: nextConfig.macd.lineWidth,
      });
      const currentMacdData = fullMacdDataRef.current.slice(
        0,
        currentIndexRef.current
      );
      macdHistSeriesRef.current.setData(
        currentMacdData.map((d) => ({
          time: d.time,
          value: d.hist,
          color: nextConfig.macd.histColors[d.colorType],
        }))
      );
      macdLineSeriesRef.current.setData(
        currentMacdData.map((d) => ({ time: d.time, value: d.macd }))
      );
      macdSignalSeriesRef.current.setData(
        currentMacdData.map((d) => ({ time: d.time, value: d.signal }))
      );
    }
    if (chartRef.current)
      chartRef.current.priceScale("right").applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: nextConfig.macd.enabled ? 0.25 : 0.1,
        },
      });

    applyIndicatorSelectionStyles(nextConfig);

    updateLegend(stateRef.current.lastHoveredTime, nextConfig);
  };

  // ================= 1. 初始化主图表与全量交互逻辑 =================
  useEffect(() => {
    if (!isMounted || !chartContainerRef.current) return;

    const visibleCount =
      currentIndexRef.current ||
      Math.min(INITIAL_VISIBLE_COUNT, fullDataRef.current.length);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: "solid", color: "#111827" },
        textColor: "#9ca3af",
      },
      localization: {
        timeFormatter: (time: Time) =>
          formatChartTimeLabel(time, timeframeRef.current),
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: 0 },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        tickMarkFormatter: (time: Time) =>
          formatChartTimeLabel(time, timeframeRef.current),
      },
      rightPriceScale: { autoScale: isRightPriceAutoScaleEnabled },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceLineVisible: false,
      priceFormat: {
        type: "price",
        precision: priceDecimals,
        minMove: 1 / Math.pow(10, priceDecimals),
      },
    });
    series.setData(fullDataRef.current.slice(0, visibleCount));

    indConfig.emas.forEach((ema) => {
      const emaSeries = chart.addSeries(LineSeries, {
        color: ema.color,
        lineWidth: ema.lineWidth,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
        title: "",
        priceFormat: {
          type: "price",
          precision: priceDecimals,
          minMove: 1 / Math.pow(10, priceDecimals),
        },
      });
      emaSeries.setData(
        fullEmaDataRef.current[ema.id]?.slice(0, visibleCount) || []
      );
      emaSeriesRefs.current[ema.id] = emaSeries;
    });

    if (indConfig.bollinger.enabled) {
      BOLLINGER_LINE_DEFINITIONS.forEach(({ key, colorKey }) => {
        const bollingerSeries = chart.addSeries(LineSeries, {
          color: indConfig.bollinger[colorKey],
          lineWidth: indConfig.bollinger.lineWidth,
          priceScaleId: "right",
          lastValueVisible: false,
          priceLineVisible: false,
          title: "",
          priceFormat: {
            type: "price",
            precision: priceDecimals,
            minMove: 1 / Math.pow(10, priceDecimals),
          },
        });
        bollingerSeries.setData(
          toBollingerLineData(
            fullBollingerDataRef.current.slice(0, visibleCount),
            key
          )
        );
        bollingerSeriesRefs.current[key] = bollingerSeries;
      });
    }
    applyIndicatorSelectionStyles();

    chartRef.current = chart;
    seriesRef.current = series;
    seriesMarkersRef.current = createSeriesMarkers(
      series,
      closedTradeMarkersRef.current,
      { zOrder: "top", autoScale: true }
    );

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current)
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
    };
    window.addEventListener("resize", handleResize);
    let ro = null;
    if (chartContainerRef.current) {
      ro = new ResizeObserver(() => handleResize());
      ro.observe(chartContainerRef.current);
    }

    const crosshairMoveHandler = (param) => {
      if (param.time) {
        stateRef.current.isHovering = true;
        stateRef.current.lastHoveredTime = param.time;
        updateLegend(param.time);
      } else {
        stateRef.current.isHovering = false;
        updateLegend();
      }

      const isSyncedMove = isSyncingCrosshairRef.current;
      if (!isSyncedMove) {
        isSyncingCrosshairRef.current = true;
        try {
          if (param.time) {
            const macdPoint = findPointByTime(
              fullMacdDataRef.current,
              param.time
            );
            applySyncedCrosshair(
              subChartRef.current,
              macdLineSeriesRef.current,
              param.time,
              macdPoint?.macd ?? 0
            );
          } else {
            applySyncedCrosshair(
              subChartRef.current,
              macdLineSeriesRef.current,
              null,
              null
            );
          }
        } finally {
          isSyncingCrosshairRef.current = false;
        }
      }

      if (!param.point || isSyncedMove) return;
      const state = stateRef.current;
      const time = param.time;
      let price = series.coordinateToPrice(param.point.y);

      const dragTime =
        time || chart.timeScale().coordinateToTime(param.point.x);
      if (magnetRef.current && dragTime && price !== null) {
        const candle = fullDataRef.current.find((d) => d.time === dragTime);
        if (candle) {
          const yO = series.priceToCoordinate(candle.open);
          const yH = series.priceToCoordinate(candle.high);
          const yL = series.priceToCoordinate(candle.low);
          const yC = series.priceToCoordinate(candle.close);
          if (yO !== null && yH !== null && yL !== null && yC !== null) {
            const threshold = 15;
            const dists = [
              { p: candle.open, d: Math.abs(param.point.y - yO) },
              { p: candle.high, d: Math.abs(param.point.y - yH) },
              { p: candle.low, d: Math.abs(param.point.y - yL) },
              { p: candle.close, d: Math.abs(param.point.y - yC) },
            ];
            dists.sort((a, b) => a.d - b.d);
            if (dists[0].d < threshold) {
              price = dists[0].p;
            }
          }
        }
      }

      if (dragTime && price !== null)
        state.currentLogical = { time: dragTime, price };

      if (state.draggingOrderLine && price !== null) {
        const { id, type } = state.draggingOrderLine;
        if (orderLinesRef.current[id] && orderLinesRef.current[id][type]) {
          orderLinesRef.current[id][type].applyOptions({ price: price });
          state.draggingOrderLinePrice = price;
        }
        return;
      }

      if (state.mode === "draw" && state.isDrawing && state.activeLine) {
        state.activeLine.updatePoint(2, state.currentLogical);
      } else if (
        state.mode === "idle" &&
        state.dragPointIndex !== null &&
        state.activeLine
      ) {
        if (state.dragPointIndex === "body") {
          const dx = param.point.x - state.dragStartX;
          const dy = param.point.y - state.dragStartY;

          const time1 =
            chart.timeScale().coordinateToTime(state.dragStartCoords.x1 + dx) ||
            state.dragStartP1.time;
          const price1 = series.coordinateToPrice(
            state.dragStartCoords.y1 + dy
          );

          const time2 =
            chart.timeScale().coordinateToTime(state.dragStartCoords.x2 + dx) ||
            state.dragStartP2.time;
          const price2 = series.coordinateToPrice(
            state.dragStartCoords.y2 + dy
          );

          if (price1 !== null && price2 !== null) {
            state.activeLine.updatePoint(1, { time: time1, price: price1 });
            state.activeLine.updatePoint(2, { time: time2, price: price2 });
          }
        } else {
          if (dragTime && price !== null)
            state.activeLine.updatePoint(state.dragPointIndex, {
              time: dragTime,
              price,
            });
        }
      } else if (state.mode === "idle" && !state.dragPointIndex) {
        let foundTrendlineHover = false;
        let foundOrderLineHover = null;
        let hoverType = null;

        const visibleOpenTrades = tradesRef.current.filter(
          (t) => t.status === "Open" && t.visibleOnChart !== false
        );
        for (const trade of visibleOpenTrades) {
          if (trade.sl !== null) {
            const slY = series.priceToCoordinate(trade.sl);
            if (slY !== null && Math.abs(param.point.y - slY) < 6) {
              foundOrderLineHover = { id: trade.id, type: "sl" };
              break;
            }
          }
          if (trade.tp !== null) {
            const tpY = series.priceToCoordinate(trade.tp);
            if (tpY !== null && Math.abs(param.point.y - tpY) < 6) {
              foundOrderLineHover = { id: trade.id, type: "tp" };
              break;
            }
          }
        }

        if (!foundOrderLineHover) {
          for (const line of state.lines) {
            const x1 = chart.timeScale().timeToCoordinate(line.p1.time);
            const y1 = series.priceToCoordinate(line.p1.price);
            const x2 = chart.timeScale().timeToCoordinate(line.p2.time);
            const y2 = series.priceToCoordinate(line.p2.price);

            if (x1 === null || y1 === null || x2 === null || y2 === null)
              continue;

            const px = param.point.x,
              py = param.point.y;

            if (line.type === "rectangle") {
              if (Math.hypot(px - x1, py - y1) < 10) {
                line.setHoveredPoint(1);
                foundTrendlineHover = true;
                hoverType = "handle";
                break;
              }
              if (Math.hypot(px - x2, py - y2) < 10) {
                line.setHoveredPoint(2);
                foundTrendlineHover = true;
                hoverType = "handle";
                break;
              }
              if (Math.hypot(px - x1, py - y2) < 10) {
                line.setHoveredPoint(3);
                foundTrendlineHover = true;
                hoverType = "handle";
                break;
              }
              if (Math.hypot(px - x2, py - y1) < 10) {
                line.setHoveredPoint(4);
                foundTrendlineHover = true;
                hoverType = "handle";
                break;
              }
            } else {
              if (Math.hypot(px - x1, py - y1) < 10) {
                line.setHoveredPoint(1);
                foundTrendlineHover = true;
                hoverType = "handle";
                break;
              }
              if (Math.hypot(px - x2, py - y2) < 10) {
                line.setHoveredPoint(2);
                foundTrendlineHover = true;
                hoverType = "handle";
                break;
              }
            }

            if (line.type === "rectangle") {
              const minX = Math.min(x1, x2),
                maxX = Math.max(x1, x2);
              const minY = Math.min(y1, y2),
                maxY = Math.max(y1, y2);
              if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
                line.setHoveredPoint("body");
                foundTrendlineHover = true;
                hoverType = "body";
                break;
              }
            } else {
              if (
                distToSegmentSquared(
                  { x: px, y: py },
                  { x: x1, y: y1 },
                  { x: x2, y: y2 }
                ) < 36
              ) {
                line.setHoveredPoint("body");
                foundTrendlineHover = true;
                hoverType = "body";
                break;
              }
            }
            line.setHoveredPoint(null);
          }
        } else {
          for (const line of state.lines) line.setHoveredPoint(null);
        }

        state.hoveredOrderLine = foundOrderLineHover;

        if (chartContainerRef.current) {
          const hoveredMarker = resolveTradeMarkerHit(
            chart,
            series,
            fullDataRef.current,
            tradesRef.current,
            param
          );
          const hoveredOpenEntry =
            hoveredMarker?.kind === "entry" &&
            tradesRef.current.some(
              (trade) =>
                String(trade.id) === hoveredMarker.tradeId &&
                trade.status === "Open"
            );

          if (foundOrderLineHover) {
            chartContainerRef.current.style.cursor = "ns-resize";
          } else if (foundTrendlineHover) {
            chartContainerRef.current.style.cursor =
              hoverType === "body" ? "move" : "grab";
          } else if (hoveredOpenEntry) {
            chartContainerRef.current.style.cursor = "pointer";
          } else {
            chartContainerRef.current.style.cursor =
              state.mode === "draw" ? "crosshair" : "default";
          }
        }
      }
    };

    const clickHandler = (param) => {
      const state = stateRef.current;
      if (state.mode === "draw") {
        hideCandleTooltip();
        if (!state.currentLogical) return;
        if (!state.isDrawing) {
          const newLine = new ShapePrimitive(
            state.currentLogical,
            state.currentLogical,
            state.drawType
          );
          series.attachPrimitive(newLine);
          state.activeLine = newLine;
          state.isDrawing = true;
          state.lines.push(newLine);
        } else {
          state.isDrawing = false;
          state.activeLine = null;
          setMode("idle");
          state.mode = "idle";
          setLines([...state.lines]);
        }
        return;
      }

      const markerHit = resolveTradeMarkerHit(
        chart,
        series,
        fullDataRef.current,
        tradesRef.current,
        param
      );
      if (markerHit) {
        hideCandleTooltip();
        if (markerHit.kind === "entry") {
          requestCloseTradeFromMarkerRef.current?.(markerHit.tradeId);
        }
        return;
      }

      const hoveredShape = state.lines.find(
        (line) => line.hoveredPoint !== null
      );
      if (hoveredShape) {
        hideCandleTooltip();
        setSelectedShape(hoveredShape);
        setSelectedIndicator(null);
        return;
      }

      if (!param.point) {
        clearAllSelections();
        return;
      }

      const clickedTime =
        param.time || chart.timeScale().coordinateToTime(param.point.x);
      const clickedEmaId = clickedTime
        ? findClosestEmaAtPoint(clickedTime, param.point.y)
        : null;
      const clickedBollingerLine = clickedTime
        ? findClosestBollingerAtPoint(clickedTime, param.point.y)
        : null;

      if (clickedEmaId) {
        hideCandleTooltip();
        setSelectedShape(null);
        setSelectedIndicator({ kind: "ema", id: clickedEmaId });
        return;
      }

      if (clickedBollingerLine) {
        hideCandleTooltip();
        setSelectedShape(null);
        setSelectedIndicator({
          kind: "bollinger",
          id: clickedBollingerLine,
        });
        return;
      }

      clearAllSelections();

      if (state.hoveredOrderLine) return;
      if (param.hoveredObjectId) return;

      let candleData = param.seriesData?.get(series);
      if (!candleData || candleData.open == null) {
        candleData = clickedTime
          ? fullDataRef.current.find((d) => d.time === clickedTime)
          : null;
      }
      if (!candleData || candleData.open == null) return;

      const nextTooltip = {
        data: candleData,
        point: { x: param.point.x, y: param.point.y },
        left: param.point.x + CANDLE_TOOLTIP_OFFSET.x,
        top: param.point.y,
      };
      candleTooltipRef.current = nextTooltip;
      setCandleTooltip(nextTooltip);
    };

    const mousedownHandler = (e) => {
      if (e.button === 2) return;
      setContextMenu(null);

      const state = stateRef.current;
      if (state.mode !== "idle") return;

      if (state.hoveredOrderLine) {
        state.draggingOrderLine = state.hoveredOrderLine;
        state.draggingOrderLinePrice = null;
        chart.applyOptions({ handleScroll: false, handleScale: false });
        return;
      }

      for (const line of state.lines) {
        if (line.hoveredPoint !== null) {
          setSelectedShape(line);
          setSelectedIndicator(null);
          state.dragPointIndex = line.hoveredPoint;
          state.activeLine = line;

          if (line.hoveredPoint === "body") {
            state.dragStartX =
              e.clientX -
              chartContainerRef.current.getBoundingClientRect().left;
            state.dragStartY =
              e.clientY - chartContainerRef.current.getBoundingClientRect().top;
            state.dragStartP1 = { ...line.p1 };
            state.dragStartP2 = { ...line.p2 };
            state.dragStartCoords = {
              x1: chart.timeScale().timeToCoordinate(line.p1.time),
              y1: series.priceToCoordinate(line.p1.price),
              x2: chart.timeScale().timeToCoordinate(line.p2.time),
              y2: series.priceToCoordinate(line.p2.price),
            };
          }

          chart.applyOptions({ handleScroll: false, handleScale: false });
          if (chartContainerRef.current)
            chartContainerRef.current.style.cursor =
              line.hoveredPoint === "body" ? "move" : "grabbing";
          break;
        }
      }
    };

    const mouseupHandler = () => {
      const state = stateRef.current;

      if (state.draggingOrderLine) {
        if (state.draggingOrderLinePrice !== null) {
          const { id, type } = state.draggingOrderLine;
          updateTradePriceRef.current(id, type, state.draggingOrderLinePrice);
        }
        state.draggingOrderLine = null;
        state.draggingOrderLinePrice = null;
        chart.applyOptions({ handleScroll: true, handleScale: true });
        if (chartContainerRef.current)
          chartContainerRef.current.style.cursor = state.hoveredOrderLine
            ? "ns-resize"
            : "default";
        return;
      }

      if (state.dragPointIndex !== null) {
        state.dragPointIndex = null;
        state.activeLine = null;
        chart.applyOptions({ handleScroll: true, handleScale: true });
        if (chartContainerRef.current)
          chartContainerRef.current.style.cursor = "default";
      }
    };

    const contextMenuHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideCandleTooltip();
      ignoreContextMenuCloseRef.current = true;
      window.setTimeout(() => {
        ignoreContextMenuCloseRef.current = false;
      }, 0);

      const menuWidth = 188;
      const menuHeight = 48;
      const x = Math.max(
        8,
        Math.min(e.clientX, window.innerWidth - menuWidth - 8)
      );
      const y = Math.max(
        8,
        Math.min(e.clientY, window.innerHeight - menuHeight - 8)
      );

      const hoveredShape = stateRef.current.lines.find(
        (l) => l.hoveredPoint !== null
      );
      if (hoveredShape) {
        setSelectedShape(hoveredShape);
        setSelectedIndicator(null);
        setContextMenu({
          kind: "shape",
          x,
          y,
          shapeId: hoveredShape.id,
        });
        return;
      }

      setContextMenu({
        kind: "chart",
        x,
        y,
      });
    };

    const hideMenuOnClick = (event) => {
      if (event?.button === 2 || ignoreContextMenuCloseRef.current) return;
      setContextMenu(null);
    };

    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      )
        return;

      if (e.key === "Delete" || e.key === "Backspace") {
        let hoveredShapeIndex = stateRef.current.lines.findIndex(
          (l) => l.hoveredPoint !== null
        );
        if (hoveredShapeIndex === -1 && selectedShapeIdRef.current) {
          hoveredShapeIndex = stateRef.current.lines.findIndex(
            (l) => l.id === selectedShapeIdRef.current
          );
        }
        if (hoveredShapeIndex !== -1) {
          const shape = stateRef.current.lines[hoveredShapeIndex];
          if (selectedShapeIdRef.current === shape.id) setSelectedShape(null);
          detachShapeFromMainSeries(shape);
          stateRef.current.lines.splice(hoveredShapeIndex, 1);
          stateRef.current.activeLine = null;
          stateRef.current.dragPointIndex = null;
          setLines([...stateRef.current.lines]);
        }
      }
    };

    chart.subscribeCrosshairMove(crosshairMoveHandler);
    chart.subscribeClick(clickHandler);

    const containerEl = chartContainerRef.current;
    if (containerEl) {
      containerEl.addEventListener("mousedown", mousedownHandler);
      containerEl.addEventListener("contextmenu", contextMenuHandler);
    }
    window.addEventListener("mouseup", mouseupHandler);
    window.addEventListener("click", hideMenuOnClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (ro) ro.disconnect();
      chart.unsubscribeCrosshairMove(crosshairMoveHandler);
      chart.unsubscribeClick(clickHandler);
      if (containerEl) {
        containerEl.removeEventListener("mousedown", mousedownHandler);
        containerEl.removeEventListener("contextmenu", contextMenuHandler);
      }
      window.removeEventListener("mouseup", mouseupHandler);
      window.removeEventListener("click", hideMenuOnClick);
      window.removeEventListener("keydown", handleKeyDown);
      resetAutomaticPensState();
      resetAutomaticSegmentsState();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesMarkersRef.current = null;
      emaSeriesRefs.current = {};
      bollingerSeriesRefs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isMounted,
    applyIndicatorSelectionStyles,
    clearAllSelections,
    detachShapeFromMainSeries,
    findClosestBollingerAtPoint,
    findClosestEmaAtPoint,
    resetAutomaticPensState,
    resetAutomaticSegmentsState,
    setSelectedIndicator,
    setSelectedShape,
  ]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      rightPriceScale: { autoScale: isRightPriceAutoScaleEnabled },
    });
  }, [isRightPriceAutoScaleEnabled]);

  // ================= 2. 初始化副图表 (MACD) =================
  useEffect(() => {
    if (!isMounted || !indConfig.macd.enabled || !subChartContainerRef.current)
      return;
    const visibleCount =
      currentIndexRef.current ||
      Math.min(INITIAL_VISIBLE_COUNT, fullMacdDataRef.current.length);
    const subChart = createChart(subChartContainerRef.current, {
      layout: {
        background: { type: "solid", color: "#111827" },
        textColor: "#9ca3af",
      },
      localization: {
        timeFormatter: (time: Time) =>
          formatChartTimeLabel(time, timeframeRef.current),
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: 0 },
      width: subChartContainerRef.current.clientWidth,
      height: subChartContainerRef.current.clientHeight,
      timeScale: {
        visible: true,
        borderColor: "#374151",
        tickMarkFormatter: (time: Time) =>
          formatChartTimeLabel(time, timeframeRef.current),
      },
      rightPriceScale: { borderColor: "#374151" },
    });

    const macdHist = subChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
      title: "",
    });
    const macdLine = subChart.addSeries(LineSeries, {
      color: indConfig.macd.macdColor,
      lineWidth: indConfig.macd.lineWidth,
      lastValueVisible: false,
      priceLineVisible: false,
      title: "",
      priceFormat: {
        type: "price",
        precision: priceDecimals,
        minMove: 1 / Math.pow(10, priceDecimals),
      },
    });
    const signalLine = subChart.addSeries(LineSeries, {
      color: indConfig.macd.signalColor,
      lineWidth: indConfig.macd.lineWidth,
      lastValueVisible: false,
      priceLineVisible: false,
      title: "",
      priceFormat: {
        type: "price",
        precision: priceDecimals,
        minMove: 1 / Math.pow(10, priceDecimals),
      },
    });

    const currentMacdData = fullMacdDataRef.current.slice(0, visibleCount);
    macdHist.setData(
      currentMacdData.map((d) => ({
        time: d.time,
        value: d.hist,
        color: indConfig.macd.histColors[d.colorType],
      }))
    );
    macdLine.setData(
      currentMacdData.map((d) => ({ time: d.time, value: d.macd }))
    );
    signalLine.setData(
      currentMacdData.map((d) => ({ time: d.time, value: d.signal }))
    );

    subChartRef.current = subChart;
    macdHistSeriesRef.current = macdHist;
    macdLineSeriesRef.current = macdLine;
    macdSignalSeriesRef.current = signalLine;
    applyIndicatorSelectionStyles();

    const subCrosshairMoveHandler = (param) => {
      if (param.time) {
        stateRef.current.isHovering = true;
        stateRef.current.lastHoveredTime = param.time;
        updateLegend(param.time);
      } else {
        stateRef.current.isHovering = false;
        updateLegend();
      }

      if (isSyncingCrosshairRef.current) return;

      isSyncingCrosshairRef.current = true;
      try {
        if (param.time) {
          const candle = findPointByTime(fullDataRef.current, param.time);
          applySyncedCrosshair(
            chartRef.current,
            seriesRef.current,
            param.time,
            candle?.close
          );
        } else {
          applySyncedCrosshair(chartRef.current, seriesRef.current, null, null);
        }
      } finally {
        isSyncingCrosshairRef.current = false;
      }
    };
    subChart.subscribeCrosshairMove(subCrosshairMoveHandler);

    const subClickHandler = (param) => {
      if (!param.point) {
        clearAllSelections();
        return;
      }

      const clickedTime =
        param.time || subChart.timeScale().coordinateToTime(param.point.x);
      const clickedMacdKind = clickedTime
        ? findClosestMacdAtPoint(clickedTime, param.point.y)
        : null;

      if (clickedMacdKind) {
        setSelectedShape(null);
        setSelectedIndicator({ kind: clickedMacdKind });
      } else {
        clearAllSelections();
      }
    };
    subChart.subscribeClick(subClickHandler);

    let isSyncingMain = false;
    let isSyncingSub = false;
    if (chartRef.current) {
      const mainTimeScale = chartRef.current.timeScale();
      const subTimeScale = subChart.timeScale();
      const initialRange = mainTimeScale.getVisibleLogicalRange();
      if (initialRange) {
        subTimeScale.setVisibleLogicalRange(initialRange);
      }
      const syncToSub = (logicalRange) => {
        if (!logicalRange || isSyncingMain) return;
        isSyncingSub = true;
        subTimeScale.setVisibleLogicalRange(logicalRange);
        isSyncingSub = false;
      };
      const syncToMain = (logicalRange) => {
        if (!logicalRange || isSyncingSub) return;
        isSyncingMain = true;
        mainTimeScale.setVisibleLogicalRange(logicalRange);
        isSyncingMain = false;
      };
      mainTimeScale.subscribeVisibleLogicalRangeChange(syncToSub);
      subTimeScale.subscribeVisibleLogicalRangeChange(syncToMain);
      subChart.timeScaleSyncCleanup = () => {
        mainTimeScale.unsubscribeVisibleLogicalRangeChange(syncToSub);
        subTimeScale.unsubscribeVisibleLogicalRangeChange(syncToMain);
      };
    }

    const handleResize = () => {
      if (subChartRef.current && subChartContainerRef.current)
        subChartRef.current.applyOptions({
          width: subChartContainerRef.current.clientWidth,
          height: subChartContainerRef.current.clientHeight,
        });
    };
    window.addEventListener("resize", handleResize);
    let ro = null;
    if (subChartContainerRef.current) {
      ro = new ResizeObserver(() => handleResize());
      ro.observe(subChartContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (ro) ro.disconnect();
      subChart.unsubscribeCrosshairMove(subCrosshairMoveHandler);
      subChart.unsubscribeClick(subClickHandler);
      if (subChart.timeScaleSyncCleanup) subChart.timeScaleSyncCleanup();
      subChart.remove();
      subChartRef.current = null;
      macdHistSeriesRef.current = null;
      macdLineSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isMounted,
    indConfig.macd.enabled,
    applyIndicatorSelectionStyles,
    clearAllSelections,
    findClosestMacdAtPoint,
    setSelectedIndicator,
    setSelectedShape,
  ]);

  // ================= 业务逻辑 =================
  const handleNextCandle = useCallback(() => {
    const replayEndCurrent = replayEndCurrentIndexRef.current;
    if (
      isReplayModeRef.current &&
      replayEndCurrent > 0 &&
      currentIndex >= replayEndCurrent
    ) {
      setIsPlaying(false);
      if (!replayFinishedNotifiedRef.current) {
        replayFinishedNotifiedRef.current = true;
        toast("回放已结束，可点击从头播放再看一遍");
      }
      return;
    }

    if (currentIndex >= fullDataRef.current.length) {
      setIsPlaying(false);
      return;
    }

    const nextCandle = fullDataRef.current[currentIndex];
    seriesRef.current.update(nextCandle);
    updateAutomaticPensAfterCandle();
    updateAutomaticSegmentsAfterCandle();

    indConfig.emas.forEach((ema) => {
      const nextEma = fullEmaDataRef.current[ema.id][currentIndex];
      const series = emaSeriesRefs.current[ema.id];
      if (series && nextEma) series.update(nextEma);
    });

    if (indConfig.bollinger.enabled) {
      const nextBollinger = fullBollingerDataRef.current[currentIndex];
      if (nextBollinger) {
        BOLLINGER_LINE_DEFINITIONS.forEach(({ key }) => {
          const series = bollingerSeriesRefs.current[key];
          if (!series) return;
          series.update(
            nextBollinger[key] == null
              ? { time: nextBollinger.time }
              : { time: nextBollinger.time, value: nextBollinger[key] }
          );
        });
      }
    }

    const nextMacd = fullMacdDataRef.current[currentIndex];
    if (subChartRef.current && indConfig.macd.enabled && nextMacd) {
      if (macdHistSeriesRef.current)
        macdHistSeriesRef.current.update({
          time: nextMacd.time,
          value: nextMacd.hist,
          color: indConfig.macd.histColors[nextMacd.colorType],
        });
      if (macdLineSeriesRef.current)
        macdLineSeriesRef.current.update({
          time: nextMacd.time,
          value: nextMacd.macd,
        });
      if (macdSignalSeriesRef.current)
        macdSignalSeriesRef.current.update({
          time: nextMacd.time,
          value: nextMacd.signal,
        });
    }

    let newlyClosed: any[] = [];
    let balanceChange = 0;
    if (isReplayModeRef.current) {
      applyReplayEventsUpTo(nextCandle.time);
      if (replayEndCurrent > 0 && currentIndex + 1 >= replayEndCurrent) {
        setIsPlaying(false);
        if (!replayFinishedNotifiedRef.current) {
          replayFinishedNotifiedRef.current = true;
          toast("回放已结束，可点击从头播放再看一遍");
        }
      }
    } else {
      const nextTrades = tradesRef.current.map((trade) => {
        if (trade.status !== "Open") return trade;
        let closePrice = null;
        let reason = "";
        if (trade.type === "Buy") {
          if (trade.sl !== null && nextCandle.low <= trade.sl) {
            closePrice = trade.sl;
            reason = "SL Hit";
          } else if (trade.tp !== null && nextCandle.high >= trade.tp) {
            closePrice = trade.tp;
            reason = "TP Hit";
          }
        } else if (trade.type === "Sell") {
          if (trade.sl !== null && nextCandle.high >= trade.sl) {
            closePrice = trade.sl;
            reason = "SL Hit";
          } else if (trade.tp !== null && nextCandle.low <= trade.tp) {
            closePrice = trade.tp;
            reason = "TP Hit";
          }
        }
        if (closePrice !== null) {
          const closedTrade = closeTradeRecord(
            trade,
            closePrice,
            reason,
            nextCandle.time
          );
          newlyClosed.push(closedTrade);
          balanceChange += closedTrade.pnl;
          return closedTrade;
        }
        return trade;
      });
      settleClosedTrades(nextTrades, newlyClosed, balanceChange, currentIndex);
    }

    setCurrentIndex((prev) => prev + 1);
  }, [
    applyReplayEventsUpTo,
    settleClosedTrades,
    currentIndex,
    indConfig,
    updateAutomaticPensAfterCandle,
    updateAutomaticSegmentsAfterCandle,
  ]);

  useEffect(() => {
    if (!canUseAutomaticDraw) return;

    const handleAutomaticDrawShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      if (
        event.key.toLowerCase() === "f" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        handleDrawAutomaticPens();
        return;
      }
      if (
        event.key.toLowerCase() === "r" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        handleDrawAutomaticSegments();
      }
    };

    window.addEventListener("keydown", handleAutomaticDrawShortcut);
    return () =>
      window.removeEventListener("keydown", handleAutomaticDrawShortcut);
  }, [
    canUseAutomaticDraw,
    handleDrawAutomaticPens,
    handleDrawAutomaticSegments,
  ]);

  useEffect(() => {
    const handleBacktestShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        !isBacktestMode
      ) {
        return;
      }

      const playbackLimit = isReplayMode
        ? replayBounds.endCurrent
        : totalCandles;
      const canAdvancePlayback =
        playbackLimit > 0 && currentIndex < playbackLimit;

      const key = event.key.toLowerCase();
      if (key === "d" && !isDataLoading && !isPlaying && canAdvancePlayback) {
        event.preventDefault();
        handleNextCandle();
        return;
      }

      if (key === "p" && !isDataLoading && canAdvancePlayback) {
        event.preventDefault();
        setIsPlaying((playing) => !playing);
      }
    };

    window.addEventListener("keydown", handleBacktestShortcut);
    return () => window.removeEventListener("keydown", handleBacktestShortcut);
  }, [
    currentIndex,
    handleNextCandle,
    isBacktestMode,
    isDataLoading,
    isPlaying,
    isReplayMode,
    replayBounds.endCurrent,
    totalCandles,
  ]);

  useEffect(() => {
    let interval;
    if (isPlaying) interval = setInterval(handleNextCandle, 500);
    return () => clearInterval(interval);
  }, [isPlaying, handleNextCandle]);

  const handlePlaceOrder = (type) => {
    if (!isBacktestMode || isReplayModeRef.current) return;
    if (!fullDataRef.current.length || currentPrice <= 0) return;

    const entry = currentPrice;
    const sl = slEnabled
      ? type === "Buy"
        ? entry - slDistance
        : entry + slDistance
      : null;
    const tp = tpEnabled
      ? type === "Buy"
        ? entry + tpDistance
        : entry - tpDistance
      : null;
    const newTrade = {
      id: Date.now(),
      type,
      entry,
      sl,
      tp,
      units: orderUnits,
      status: "Open",
      pnl: 0,
      visibleOnChart: true,
      entryTime: getActiveCandle(fullDataRef.current, currentIndexRef.current)
        ?.time,
    };
    commitTrades([newTrade, ...tradesRef.current]);
    syncTradeMarkers(tradesRef.current);
    if (newTrade.entryTime != null) {
      persistRef.current.recordOpen({
        client_trade_id: String(newTrade.id),
        bar_time: newTrade.entryTime,
        bar_index: currentIndexRef.current - 1,
        side: toPersistSide(type),
        units: orderUnits,
        price: entry,
        sl_price: sl,
        tp_price: tp,
      });
    }
  };

  const handleCloseMarket = (tradeId) => {
    if (isReplayModeRef.current) return;
    const activeCandle = getActiveCandle(
      fullDataRef.current,
      currentIndexRef.current
    );
    const closeTime = activeCandle?.time;
    const closePrice = activeCandle?.close || 0;
    if (closePrice <= 0) return;

    let newlyClosed: any[] = [];
    let balanceChange = 0;
    const nextTrades = tradesRef.current.map((t) => {
      if (t.id === tradeId && t.status === "Open") {
        const closedTrade = closeTradeRecord(
          t,
          closePrice,
          "Market Close",
          closeTime
        );
        newlyClosed.push(closedTrade);
        balanceChange += closedTrade.pnl;
        return closedTrade;
      }
      return t;
    });
    settleClosedTrades(nextTrades, newlyClosed, balanceChange);
  };

  requestCloseTradeFromMarkerRef.current = (tradeId) => {
    if (isReplayModeRef.current) return;
    const trade = tradesRef.current.find(
      (item) => String(item.id) === String(tradeId) && item.status === "Open"
    );
    if (!trade) return;
    setPendingTradeClose({
      kind: "single",
      tradeId: trade.id,
      tradeType: trade.type,
      units: trade.units,
      entry: trade.entry,
    });
  };

  const forceCloseAllOpenTrades = useCallback(() => {
    const activeCandle = getActiveCandle(
      fullDataRef.current,
      currentIndexRef.current
    );
    const markPrice = activeCandle?.close || 0;
    if (markPrice <= 0) return;

    let newlyClosed: any[] = [];
    let balanceChange = 0;
    const nextTrades = tradesRef.current.map((t) => {
      if (t.status !== "Open") return t;
      const closedTrade = closeTradeRecord(
        t,
        markPrice,
        "Forced Market Close",
        activeCandle?.time
      );
      newlyClosed.push(closedTrade);
      balanceChange += closedTrade.pnl;
      return closedTrade;
    });
    settleClosedTrades(nextTrades, newlyClosed, balanceChange);
  }, [settleClosedTrades]);

  const applyMarketChange = useCallback(
    (kind: "symbol" | "timeframe", value: string) => {
      if (kind === "symbol") {
        setSymbol(value);
        return;
      }
      setTimeframe(value);
    },
    []
  );

  const requestMarketChange = useCallback(
    (kind: "symbol" | "timeframe", value: string) => {
      if (kind === "symbol" && value === symbol) return;
      if (kind === "timeframe" && value === timeframe) return;

      const openCount = tradesRef.current.filter(
        (t) => t.status === "Open"
      ).length;

      if (isBacktestMode || openCount > 0) {
        if (openCount > 0) {
          setPendingMarketChange({
            kind,
            value,
            openCount,
            wasBacktestMode: isBacktestMode,
          });
          return;
        }

        // 回测中无未平仓：先退出回测，再切换
        setIsPlaying(false);
        setIsBacktestMode(false);
        applyMarketChange(kind, value);
        return;
      }

      applyMarketChange(kind, value);
    },
    [applyMarketChange, isBacktestMode, symbol, timeframe]
  );

  const handleSyncLatestKline = useCallback(async () => {
    if (isSyncingLatest || isBacktestMode) return;

    const interval = getIntervalByTimeframe(timeframe);
    setIsSyncingLatest(true);
    try {
      const response = await customFetch(
        `/api/market_master/sync/latest?symbol=${encodeURIComponent(
          symbol
        )}&interval=${encodeURIComponent(interval)}`,
        { method: "POST" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const statusMessage =
          response.status === 401
            ? "请先登录后再同步最新 K 线"
            : response.status === 403
              ? "仅超级管理员可同步最新 K 线"
              : payload?.message ||
                payload?.error ||
                payload?.detail ||
                "同步最新 K 线失败";
        throw new Error(statusMessage);
      }

      const result = payload?.data || {};
      const rowsUpserted = Number(result.rows_upserted || 0);
      if (rowsUpserted > 0) {
        toast.success(
          `已将 ${symbol} ${timeframe} 同步到最新，写入 ${rowsUpserted} 根 K 线`
        );
      } else {
        toast.success(`${symbol} ${timeframe} 已是最新`);
      }
      setMarketDataEpoch((current) => current + 1);
    } catch (error: any) {
      toast.error(error?.message || "同步最新 K 线失败");
    } finally {
      setIsSyncingLatest(false);
    }
  }, [customFetch, isBacktestMode, isSyncingLatest, symbol, timeframe]);

  const handleExitBacktest = useCallback(() => {
    forceCloseAllOpenTrades();
    setIsPlaying(false);
    setIsBacktestMode(false);
  }, [forceCloseAllOpenTrades]);

  const handleRestartReplay = useCallback(() => {
    const detail = replayDetailRef.current;
    if (!detail || !isReplayModeRef.current) return;
    applyReplayWindow(detail, { restarted: true });
  }, [applyReplayWindow]);

  const handleReplaySession = useCallback(
    async (publicId: string) => {
      if (!user) return;
      setIsBacktestHistoryOpen(false);
      setReplayingSessionId(publicId);
      try {
        const detail = await persistRef.current.getSession(publicId);
        if (!detail?.public_id) {
          throw new Error("回测记录不存在");
        }
        pendingReplayRef.current = detail;
        setPendingReplayToken((token) => token + 1);
        if (isBacktestMode) {
          handleExitBacktest();
        }
      } catch (error: any) {
        pendingReplayRef.current = null;
        setReplayingSessionId(null);
        toast.error(error?.message || "加载回测记录失败");
      }
    },
    [handleExitBacktest, isBacktestMode, user]
  );

  const confirmPendingMarketChange = useCallback(() => {
    if (!pendingMarketChange) return;
    const { kind, value, wasBacktestMode } = pendingMarketChange;
    forceCloseAllOpenTrades();
    setIsPlaying(false);
    if (wasBacktestMode) {
      setIsBacktestMode(false);
    }
    applyMarketChange(kind, value);
    setPendingMarketChange(null);
  }, [applyMarketChange, forceCloseAllOpenTrades, pendingMarketChange]);

  const cancelPendingMarketChange = useCallback(() => {
    setPendingMarketChange(null);
  }, []);

  const toggleTradeVisibility = (tradeId) => {
    commitTrades(
      tradesRef.current.map((t) =>
        t.id === tradeId
          ? { ...t, visibleOnChart: t.visibleOnChart === false ? true : false }
          : t
      )
    );
  };

  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    const visibleOpenTradeIds = trades
      .filter((t) => t.status === "Open" && t.visibleOnChart !== false)
      .map((t) => t.id);

    Object.keys(orderLinesRef.current).forEach((id) => {
      if (!visibleOpenTradeIds.includes(Number(id))) {
        const lines = orderLinesRef.current[id];
        if (lines.entry) series.removePriceLine(lines.entry);
        if (lines.sl) series.removePriceLine(lines.sl);
        if (lines.tp) series.removePriceLine(lines.tp);
        delete orderLinesRef.current[id];
      }
    });

    trades
      .filter((t) => t.status === "Open" && t.visibleOnChart !== false)
      .forEach((trade) => {
        let lines = orderLinesRef.current[trade.id];
        if (!lines) {
          const entryLine = series.createPriceLine({
            price: trade.entry,
            color: trade.type === "Buy" ? "#10b981" : "#ef4444",
            lineWidth: 2,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${trade.type} ${trade.units}`,
          });
          lines = { entry: entryLine, sl: null, tp: null };
          orderLinesRef.current[trade.id] = lines;
        }
        if (trade.sl !== null) {
          if (!lines.sl) {
            lines.sl = series.createPriceLine({
              price: trade.sl,
              color: "#ef4444",
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: true,
              title: `SL`,
            });
          } else {
            lines.sl.applyOptions({ price: trade.sl });
          }
        } else if (lines.sl) {
          series.removePriceLine(lines.sl);
          lines.sl = null;
        }

        if (trade.tp !== null) {
          if (!lines.tp) {
            lines.tp = series.createPriceLine({
              price: trade.tp,
              color: "#10b981",
              lineWidth: 1,
              lineStyle: 1,
              axisLabelVisible: true,
              title: `TP`,
            });
          } else {
            lines.tp.applyOptions({ price: trade.tp });
          }
        } else if (lines.tp) {
          series.removePriceLine(lines.tp);
          lines.tp = null;
        }
      });
  }, [trades]);

  const openTrades = trades.filter((t) => t.status === "Open");
  const totalFloatingPnl = openTrades.reduce((acc, t) => {
    const pnl =
      t.type === "Buy"
        ? (currentPrice - t.entry) * t.units
        : (t.entry - currentPrice) * t.units;
    return acc + pnl;
  }, 0);

  const setDrawingTool = (type) => {
    hideCandleTooltip();
    setMode("draw");
    setDrawType(type);
    stateRef.current.mode = "draw";
    stateRef.current.drawType = type;
  };

  const handleMenuDelete = () => {
    if (!contextMenu?.shapeId || !seriesRef.current) return;
    const shape = stateRef.current.lines.find(
      (l) => l.id === contextMenu.shapeId
    );
    if (shape) {
      if (selectedShapeIdRef.current === shape.id) setSelectedShape(null);
      detachShapeFromMainSeries(shape);
      stateRef.current.lines = stateRef.current.lines.filter(
        (l) => l.id !== contextMenu.shapeId
      );
      setLines([...stateRef.current.lines]);
    }
    setContextMenu(null);
  };

  const handleMenuCloseAll = () => {
    setContextMenu(null);
    if (isReplayModeRef.current) return;
    const openCount = tradesRef.current.filter(
      (trade) => trade.status === "Open"
    ).length;
    if (!isBacktestMode || openCount === 0) return;
    setPendingTradeClose({ kind: "all", openCount });
  };

  const cancelPendingTradeClose = () => setPendingTradeClose(null);

  const confirmPendingTradeClose = () => {
    if (!pendingTradeClose) return;
    if (pendingTradeClose.kind === "single") {
      handleCloseMarket(pendingTradeClose.tradeId);
    } else {
      forceCloseAllOpenTrades();
    }
    setPendingTradeClose(null);
  };

  const handleMenuConfig = () => {
    if (contextMenu?.shapeId) {
      setShapeConfigModal({ visible: true, shapeId: contextMenu.shapeId });
    }
    setContextMenu(null);
  };

  const updateShapeConfig = (field, value) => {
    const shapeIndex = stateRef.current.lines.findIndex(
      (l) => l.id === shapeConfigModal.shapeId
    );
    if (shapeIndex !== -1) {
      const shape = stateRef.current.lines[shapeIndex];
      shape.updateConfig({ [field]: value });
      if (field === "color" && shape.type === "rectangle") {
        shape.updateConfig({ fillBaseColor: value });
      }
    }
  };

  const openAiModal = useCallback((payload: any) => {
    setAiReviewModal({
      ...createInitialAiReviewModal(),
      ...payload,
      visible: true,
    });
  }, []);

  const handleAIReview = (trade = null) => {
    if (trade) {
      openAiModal({
        type: "single",
        title: "单笔交易深度诊断",
        trade,
        loading: true,
      });
      setTimeout(() => {
        setAiReviewModal((prev) => ({
          ...prev,
          text: buildSingleTradeDiagnosis(trade),
          loading: false,
        }));
      }, MOCK_AI_DELAY_MS.singleTrade);
      return;
    }

    const closedTrades = trades.filter((t) => t.status === "Closed");
    if (closedTrades.length < PROFILE_MIN_CLOSED_TRADES) {
      openAiModal({
        type: "profile",
        title: "数据样本不足",
        text: PROFILE_INSUFFICIENT_TEXT,
        loading: false,
      });
      return;
    }

    openAiModal({
      type: "profile",
      title: "AI 交易习惯画像报告",
      loading: true,
    });

    setTimeout(() => {
      setAiReviewModal((prev) => ({
        ...prev,
        text: buildProfileDiagnosis(closedTrades),
        loading: false,
      }));
    }, MOCK_AI_DELAY_MS.profile);
  };

  const handleAIChartAnalysis = () => {
    if (isAIAnalyzing || !seriesRef.current) return;
    setIsAIAnalyzing(true);

    openAiModal({
      type: "insight",
      title: "AI 盘面深度扫描中...",
      loading: true,
    });

    setTimeout(() => {
      const insight = buildChartInsight(
        fullDataRef.current,
        currentIndexRef.current,
        priceDecimals
      );

      if (!insight.ok) {
        setIsAIAnalyzing(false);
        openAiModal({
          type: "insight",
          title: "数据不足",
          text: insight.message,
          loading: false,
        });
        return;
      }

      const resistanceShape = new ShapePrimitive(
        insight.zones.resistance.p1,
        insight.zones.resistance.p2,
        "rectangle"
      );
      resistanceShape.updateConfig(AI_ZONE_STYLES.resistance);

      const supportShape = new ShapePrimitive(
        insight.zones.support.p1,
        insight.zones.support.p2,
        "rectangle"
      );
      supportShape.updateConfig(AI_ZONE_STYLES.support);

      seriesRef.current.attachPrimitive(resistanceShape);
      seriesRef.current.attachPrimitive(supportShape);
      stateRef.current.lines.push(resistanceShape, supportShape);
      setLines([...stateRef.current.lines]);

      setIsAIAnalyzing(false);
      openAiModal({
        type: "insight",
        title: "AI 盘面形态与趋势识别",
        text: insight.report,
        loading: false,
      });
    }, MOCK_AI_DELAY_MS.chart);
  };

  const setInteractionMode = (nextMode: string) => {
    setMode(nextMode);
    stateRef.current.mode = nextMode;
    if (nextMode !== "idle") hideCandleTooltip();
  };

  const clearAllLines = () => {
    setSelectedShape(null);
    stateRef.current.lines.forEach((line) => detachShapeFromMainSeries(line));
    stateRef.current.lines = [];
    setLines([]);
    clearAutomaticPens();
    clearAutomaticSegments();
  };

  const formatVal = (val) => (val != null ? val.toFixed(priceDecimals) : "-");

  if (!isMounted) return null;

  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-gray-950 font-sans text-gray-200">
      <MarketMasterOverlays
        aiReviewModal={aiReviewModal}
        applyIndicatorConfig={applyIndicatorConfig}
        canCloseAllOpenTrades={
          isBacktestMode && !isReplayMode && openTrades.length > 0
        }
        contextMenu={contextMenu}
        draftConfig={draftConfig}
        handleAddDraftEma={handleAddDraftEma}
        handleIndDragStart={handleIndDragStart}
        handleMenuCloseAll={handleMenuCloseAll}
        handleMenuConfig={handleMenuConfig}
        handleMenuDelete={handleMenuDelete}
        handleRemoveDraftEma={handleRemoveDraftEma}
        handleUpdateDraftEma={handleUpdateDraftEma}
        indConfig={indConfig}
        indicatorModalPos={indicatorModalPos}
        isIndicatorModalOpen={isIndicatorModalOpen}
        priceDecimals={priceDecimals}
        selectedIndTab={selectedIndTab}
        setAiReviewModal={setAiReviewModal}
        setDraftConfig={setDraftConfig}
        setIsIndicatorModalOpen={setIsIndicatorModalOpen}
        setSelectedIndTab={setSelectedIndTab}
        setShapeConfigModal={setShapeConfigModal}
        shapeConfigModal={shapeConfigModal}
        stateRef={stateRef}
        updateShapeConfig={updateShapeConfig}
      />

      <TopBar
        symbol={symbol}
        setSymbol={(nextSymbol: string) =>
          requestMarketChange("symbol", nextSymbol)
        }
        timeframe={timeframe}
        setTimeframe={(nextTimeframe: string) =>
          requestMarketChange("timeframe", nextTimeframe)
        }
        timeframeOptions={TIMEFRAME_OPTIONS}
        mode={mode}
        setMode={setInteractionMode}
        drawType={drawType}
        setDrawingTool={setDrawingTool}
        isMagnetEnabled={isMagnetEnabled}
        setIsMagnetEnabled={setIsMagnetEnabled}
        isRightPriceAutoScaleEnabled={isRightPriceAutoScaleEnabled}
        setIsRightPriceAutoScaleEnabled={setIsRightPriceAutoScaleEnabled}
        handleAIChartAnalysis={handleAIChartAnalysis}
        isAIAnalyzing={isAIAnalyzing}
        setIsIndicatorModalOpen={setIsIndicatorModalOpen}
        drawAutomaticPens={handleDrawAutomaticPens}
        automaticPenCount={automaticPenCount}
        drawAutomaticSegments={handleDrawAutomaticSegments}
        automaticSegmentCount={automaticSegmentCount}
        isAutomaticSegmentBusy={isAutomaticSegmentBusy}
        clearLines={clearAllLines}
        isBacktestMode={isBacktestMode}
        setIsBacktestMode={setIsBacktestMode}
        onExitBacktest={handleExitBacktest}
        currentIndex={currentIndex}
        totalCandles={totalCandles}
        handleNextCandle={handleNextCandle}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        isDataLoading={isDataLoading}
        isHistoryLoading={isHistoryLoading}
        dataError={dataError}
        onSyncLatest={handleSyncLatestKline}
        isSyncingLatest={isSyncingLatest}
        balance={balance}
        totalFloatingPnl={totalFloatingPnl}
        minBacktestCandles={MIN_BACKTEST_CANDLES}
        initialVisibleCount={INITIAL_VISIBLE_COUNT}
        minForwardCandles={MIN_FORWARD_CANDLES}
        onOpenBacktestHistory={() => setIsBacktestHistoryOpen(true)}
        isReplayMode={isReplayMode}
        isReplayFinished={
          isReplayMode &&
          replayBounds.endCurrent > 0 &&
          currentIndex >= replayBounds.endCurrent
        }
        replayPlayed={Math.max(0, currentIndex - replayBounds.startCurrent)}
        replayTotal={Math.max(
          0,
          replayBounds.endCurrent - replayBounds.startCurrent
        )}
        onRestartReplay={handleRestartReplay}
      />

      <MarketWorkspace
        bottomPanelHeight={bottomPanelHeight}
        canPlaceOrder={
          isBacktestMode && !isReplayMode && !isDataLoading && !dataError
        }
        isReplayMode={isReplayMode}
        candleTooltip={candleTooltip}
        candleTooltipElRef={candleTooltipElRef}
        chartContainerRef={chartContainerRef}
        currentPrice={currentPrice}
        dataError={dataError}
        drawType={drawType}
        formatValue={formatVal}
        handleAIReview={handleAIReview}
        handleCloseMarket={handleCloseMarket}
        handlePlaceOrder={handlePlaceOrder}
        hideCandleTooltip={hideCandleTooltip}
        indConfig={indConfig}
        isBottomPanelOpen={isBottomPanelOpen}
        isDataLoading={isDataLoading}
        isHistoryLoading={isHistoryLoading}
        isMaximized={isMaximized}
        isRightPanelOpen={isRightPanelOpen}
        layoutRef={layoutRef}
        legendData={legendData}
        mainColumnRef={mainColumnRef}
        mode={mode}
        orderUnits={orderUnits}
        priceDecimals={priceDecimals}
        rightPanelWidth={rightPanelWidth}
        riskInputStep={activeInstrumentProfile.inputStep}
        setIsBottomPanelOpen={setIsBottomPanelOpen}
        setIsRightPanelOpen={setIsRightPanelOpen}
        setOrderUnits={setOrderUnits}
        setSlDistance={setSlDistance}
        setSlEnabled={setSlEnabled}
        setTpDistance={setTpDistance}
        setTpEnabled={setTpEnabled}
        slDistance={slDistance}
        slEnabled={slEnabled}
        startBottomPanelResize={startBottomPanelResize}
        startRightPanelResize={startRightPanelResize}
        subChartContainerRef={subChartContainerRef}
        symbol={symbol}
        toggleTradeVisibility={toggleTradeVisibility}
        totalCandles={totalCandles}
        tpDistance={tpDistance}
        tpEnabled={tpEnabled}
        trades={trades}
      />

      <BacktestHistoryModal
        isOpen={isBacktestHistoryOpen}
        onClose={() => setIsBacktestHistoryOpen(false)}
        onReplay={handleReplaySession}
        replayingId={replayingSessionId}
      />

      <PendingMarketChangeDialog
        pendingChange={pendingMarketChange}
        onCancel={cancelPendingMarketChange}
        onConfirm={confirmPendingMarketChange}
      />

      <TradeCloseConfirmDialog
        pendingClose={pendingTradeClose}
        currentPrice={currentPrice}
        priceDecimals={priceDecimals}
        onCancel={cancelPendingTradeClose}
        onConfirm={confirmPendingTradeClose}
      />
    </div>
  );
}
