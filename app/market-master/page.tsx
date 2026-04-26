// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Pencil,
  MousePointer2,
  Trash2,
  Play,
  StepForward,
  Pause,
  CircleDollarSign,
  Minimize,
  GripHorizontal,
  Minus,
  Eye,
  EyeOff,
  BarChart2,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Square,
  AlignJustify,
  Settings,
  Trash,
  Magnet,
  Bot,
  Activity,
  Sparkles,
  Loader2,
} from "lucide-react";

import { AiReviewModal } from "@/components/market-master/AiReviewModal";
import { IndicatorConfigModal } from "@/components/market-master/IndicatorConfigModal";
import { ShapeConfigModal } from "@/components/market-master/ShapeConfigModal";
import { TopBar } from "@/components/market-master/TopBar";
import { TradeHistory } from "@/components/market-master/TradeHistory";
import { TradeTerminal } from "@/components/market-master/TradeTerminal";
import { ShapePrimitive, calculateEMA, calculateMACD, generateMockData, distToSegmentSquared } from "@/components/market-master/chart-utils";

// ==========================================
// 4. React 主组件
// ==========================================
const INITIAL_VISIBLE_COUNT = 200;

export default function ChartApp() {
  const [isChartLoaded, setIsChartLoaded] = useState(false);
  const chartContainerRef = useRef<any>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const emaSeriesRefs = useRef<any>({});

  const subChartContainerRef = useRef<any>(null);
  const subChartRef = useRef<any>(null);
  const macdHistSeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const macdSignalSeriesRef = useRef<any>(null);

  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState({
    ema: false,
    macd: false,
  });
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
  const [indConfig, setIndConfig] = useState({
    emas: [
      { id: "ema_1", period: 20, color: "#f59e0b", lineWidth: 2 },
      { id: "ema_2", period: 60, color: "#3b82f6", lineWidth: 1.5 },
    ],
    macd: {
      enabled: false,
      fast: 12,
      slow: 26,
      signal: 9,
      macdColor: "#3b82f6",
      signalColor: "#f97316",
      lineWidth: 1.5,
      histColors: {
        posGrow: "#26a69a",
        posFall: "#b2dfdb",
        negGrow: "#ffcdd2",
        negFall: "#ef5350",
      },
    },
  });

  const [draftConfig, setDraftConfig] = useState(indConfig);

  const [isMagnetEnabled, setIsMagnetEnabled] = useState(true);
  const magnetRef = useRef(isMagnetEnabled);
  useEffect(() => {
    magnetRef.current = isMagnetEnabled;
  }, [isMagnetEnabled]);

  const isMaximized = false;
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);

  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState("D1");
  const priceDecimals = symbol === "XAU/USD" ? 2 : 4;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [initialRawData, setInitialRawData] = useState<any[]>(() =>
    generateMockData(symbol, timeframe, 500)
  );
  const fullDataRef = useRef<any[]>(initialRawData);
  const fullEmaDataRef = useRef<any>({});
  const fullMacdDataRef = useRef<any[]>([]);

  if (Object.keys(fullEmaDataRef.current).length === 0) {
    indConfig.emas.forEach((ema) => {
      fullEmaDataRef.current[ema.id] = calculateEMA(initialRawData, ema.period);
    });
    fullMacdDataRef.current = calculateMACD(initialRawData, 12, 26, 9);
  }

  const [currentIndex, setCurrentIndex] = useState(INITIAL_VISIBLE_COUNT);
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const [isPlaying, setIsPlaying] = useState(false);
  const currentPrice = fullDataRef.current[currentIndex - 1]?.close || 0;
  const [legendData, setLegendData] = useState(null);

  const [balance, setBalance] = useState(100000);
  const [trades, setTrades] = useState([]);
  const [orderUnits, setOrderUnits] = useState(1);
  const [slEnabled, setSlEnabled] = useState(true);
  const [slDistance, setSlDistance] = useState(20);
  const [tpEnabled, setTpEnabled] = useState(true);
  const [tpDistance, setTpDistance] = useState(40);

  const tradesRef = useRef<any[]>(trades);
  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);
  const orderLinesRef = useRef<any>({});
  const updateTradePriceRef = useRef<any>();

  updateTradePriceRef.current = (tradeId: any, type: any, newPrice: any) => {
    setTrades((prev) =>
      prev.map((t) => (t.id === tradeId ? { ...t, [type]: newPrice } : t))
    );
  };

  const [aiReviewModal, setAiReviewModal] = useState({
    visible: false,
    type: "single",
    trade: null,
    title: "",
    text: "",
    loading: false,
  });

  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);

  const [mode, setMode] = useState("idle");
  const [drawType, setDrawType] = useState("line");
  const [lines, setLines] = useState([]);

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

  const updateLegend = useCallback(
    (hoveredTime: any) => {
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
        const emasData = indConfig.emas
          .map((ema) => {
            const eData = fullEmaDataRef.current[ema.id];
            return {
              period: ema.period,
              color: ema.color,
              value: eData && eData[index] ? eData[index].value : null,
            };
          })
          .filter((ema) => ema.value !== null);

        setLegendData({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          emas: emasData,
          macd: m ? m.macd : null,
          signal: m ? m.signal : null,
          hist: m ? m.hist : null,
        });
      }
    },
    [indConfig]
  );

  useEffect(() => {
    updateLegend(stateRef.current.lastHoveredTime);
  }, [currentIndex, symbol, timeframe, updateLegend, indConfig]);

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
    if (window.LightweightCharts) {
      setIsChartLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js";
    script.async = true;
    script.onload = () => setIsChartLoaded(true);
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setTrades([]);
    Object.values(orderLinesRef.current).forEach((lines) => {
      if (lines.entry && seriesRef.current)
        seriesRef.current.removePriceLine(lines.entry);
      if (lines.sl && seriesRef.current)
        seriesRef.current.removePriceLine(lines.sl);
      if (lines.tp && seriesRef.current)
        seriesRef.current.removePriceLine(lines.tp);
    });
    orderLinesRef.current = {};
    if (symbol === "XAU/USD") {
      setSlDistance(20);
      setTpDistance(40);
    } else {
      setSlDistance(0.005);
      setTpDistance(0.01);
    }

    const newData = generateMockData(symbol, timeframe, 500);
    fullDataRef.current = newData;

    const newEmaData = {};
    indConfig.emas.forEach((ema) => {
      newEmaData[ema.id] = calculateEMA(newData, ema.period);
    });
    fullEmaDataRef.current = newEmaData;
    fullMacdDataRef.current = calculateMACD(
      newData,
      indConfig.macd.fast,
      indConfig.macd.slow,
      indConfig.macd.signal
    );

    setCurrentIndex(INITIAL_VISIBLE_COUNT);

    if (seriesRef.current) {
      seriesRef.current.setData(newData.slice(0, INITIAL_VISIBLE_COUNT));
      indConfig.emas.forEach((ema) => {
        if (emaSeriesRefs.current[ema.id])
          emaSeriesRefs.current[ema.id].setData(
            fullEmaDataRef.current[ema.id].slice(0, INITIAL_VISIBLE_COUNT)
          );
      });
      if (
        macdHistSeriesRef.current &&
        macdLineSeriesRef.current &&
        macdSignalSeriesRef.current
      ) {
        const initialMacd = fullMacdDataRef.current.slice(
          0,
          INITIAL_VISIBLE_COUNT
        );
        macdHistSeriesRef.current.setData(
          initialMacd.map((d) => ({
            time: d.time,
            value: d.hist,
            color: indConfig.macd.histColors[d.colorType],
          }))
        );
        macdLineSeriesRef.current.setData(
          initialMacd.map((d) => ({ time: d.time, value: d.macd }))
        );
        macdSignalSeriesRef.current.setData(
          initialMacd.map((d) => ({ time: d.time, value: d.signal }))
        );
      }
      if (chartRef.current) chartRef.current.timeScale().fitContent();
      if (subChartRef.current) subChartRef.current.timeScale().fitContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  const applyIndicatorConfig = () => {
    const currentEmaIds = draftConfig.emas.map((e) => e.id);
    const newEmaData = {};
    draftConfig.emas.forEach((ema) => {
      newEmaData[ema.id] = calculateEMA(fullDataRef.current, ema.period);
    });
    fullEmaDataRef.current = newEmaData;
    fullMacdDataRef.current = calculateMACD(
      fullDataRef.current,
      draftConfig.macd.fast,
      draftConfig.macd.slow,
      draftConfig.macd.signal
    );

    setIndConfig(draftConfig);
    setIsIndicatorModalOpen(false);

    if (chartRef.current) {
      Object.keys(emaSeriesRefs.current).forEach((id) => {
        if (!currentEmaIds.includes(id)) {
          chartRef.current.removeSeries(emaSeriesRefs.current[id]);
          delete emaSeriesRefs.current[id];
          delete fullEmaDataRef.current[id];
        }
      });
      draftConfig.emas.forEach((ema) => {
        let series = emaSeriesRefs.current[ema.id];
        if (!series) {
          series = chartRef.current.addLineSeries({
            color: ema.color,
            lineWidth: ema.lineWidth,
            priceScaleId: "right",
            lastValueVisible: false,
            priceLineVisible: false,
            title: "",
          });
          emaSeriesRefs.current[ema.id] = series;
        } else {
          series.applyOptions({ color: ema.color, lineWidth: ema.lineWidth });
        }
        series.setData(
          fullEmaDataRef.current[ema.id].slice(0, currentIndexRef.current)
        );
      });
    }

    if (
      macdHistSeriesRef.current &&
      macdLineSeriesRef.current &&
      macdSignalSeriesRef.current
    ) {
      macdHistSeriesRef.current.applyOptions({
        visible: draftConfig.macd.enabled,
      });
      macdLineSeriesRef.current.applyOptions({
        visible: draftConfig.macd.enabled,
        color: draftConfig.macd.macdColor,
        lineWidth: draftConfig.macd.lineWidth,
      });
      macdSignalSeriesRef.current.applyOptions({
        visible: draftConfig.macd.enabled,
        color: draftConfig.macd.signalColor,
        lineWidth: draftConfig.macd.lineWidth,
      });
      const currentMacdData = fullMacdDataRef.current.slice(
        0,
        currentIndexRef.current
      );
      macdHistSeriesRef.current.setData(
        currentMacdData.map((d) => ({
          time: d.time,
          value: d.hist,
          color: draftConfig.macd.histColors[d.colorType],
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
          bottom: draftConfig.macd.enabled ? 0.25 : 0.1,
        },
      });

    updateLegend(stateRef.current.lastHoveredTime);
  };

  // ================= 1. 初始化主图表与全量交互逻辑 =================
  useEffect(() => {
    if (!isChartLoaded || !chartContainerRef.current) return;

    const chart = window.LightweightCharts.createChart(
      chartContainerRef.current,
      {
        layout: {
          background: { type: "solid", color: "#111827" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        crosshair: { mode: 0 },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      }
    );

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    series.setData(fullDataRef.current.slice(0, INITIAL_VISIBLE_COUNT));

    indConfig.emas.forEach((ema) => {
      const emaSeries = chart.addLineSeries({
        color: ema.color,
        lineWidth: ema.lineWidth,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
        title: "",
      });
      emaSeries.setData(
        fullEmaDataRef.current[ema.id].slice(0, INITIAL_VISIBLE_COUNT)
      );
      emaSeriesRefs.current[ema.id] = emaSeries;
    });

    chartRef.current = chart;
    seriesRef.current = series;

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

      if (!param.point) return;
      const state = stateRef.current;
      const time = param.time;
      let price = series.coordinateToPrice(param.point.y);

      let dragTime = time || chart.timeScale().coordinateToTime(param.point.x);
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
          if (foundOrderLineHover) {
            chartContainerRef.current.style.cursor = "ns-resize";
          } else if (foundTrendlineHover) {
            chartContainerRef.current.style.cursor =
              hoverType === "body" ? "move" : "grab";
          } else {
            chartContainerRef.current.style.cursor =
              state.mode === "draw" ? "crosshair" : "default";
          }
        }
      }
    };

    const clickHandler = (param) => {
      const state = stateRef.current;
      if (state.mode !== "draw" || !state.currentLogical) return;
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
      const hoveredShape = stateRef.current.lines.find(
        (l) => l.hoveredPoint !== null
      );
      if (hoveredShape) {
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          shapeId: hoveredShape.id,
        });
      } else {
        setContextMenu(null);
      }
    };

    const hideMenuOnClick = () => setContextMenu(null);

    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      )
        return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const hoveredShapeIndex = stateRef.current.lines.findIndex(
          (l) => l.hoveredPoint !== null
        );
        if (hoveredShapeIndex !== -1) {
          const shape = stateRef.current.lines[hoveredShapeIndex];
          if (seriesRef.current) seriesRef.current.detachPrimitive(shape);
          stateRef.current.lines.splice(hoveredShapeIndex, 1);
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
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      emaSeriesRefs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChartLoaded]);

  // ================= 2. 初始化副图表 (MACD) =================
  useEffect(() => {
    if (
      !indConfig.macd.enabled ||
      !isChartLoaded ||
      !subChartContainerRef.current
    )
      return;
    const subChart = window.LightweightCharts.createChart(
      subChartContainerRef.current,
      {
        layout: {
          background: { type: "solid", color: "#111827" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        crosshair: { mode: 0 },
        width: subChartContainerRef.current.clientWidth,
        height: subChartContainerRef.current.clientHeight,
        timeScale: { visible: true, borderColor: "#374151" },
        rightPriceScale: { borderColor: "#374151" },
      }
    );

    const macdHist = subChart.addHistogramSeries({
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
      title: "",
    });
    const macdLine = subChart.addLineSeries({
      color: indConfig.macd.macdColor,
      lineWidth: indConfig.macd.lineWidth,
      lastValueVisible: false,
      priceLineVisible: false,
      title: "",
    });
    const signalLine = subChart.addLineSeries({
      color: indConfig.macd.signalColor,
      lineWidth: indConfig.macd.lineWidth,
      lastValueVisible: false,
      priceLineVisible: false,
      title: "",
    });

    const currentMacdData = fullMacdDataRef.current.slice(
      0,
      currentIndexRef.current
    );
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

    const subCrosshairMoveHandler = (param) => {
      if (param.time) {
        stateRef.current.isHovering = true;
        stateRef.current.lastHoveredTime = param.time;
        updateLegend(param.time);
      } else {
        stateRef.current.isHovering = false;
        updateLegend();
      }
    };
    subChart.subscribeCrosshairMove(subCrosshairMoveHandler);

    let isSyncingMain = false;
    let isSyncingSub = false;
    if (chartRef.current) {
      const mainTimeScale = chartRef.current.timeScale();
      const subTimeScale = subChart.timeScale();
      subTimeScale.setVisibleLogicalRange(
        mainTimeScale.getVisibleLogicalRange()
      );
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
      if (subChart.timeScaleSyncCleanup) subChart.timeScaleSyncCleanup();
      subChart.remove();
      subChartRef.current = null;
      macdHistSeriesRef.current = null;
      macdLineSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChartLoaded, indConfig.macd.enabled]);

  // ================= 业务逻辑 =================
  const handleNextCandle = useCallback(() => {
    if (currentIndex >= fullDataRef.current.length) {
      setIsPlaying(false);
      return;
    }

    const nextCandle = fullDataRef.current[currentIndex];
    seriesRef.current.update(nextCandle);

    indConfig.emas.forEach((ema) => {
      const nextEma = fullEmaDataRef.current[ema.id][currentIndex];
      const series = emaSeriesRefs.current[ema.id];
      if (series && nextEma) series.update(nextEma);
    });

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

    setTrades((prevTrades) => {
      let balanceChange = 0;
      const updatedTrades = prevTrades.map((trade) => {
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
          const pnl =
            trade.type === "Buy"
              ? (closePrice - trade.entry) * trade.units
              : (trade.entry - closePrice) * trade.units;
          balanceChange += pnl;
          return { ...trade, status: "Closed", closePrice, pnl, reason };
        }
        return trade;
      });
      if (balanceChange !== 0) setBalance((b) => b + balanceChange);
      return updatedTrades;
    });

    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, indConfig]);

  useEffect(() => {
    let interval;
    if (isPlaying) interval = setInterval(handleNextCandle, 500);
    return () => clearInterval(interval);
  }, [isPlaying, handleNextCandle]);

  const handlePlaceOrder = (type) => {
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
    };
    setTrades([newTrade, ...trades]);
  };

  const handleCloseMarket = (tradeId) => {
    setTrades((prev) => {
      let balanceChange = 0;
      const updated = prev.map((t) => {
        if (t.id === tradeId && t.status === "Open") {
          const pnl =
            t.type === "Buy"
              ? (currentPrice - t.entry) * t.units
              : (t.entry - currentPrice) * t.units;
          balanceChange += pnl;
          return {
            ...t,
            status: "Closed",
            closePrice: currentPrice,
            pnl,
            reason: "Market Close",
          };
        }
        return t;
      });
      if (balanceChange !== 0) setBalance((b) => b + balanceChange);
      return updated;
    });
  };

  const toggleTradeVisibility = (tradeId) => {
    setTrades((prev) =>
      prev.map((t) =>
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
      seriesRef.current.detachPrimitive(shape);
      stateRef.current.lines = stateRef.current.lines.filter(
        (l) => l.id !== contextMenu.shapeId
      );
      setLines([...stateRef.current.lines]);
    }
    setContextMenu(null);
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

  const handleAIReview = (trade = null) => {
    if (trade) {
      setAiReviewModal({
        visible: true,
        type: "single",
        title: "单笔交易深度诊断",
        trade,
        text: "",
        loading: true,
      });
      setTimeout(() => {
        let analysis = "";
        const isWin = trade.pnl > 0;
        if (isWin) {
          if (trade.reason === "TP Hit")
            analysis =
              "🤖 AI 深度诊断：\n这是一笔非常完美的交易！\n\n你不仅准确预判了市场方向，并且严格执行了交易计划（触及止盈离场）。这种“计划你的交易，交易你的计划”的纪律性是长期稳定盈利的核心。建议回顾入场时的 K 线形态和指标状态，将其固化为你的高胜率标准交易模型。\n\n综合评级：⭐⭐⭐⭐⭐ (S级)";
          else
            analysis =
              "🤖 AI 深度诊断：\n不错的盈利单，但在执行上有一点小瑕疵。\n\n系统检测到你是手动提前平仓的，这意味着你未能让利润奔跑到原定的 TP（止盈）目标。这通常是由于盘中价格波动导致的“落袋为安”的恐慌心理。建议复盘平仓后的图表，看看行情是否最终到达了你的目标位，以此来锻炼自己的持仓心态。\n\n综合评级：⭐⭐⭐⭐ (A级)";
        } else {
          if (trade.reason === "SL Hit")
            analysis =
              "🤖 AI 深度诊断：\n这笔交易触及了止损，但请不要气馁！\n\n严格执行止损是职业交易员和业余玩家的最大区别，你成功保护了本金安全，避免了深套。对于这笔亏损，建议复盘两点：\n1. 入场点是否处于胜率较低的震荡区间中间位置？\n2. 止损距离是否设置过窄，导致被市场正常波动扫掉（俗称洗盘）？\n\n综合评级：⭐⭐⭐ (B+级)";
          else
            analysis =
              "🤖 AI 深度诊断：\n你选择了手动斩仓，及时截断了亏损。\n\n果断手动平仓说明你在盘中察觉到了原始的入场逻辑已经被破坏。虽然结果是亏损，但这是一种主动的风险控制行为。建议下次在开仓前，更耐心地等待绝佳的技术共振信号（如 EMA 均线支撑与 MACD 金叉的配合），进一步提高开仓胜率。\n\n综合评级：⭐⭐⭐ (B级)";
        }
        setAiReviewModal((prev) => ({
          ...prev,
          text: analysis,
          loading: false,
        }));
      }, 1800);
    } else {
      const closedTrades = trades.filter((t) => t.status === "Closed");
      if (closedTrades.length < 3) {
        setAiReviewModal({
          visible: true,
          type: "profile",
          title: "数据样本不足",
          trade: null,
          text: "⚠️ AI 提示：\n由于你需要分析交易习惯，系统需要至少 **3 笔已平仓**的交易记录来提取你的操作特征。\n\n请继续在模拟环境中进行交易，积累足够的数据后再来生成画像报告。",
          loading: false,
        });
        return;
      }

      setAiReviewModal({
        visible: true,
        type: "profile",
        title: "AI 交易习惯画像报告",
        trade: null,
        text: "",
        loading: true,
      });

      setTimeout(() => {
        const wins = closedTrades.filter((t) => t.pnl > 0);
        const losses = closedTrades.filter((t) => t.pnl <= 0);
        const winRate = ((wins.length / closedTrades.length) * 100).toFixed(1);
        const totalPnl = closedTrades
          .reduce((acc, t) => acc + t.pnl, 0)
          .toFixed(2);
        const manualCloses = closedTrades.filter(
          (t) => t.reason === "Market Close"
        ).length;

        let profileText = `📊 **数据统计**\n• 总交易笔数: ${closedTrades.length} 笔\n• 胜率: ${winRate}%\n• 累计盈亏: $${totalPnl}\n• 手动干预次数: ${manualCloses} 笔\n\n`;
        profileText += `🧠 **AI 行为特征提取**\n`;

        if (winRate > 60 && totalPnl > 0) {
          profileText += `你展现出了极佳的交易直觉和顺势能力。较高的胜率说明你的入场时机把握得当。\n`;
        } else if (winRate > 50 && totalPnl < 0) {
          profileText += `【警报】典型的“盈亏比失衡”！你的胜率尚可，但总体亏损，说明你总是“赢点小钱就跑，亏了大钱死扛”。请务必坚持设置止损！\n`;
        } else {
          profileText += `当前交易系统尚未稳定。胜率偏低可能意味着你在频繁地逆势抄底摸顶。建议放宽时间周期（如切换到 H4 级别），等待明确的趋势确立后再进场。\n`;
        }

        if (manualCloses > closedTrades.length * 0.5) {
          profileText += `\n💡 **心理状态分析**\n你非常频繁地进行手动平仓（未触及 SL/TP），这反映出你可能在盘中容易受到价格波动的惊吓，缺乏持仓耐心。建议：一旦下单设定好止损止盈，就关掉图表，让概率为你工作。`;
        }

        setAiReviewModal((prev) => ({
          ...prev,
          text: profileText,
          loading: false,
        }));
      }, 2500);
    }
  };

  const handleAIChartAnalysis = () => {
    if (isAIAnalyzing || !seriesRef.current) return;
    setIsAIAnalyzing(true);

    setAiReviewModal({
      visible: true,
      type: "insight",
      title: "AI 盘面深度扫描中...",
      trade: null,
      text: "",
      loading: true,
    });

    setTimeout(() => {
      const currentIndex = currentIndexRef.current;
      const windowSize = 50;

      // 找到当前数据范围，避免超出产生 null
      const startIndex = Math.max(0, currentIndex - windowSize);
      const recentData = fullDataRef.current.slice(startIndex, currentIndex);
      const currentCandle = recentData[recentData.length - 1];

      if (recentData.length < 10) {
        setIsAIAnalyzing(false);
        setAiReviewModal({
          visible: true,
          type: "insight",
          title: "数据不足",
          trade: null,
          text: "K线数据不足，无法进行AI扫描。",
          loading: false,
        });
        return;
      }

      let maxCandle = recentData[0];
      let minCandle = recentData[0];
      recentData.forEach((d) => {
        if (d.high > maxCandle.high) maxCandle = d;
        if (d.low < minCandle.low) minCandle = d;
      });

      // 【修复BUG】将左右边界严格限制在当前已有的 K 线数据范围内，防止时间坐标越界返回 null
      const leftTime = recentData[0].time;
      const rightTime = currentCandle.time;

      const resTolerance = maxCandle.high * 0.001;
      const supTolerance = minCandle.low * 0.001;

      // 自动绘制阻力区 (红色矩形)
      const resP1 = { time: leftTime, price: maxCandle.high + resTolerance };
      const resP2 = { time: rightTime, price: maxCandle.high - resTolerance };
      const resShape = new ShapePrimitive(resP1, resP2, "rectangle");
      resShape.updateConfig({
        fillBaseColor: "#ef5350",
        color: "#ef5350",
        lineWidth: 1,
      });

      // 自动绘制支撑区 (绿色矩形)
      const supP1 = { time: leftTime, price: minCandle.low + supTolerance };
      const supP2 = { time: rightTime, price: minCandle.low - supTolerance };
      const supShape = new ShapePrimitive(supP1, supP2, "rectangle");
      supShape.updateConfig({
        fillBaseColor: "#26a69a",
        color: "#26a69a",
        lineWidth: 1,
      });

      seriesRef.current.attachPrimitive(resShape);
      seriesRef.current.attachPrimitive(supShape);
      stateRef.current.lines.push(resShape, supShape);
      setLines([...stateRef.current.lines]);

      const trendText =
        currentCandle.close >
        minCandle.low + (maxCandle.high - minCandle.low) * 0.5
          ? "多头占优（当前价格运行在近期波动区间上半轴）"
          : "空头占优（当前价格运行在近期波动区间下半轴）";

      const report =
        `🤖 **AI 盘面视觉深度扫描完成**\n\n` +
        `📊 **大局观趋势**：${trendText}\n\n` +
        `🎯 **关键博弈区域提取**：\n` +
        `• 上方强阻力区：已在图表自动标记红色矩形区间 (约 ${maxCandle.high.toFixed(priceDecimals)} 附近)\n` +
        `• 下方强支撑区：已在图表自动标记绿色矩形区间 (约 ${minCandle.low.toFixed(priceDecimals)} 附近)\n\n` +
        `💡 **形态识别与策略建议**：\n` +
        `通过扫描近 50 根 K 线的微观结构，AI 察觉到价格波幅正在测试边界。目前价格运行在关键支撑与阻力之间，属于“盈亏比非对称区”。\n\n` +
        `**执行建议**：在价格未有效突破上方红色阻力区，或未跌破下方绿色支撑区前，建议维持“高抛低吸”的震荡区间思维；一旦出现实体 K 线强力突破边界，可切换为“顺势跟进”模型。`;

      setIsAIAnalyzing(false);
      setAiReviewModal({
        visible: true,
        type: "insight",
        title: "AI 盘面形态与趋势识别",
        trade: null,
        text: report,
        loading: false,
      });
    }, 2500);
  };

  const formatVal = (val) => (val != null ? val.toFixed(priceDecimals) : "-");

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-screen w-full bg-gray-950 font-sans text-gray-200">
      <AiReviewModal aiReviewModal={aiReviewModal} setAiReviewModal={setAiReviewModal} priceDecimals={priceDecimals} />

      {/* 悬浮上下文菜单 */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-100 w-36 bg-gray-800 border border-gray-700 rounded-md shadow-2xl py-1"
        >
          <button
            onClick={handleMenuConfig}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-gray-300 hover:text-white flex items-center gap-2"
          >
            <Settings size={14} /> 样式配置
          </button>
          <div className="h-px bg-gray-700 my-1"></div>
          <button
            onClick={handleMenuDelete}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-red-400 flex items-center gap-2"
          >
            <Trash size={14} /> 删除图形
          </button>
        </div>
      )}

      <ShapeConfigModal
        shapeConfigModal={shapeConfigModal}
        setShapeConfigModal={setShapeConfigModal}
        updateShapeConfig={updateShapeConfig}
        stateRef={stateRef}
      />

      <IndicatorConfigModal
        isIndicatorModalOpen={isIndicatorModalOpen}
        setIsIndicatorModalOpen={setIsIndicatorModalOpen}
        indicatorModalPos={indicatorModalPos}
        handleIndDragStart={handleIndDragStart}
        selectedIndTab={selectedIndTab}
        setSelectedIndTab={setSelectedIndTab}
        draftConfig={draftConfig}
        setDraftConfig={setDraftConfig}
        handleAddDraftEma={handleAddDraftEma}
        handleRemoveDraftEma={handleRemoveDraftEma}
        handleUpdateDraftEma={handleUpdateDraftEma}
        applyIndicatorConfig={applyIndicatorConfig}
        indConfig={indConfig}
      />

      <TopBar
        symbol={symbol} setSymbol={setSymbol} timeframe={timeframe} setTimeframe={setTimeframe}
        mode={mode} setMode={(m) => { setMode(m); stateRef.current.mode = m; }}
        drawType={drawType} setDrawingTool={setDrawingTool}
        isMagnetEnabled={isMagnetEnabled} setIsMagnetEnabled={setIsMagnetEnabled}
        handleAIChartAnalysis={handleAIChartAnalysis} isAIAnalyzing={isAIAnalyzing}
        setIsIndicatorModalOpen={setIsIndicatorModalOpen}
        clearLines={() => {
          stateRef.current.lines.forEach((l) => seriesRef.current?.detachPrimitive(l));
          stateRef.current.lines = [];
          setLines([]);
        }}
        currentIndex={currentIndex} handleNextCandle={handleNextCandle}
        isPlaying={isPlaying} setIsPlaying={setIsPlaying}
        balance={balance} totalFloatingPnl={totalFloatingPnl}
      />

      {/* === 核心布局区域 === */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 relative bg-[#111827]">
            {!isChartLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                加载图表引擎中...
              </div>
            )}

            {legendData && (
              <div className="absolute top-3 left-4 z-10 flex items-center gap-4 text-xs font-mono pointer-events-none bg-gray-900/60 px-3 py-1.5 rounded border border-gray-700/50 backdrop-blur-sm">
                <div className="text-gray-400 font-semibold tracking-wider">
                  {symbol}
                </div>
                <div className="flex gap-3 text-gray-400 border-r border-gray-600 pr-4">
                  <span>
                    O{" "}
                    <span
                      className={
                        legendData.close >= legendData.open
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatVal(legendData.open)}
                    </span>
                  </span>
                  <span>
                    H{" "}
                    <span
                      className={
                        legendData.close >= legendData.open
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatVal(legendData.high)}
                    </span>
                  </span>
                  <span>
                    L{" "}
                    <span
                      className={
                        legendData.close >= legendData.open
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatVal(legendData.low)}
                    </span>
                  </span>
                  <span>
                    C{" "}
                    <span
                      className={
                        legendData.close >= legendData.open
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatVal(legendData.close)}
                    </span>
                  </span>
                </div>
                <div className="flex gap-3">
                  {legendData.emas.map((ema, idx) => (
                    <div
                      key={idx}
                      className="font-semibold drop-shadow-md"
                      style={{ color: ema.color }}
                    >
                      EMA({ema.period}): {formatVal(ema.value)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === "draw" && (
              <div className="absolute top-12 left-4 z-10 bg-blue-600/20 border border-blue-500 text-blue-400 text-xs px-3 py-1.5 rounded-full pointer-events-none">
                画线模式 (
                {drawType === "line"
                  ? "直线"
                  : drawType === "rectangle"
                    ? "矩形"
                    : "斐波那契"}
                )
              </div>
            )}
            <div ref={chartContainerRef} className="absolute inset-0" />
          </div>

          {indConfig.macd.enabled && (
            <div className="h-48 relative border-t border-gray-800 bg-[#111827] shrink-0">
              {legendData && (
                <div className="absolute top-2 left-4 z-10 flex items-center gap-4 text-xs font-mono pointer-events-none bg-gray-900/60 px-3 py-1.5 rounded border border-gray-700/50 backdrop-blur-sm">
                  <div className="text-gray-400 font-semibold tracking-wider">
                    MACD ({indConfig.macd.fast},{indConfig.macd.slow},
                    {indConfig.macd.signal})
                  </div>
                  <div style={{ color: indConfig.macd.macdColor }}>
                    MACD: {formatVal(legendData.macd)}
                  </div>
                  <div style={{ color: indConfig.macd.signalColor }}>
                    Sig: {formatVal(legendData.signal)}
                  </div>
                  <div
                    className={
                      legendData.hist >= 0 ? "text-emerald-400" : "text-red-400"
                    }
                  >
                    Hist: {formatVal(legendData.hist)}
                  </div>
                </div>
              )}
              <div ref={subChartContainerRef} className="absolute inset-0" />
            </div>
          )}

          <TradeHistory
            isBottomPanelOpen={isBottomPanelOpen}
            setIsBottomPanelOpen={setIsBottomPanelOpen}
            trades={trades}
            currentPrice={currentPrice}
            priceDecimals={priceDecimals}
            toggleTradeVisibility={toggleTradeVisibility}
            handleCloseMarket={handleCloseMarket}
            handleAIReview={handleAIReview}
            isMaximized={isMaximized}
          />
        </div>

        <TradeTerminal
          isRightPanelOpen={isRightPanelOpen}
          setIsRightPanelOpen={setIsRightPanelOpen}
          symbol={symbol}
          currentPrice={currentPrice}
          orderUnits={orderUnits}
          setOrderUnits={setOrderUnits}
          slEnabled={slEnabled}
          setSlEnabled={setSlEnabled}
          slDistance={slDistance}
          setSlDistance={setSlDistance}
          tpEnabled={tpEnabled}
          setTpEnabled={setTpEnabled}
          tpDistance={tpDistance}
          setTpDistance={setTpDistance}
          handlePlaceOrder={handlePlaceOrder}
          priceDecimals={priceDecimals}
          isMaximized={isMaximized}
        />


      </div>
    </div>
  );
}
