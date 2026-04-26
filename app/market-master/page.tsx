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

// ==========================================
// 辅助组件与函数：16色标准金融色板引擎
// ==========================================
const PRESET_COLORS = [
  "#ef5350",
  "#f23645",
  "#ff9800",
  "#ffeb3b",
  "#4caf50",
  "#089981",
  "#00bcd4",
  "#2962ff",
  "#3179f5",
  "#9c27b0",
  "#e91e63",
  "#e0e3eb",
  "#b2b5be",
  "#787b86",
  "#434651",
  "#131722",
];

const hexToRgba = (hex: any, alpha: any) => {
  if (!hex || hex[0] !== "#") return `rgba(41, 98, 255, ${alpha})`;
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ColorPicker = ({ value, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <div
        className="w-6 h-6 rounded cursor-pointer border border-gray-600 shadow-sm hover:border-gray-400 transition-colors"
        style={{ backgroundColor: value || PRESET_COLORS[7] }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      />
      {isOpen && (
        <div className="absolute z-150 bottom-full mb-2 right-0 bg-gray-800 border border-gray-700 p-2 rounded-lg shadow-2xl grid grid-cols-4 gap-1.5 w-40">
          {PRESET_COLORS.map((c) => (
            <div
              key={c}
              className={`w-7 h-7 rounded cursor-pointer border-2 hover:scale-110 transition-transform ${value === c ? "border-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                onChange(c);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 1. 图表插件底层实现 (支持拖拽、平移和独立配置的 Primitives API)
// ==========================================
class ShapeRenderer {
  p1: any;
  p2: any;
  hoveredPoint: any;
  type: any;
  config: any;
  fibY: any;
  fibLevels: any;
  constructor(
    p1: any,
    p2: any,
    hoveredPoint: any,
    type: any,
    config: any,
    fibY: any[] = [],
    fibLevels: any[] = []
  ) {
    this.p1 = p1;
    this.p2 = p2;
    this.hoveredPoint = hoveredPoint;
    this.type = type;
    this.config = config;
    this.fibY = fibY;
    this.fibLevels = fibLevels;
  }

  draw(target: any) {
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      if (!this.p1 || !this.p2) return;

      const color = this.config.color || "#2962FF";
      const lineWidth = this.config.lineWidth || 2;

      if (this.type === "line") {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
      } else if (this.type === "rectangle") {
        const x = Math.min(this.p1.x, this.p2.x);
        const y = Math.min(this.p1.y, this.p2.y);
        const w = Math.abs(this.p2.x - this.p1.x);
        const h = Math.abs(this.p2.y - this.p1.y);

        ctx.fillStyle = hexToRgba(this.config.fillBaseColor || color, 0.15);
        ctx.fillRect(x, y, w, h);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
      } else if (this.type === "fib") {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const startX = Math.min(this.p1.x, this.p2.x);
        const endX = scope.mediaSize.width;

        this.fibY.forEach((y, i) => {
          if (y === null) return;
          ctx.lineWidth = 1;
          const levelColor = this.config.fibColors
            ? this.config.fibColors[i]
            : color;
          ctx.strokeStyle = levelColor;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();

          ctx.fillStyle = levelColor;
          ctx.font = "11px Arial";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(this.fibLevels[i].toString(), startX + 5, y - 8);
        });
      }

      const drawHandle = (point: any, isHovered: boolean) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, isHovered ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? "#1E88E5" : "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
      };

      if (this.hoveredPoint !== null) {
        if (this.type === "rectangle") {
          const corners = [
            { x: this.p1.x, y: this.p1.y, id: 1 },
            { x: this.p2.x, y: this.p2.y, id: 2 },
            { x: this.p1.x, y: this.p2.y, id: 3 },
            { x: this.p2.x, y: this.p1.y, id: 4 },
          ];
          corners.forEach((c) => drawHandle(c, this.hoveredPoint === c.id));
        } else {
          drawHandle(this.p1, this.hoveredPoint === 1);
          drawHandle(this.p2, this.hoveredPoint === 2);
        }
      }
    });
  }
}

class ShapePaneView {
  source: any;
  constructor(source: any) {
    this.source = source;
  }
  update() {}
  renderer(addAndCache: any) {
    if (!this.source.chart || !this.source.series) return null;
    const x1 = this.source.chart
      .timeScale()
      .timeToCoordinate(this.source.p1.time);
    const x2 = this.source.chart
      .timeScale()
      .timeToCoordinate(this.source.p2.time);
    const y1 = this.source.series.priceToCoordinate(this.source.p1.price);
    const y2 = this.source.series.priceToCoordinate(this.source.p2.price);

    // 如果任意一个点转换结果为 null（比如坐标落在了未来没有数据的时段），则整个图形不会被渲染
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

    let fibY: any[] = [];
    const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    if (this.source.type === "fib") {
      fibY = fibLevels.map((lvl: any) => {
        const price =
          this.source.p1.price +
          (this.source.p2.price - this.source.p1.price) * lvl;
        return this.source.series.priceToCoordinate(price);
      });
    }

    return new ShapeRenderer(
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      this.source.hoveredPoint,
      this.source.type,
      this.source.config,
      fibY,
      fibLevels
    );
  }
}

class ShapePrimitive {
  id: string;
  p1: any;
  p2: any;
  type: string;
  hoveredPoint: any;
  config: any;
  _paneViews: any[];
  chart: any;
  series: any;
  requestUpdate: any;

  constructor(p1: any, p2: any, type: string = "line") {
    this.id = "shape_" + Date.now() + Math.random().toString(36).substr(2, 9);
    this.p1 = p1;
    this.p2 = p2;
    this.type = type;
    this.hoveredPoint = null;
    this.config = {
      color: "#2962ff",
      lineWidth: 2,
      fillBaseColor: "#2962ff",
      fibColors: [
        "#787b86",
        "#f23645",
        "#ff9800",
        "#4caf50",
        "#089981",
        "#00bcd4",
        "#787b86",
      ],
    };
    this._paneViews = [new ShapePaneView(this)];
  }
  attached({ chart, series, requestUpdate }: any) {
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
  updateViews() {
    this._paneViews.forEach((pw: any) => pw.update());
  }
  updatePoint(index: any, newPoint: any) {
    if (index === 1) this.p1 = newPoint;
    else if (index === 2) this.p2 = newPoint;
    else if (index === 3) {
      this.p1 = { ...this.p1, time: newPoint.time };
      this.p2 = { ...this.p2, price: newPoint.price };
    } else if (index === 4) {
      this.p2 = { ...this.p2, time: newPoint.time };
      this.p1 = { ...this.p1, price: newPoint.price };
    }
    if (this.requestUpdate) this.requestUpdate();
  }
  setHoveredPoint(pointIndex: any) {
    if (this.hoveredPoint !== pointIndex) {
      this.hoveredPoint = pointIndex;
      if (this.requestUpdate) this.requestUpdate();
    }
  }
  updateConfig(newConfig: any) {
    this.config = { ...this.config, ...newConfig };
    if (this.requestUpdate) this.requestUpdate();
  }
}

const dist2 = (v: any, w: any) =>
  Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
const distToSegmentSquared = (p: any, v: any, w: any) => {
  const l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

// ==========================================
// 2. 技术指标计算引擎 (EMA & MACD)
// ==========================================
function calculateEMA(data: any[], period: number, key: string = "close") {
  const k = 2 / (period + 1);
  let ema = data[0][key];
  return data.map((d: any, i: number) => {
    if (i === 0) return { time: d.time, value: ema };
    ema = (d[key] - ema) * k + ema;
    return { time: d.time, value: ema };
  });
}

function calculateMACD(
  data: any[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
) {
  const fastEma = calculateEMA(data, fastPeriod, "close");
  const slowEma = calculateEMA(data, slowPeriod, "close");
  const macdLine = data.map((d: any, i: number) => ({
    time: d.time,
    value: fastEma[i].value - slowEma[i].value,
  }));
  const signalLine = calculateEMA(macdLine, signalPeriod, "value");

  return data.map((d: any, i: number) => {
    const hist = macdLine[i].value - signalLine[i].value;
    const prevHist =
      i > 0 ? macdLine[i - 1].value - signalLine[i - 1].value : 0;
    const isGrowing = hist > prevHist;
    let colorType = "positiveGrowing";
    if (hist >= 0) {
      colorType = isGrowing ? "positiveGrowing" : "positiveFalling";
    } else {
      colorType = isGrowing ? "negativeGrowing" : "negativeFalling";
    }

    return {
      time: d.time,
      macd: macdLine[i].value,
      signal: signalLine[i].value,
      hist: hist,
      colorType: colorType,
    };
  });
}

// ==========================================
// 3. 模拟 K 线数据生成器
// ==========================================
function generateMockData(
  symbol: string = "XAU/USD",
  timeframe: string = "D1",
  count: number = 500
) {
  const data: any[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  let intervalStr = 86400;
  if (timeframe === "H4") intervalStr = 14400;
  if (timeframe === "m30") intervalStr = 1800;
  let time = Math.floor(d.getTime() / 1000) - count * intervalStr;
  let close = symbol === "XAU/USD" ? 2000 : symbol === "GBP/USD" ? 1.25 : 1.1;
  let volMultiplier = symbol === "XAU/USD" ? 20 : 0.005;
  for (let i = 0; i < count; i++) {
    const volatility = (Math.random() - 0.5) * volMultiplier;
    const open = close + (Math.random() - 0.5) * (volMultiplier * 0.25);
    const high = Math.max(open, close) + Math.random() * (volMultiplier * 0.75);
    const low = Math.min(open, close) - Math.random() * (volMultiplier * 0.75);
    close = open + volatility;
    data.push({ time: time + i * intervalStr, open, high, low, close });
  }
  return data;
}

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
      {/* AI 复盘导师 Modal (兼容双模式) */}
      {aiReviewModal.visible && (
        <div className="fixed inset-0 z-120 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-120 p-0 overflow-hidden flex flex-col">
            <div className="bg-linear-to-r from-indigo-900/50 to-purple-900/50 p-4 border-b border-gray-700 flex justify-between items-center">
              <span className="font-bold text-white tracking-wider flex items-center gap-2">
                <Bot size={18} className="text-indigo-400" />{" "}
                {aiReviewModal.title}
              </span>
              <button
                onClick={() =>
                  setAiReviewModal({
                    visible: false,
                    trade: null,
                    text: "",
                    loading: false,
                  })
                }
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {aiReviewModal.type === "single" && aiReviewModal.trade && (
                <div className="flex gap-4 mb-4 text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                  <div>
                    <span className="text-gray-500 block text-xs mb-1">
                      交易方向
                    </span>
                    <span
                      className={`font-bold ${aiReviewModal.trade.type === "Buy" ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {aiReviewModal.trade.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-1">
                      开仓价
                    </span>
                    <span className="text-gray-200">
                      {aiReviewModal.trade.entry.toFixed(priceDecimals)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-1">
                      平仓价
                    </span>
                    <span className="text-gray-200">
                      {aiReviewModal.trade.closePrice.toFixed(priceDecimals)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs mb-1">
                      最终盈亏
                    </span>
                    <span
                      className={`font-bold ${aiReviewModal.trade.pnl > 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {aiReviewModal.trade.pnl > 0 ? "+" : ""}
                      {aiReviewModal.trade.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="min-h-35 bg-gray-950 rounded-lg p-4 border border-gray-800 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {aiReviewModal.loading ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-3 opacity-70 mt-6">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-indigo-400 text-xs animate-pulse">
                      {aiReviewModal.type === "profile"
                        ? "AI 正在调取近期历史记录提取您的行为特征..."
                        : aiReviewModal.type === "insight"
                          ? "AI 视觉引擎正在扫描 K 线图表形态与关键阻力支撑..."
                          : "AI 正在调取图表数据与技术指标深度分析中..."}
                    </span>
                  </div>
                ) : (
                  aiReviewModal.text
                )}
              </div>
            </div>
            <div className="p-3 border-t border-gray-800 bg-gray-800/50 flex justify-end">
              <button
                onClick={() =>
                  setAiReviewModal({
                    visible: false,
                    trade: null,
                    text: "",
                    loading: false,
                  })
                }
                className="px-5 py-1.5 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-900/50"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* 单一图形配置 Modal */}
      {shapeConfigModal.visible && (
        <div className="fixed inset-0 z-110 bg-black/40 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-80 p-5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-white tracking-wider">图形配置</h3>
              <button
                onClick={() =>
                  setShapeConfigModal({ visible: false, shapeId: null })
                }
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            {(() => {
              const shape = stateRef.current.lines.find(
                (l) => l.id === shapeConfigModal.shapeId
              );
              if (!shape) return null;
              return (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm text-gray-400">主颜色</label>
                    <ColorPicker
                      value={shape.config.color}
                      onChange={(c) => updateShapeConfig("color", c)}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm text-gray-400">线条粗细</label>
                    <select
                      value={shape.config.lineWidth}
                      onChange={(e) =>
                        updateShapeConfig("lineWidth", Number(e.target.value))
                      }
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm outline-none w-24"
                    >
                      <option value={1}>极细</option>
                      <option value={1.5}>较细</option>
                      <option value={2}>正常</option>
                      <option value={3}>粗</option>
                    </select>
                  </div>
                  {/* 斐波那契单档位颜色配置 */}
                  {shape.type === "fib" && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-gray-800">
                      <label className="text-sm text-gray-400 mb-2 block">
                        刻度水平线颜色
                      </label>
                      {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(
                        (level, idx) => (
                          <div
                            key={level}
                            className="flex justify-between items-center bg-gray-800/50 px-3 py-1.5 rounded"
                          >
                            <span className="text-sm text-gray-300 font-mono">
                              Level: {level}
                            </span>
                            <ColorPicker
                              value={shape.config.fibColors[idx]}
                              onChange={(c) => {
                                const newColors = [...shape.config.fibColors];
                                newColors[idx] = c;
                                updateShapeConfig("fibColors", newColors);
                              }}
                            />
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <button
              onClick={() =>
                setShapeConfigModal({ visible: false, shapeId: null })
              }
              className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* ================= 指标配置 Modal ================= */}
      {isIndicatorModalOpen && (
        <div
          style={{
            left: indicatorModalPos.x,
            top: indicatorModalPos.y,
            position: "absolute",
          }}
          className="z-50 w-137.5 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div
            onMouseDown={handleIndDragStart}
            className="bg-gray-800 p-3 cursor-move flex items-center justify-between border-b border-gray-700"
          >
            <span className="text-sm font-bold text-gray-300 tracking-wider flex items-center gap-2">
              <BarChart2 size={16} className="text-blue-500" /> 指标配置中心
            </span>
            <button
              onClick={() => {
                setIsIndicatorModalOpen(false);
                setDraftConfig(indConfig);
              }}
              className="text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex h-72">
            <div className="w-32 border-r border-gray-800 bg-gray-900/50 p-2 space-y-1">
              <button
                onClick={() => setSelectedIndTab("EMA")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors font-medium ${selectedIndTab === "EMA" ? "bg-gray-800 text-blue-400 shadow-sm" : "text-gray-400 hover:bg-gray-800/50"}`}
              >
                EMA 均线
              </button>
              <button
                onClick={() => setSelectedIndTab("MACD")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors font-medium ${selectedIndTab === "MACD" ? "bg-gray-800 text-blue-400 shadow-sm" : "text-gray-400 hover:bg-gray-800/50"}`}
              >
                MACD
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-[#111827]">
              {selectedIndTab === "EMA" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#111827] z-10 pb-2 border-b border-gray-800">
                    <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                      已添加的均线 ({draftConfig.emas.length})
                    </h3>
                    <button
                      onClick={handleAddDraftEma}
                      className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} />
                      添加 EMA
                    </button>
                  </div>
                  {draftConfig.emas.length === 0 && (
                    <div className="text-sm text-gray-600 text-center py-8">
                      暂无配置的均线
                    </div>
                  )}
                  {draftConfig.emas.map((ema) => (
                    <div
                      key={ema.id}
                      className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 relative group hover:border-gray-600 transition-colors"
                    >
                      <button
                        onClick={() => handleRemoveDraftEma(ema.id)}
                        className="absolute top-3 right-3 text-gray-500 hover:text-red-400 transition-colors"
                        title="移除该均线"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="grid grid-cols-2 gap-4 pr-6">
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">
                            周期 (Period)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={ema.period}
                            onChange={(e) =>
                              handleUpdateDraftEma(
                                ema.id,
                                "period",
                                Number(e.target.value)
                              )
                            }
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-1">
                              粗细
                            </label>
                            <select
                              value={ema.lineWidth}
                              onChange={(e) =>
                                handleUpdateDraftEma(
                                  ema.id,
                                  "lineWidth",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm outline-none"
                            >
                              <option value={1}>极细</option>
                              <option value={1.5}>较细</option>
                              <option value={2}>正常</option>
                              <option value={3}>粗</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-1">
                              颜色
                            </label>
                            <ColorPicker
                              value={ema.color}
                              onChange={(c) =>
                                handleUpdateDraftEma(ema.id, "color", c)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedIndTab === "MACD" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#111827] z-10 pb-2 border-b border-gray-800">
                    <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                      MACD 振荡器
                    </h3>
                    {!draftConfig.macd.enabled ? (
                      <button
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            macd: { ...prev.macd, enabled: true },
                          }))
                        }
                        className="text-xs bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        <Plus size={14} />
                        启用 MACD
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            macd: { ...prev.macd, enabled: false },
                          }))
                        }
                        className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        移除 MACD
                      </button>
                    )}
                  </div>

                  {draftConfig.macd.enabled ? (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                          核心参数
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-1">
                              快线 (Fast)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={draftConfig.macd.fast}
                              onChange={(e) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  macd: {
                                    ...prev.macd,
                                    fast: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-1">
                              慢线 (Slow)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={draftConfig.macd.slow}
                              onChange={(e) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  macd: {
                                    ...prev.macd,
                                    slow: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-1">
                              信号 (Signal)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={draftConfig.macd.signal}
                              onChange={(e) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  macd: {
                                    ...prev.macd,
                                    signal: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                          线条颜色
                        </h4>
                        <div className="flex gap-6">
                          <div className="flex items-center gap-2">
                            <ColorPicker
                              value={draftConfig.macd.macdColor}
                              onChange={(c) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  macd: { ...prev.macd, macdColor: c },
                                }))
                              }
                            />
                            <span className="text-xs text-gray-300">
                              MACD 线
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ColorPicker
                              value={draftConfig.macd.signalColor}
                              onChange={(c) =>
                                setDraftConfig((prev) => ({
                                  ...prev,
                                  macd: { ...prev.macd, signalColor: c },
                                }))
                              }
                            />
                            <span className="text-xs text-gray-300">
                              Signal 线
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 text-center py-8">
                      MACD 暂未启用
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-3 border-t border-gray-800 bg-gray-800/80 flex justify-end gap-3">
            <button
              onClick={() => {
                setIsIndicatorModalOpen(false);
                setDraftConfig(indConfig);
              }}
              className="px-5 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              onClick={applyIndicatorConfig}
              className="px-5 py-1.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-900/50"
            >
              确认应用
            </button>
          </div>
        </div>
      )}

      {/* === 顶部导航与工具栏 === */}
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
              onClick={() => {
                setMode("idle");
                stateRef.current.mode = "idle";
              }}
              className={`p-1.5 rounded-md flex items-center transition-colors ${mode === "idle" ? "bg-gray-700 text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}
              title="指针模式 (平移/选中/右键配置)"
            >
              <MousePointer2 size={16} />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1 self-center"></div>
            <button
              onClick={() => setDrawingTool("line")}
              className={`p-1.5 rounded-md flex items-center transition-colors ${mode === "draw" && drawType === "line" ? "bg-gray-700 text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}
              title="画直线 (Trend Line)"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={() => setDrawingTool("rectangle")}
              className={`p-1.5 rounded-md flex items-center transition-colors ${mode === "draw" && drawType === "rectangle" ? "bg-gray-700 text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}
              title="画阻力矩形 (Rectangle)"
            >
              <Square size={14} />
            </button>
            <button
              onClick={() => setDrawingTool("fib")}
              className={`p-1.5 rounded-md flex items-center transition-colors ${mode === "draw" && drawType === "fib" ? "bg-gray-700 text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}
              title="斐波那契回调 (Fib Retracement)"
            >
              <AlignJustify size={16} />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1 self-center"></div>
            <button
              onClick={() => setIsMagnetEnabled(!isMagnetEnabled)}
              className={`p-1.5 rounded-md flex items-center transition-colors ${isMagnetEnabled ? "bg-gray-700 text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}
              title={
                isMagnetEnabled ? "关闭磁力吸附" : "开启磁力吸附 (快捷精准画图)"
              }
            >
              <Magnet size={16} />
            </button>
          </div>

          {/* AI 智能盯盘分析按钮 */}
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
            onClick={() => {
              stateRef.current.lines.forEach((l) =>
                seriesRef.current?.detachPrimitive(l)
              );
              stateRef.current.lines = [];
              setLines([]);
            }}
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
            className={`p-1.5 rounded text-white disabled:opacity-50 ${isPlaying ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"}`}
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
              className={`font-mono font-bold ${totalFloatingPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {totalFloatingPnl > 0 ? "+" : ""}
              {totalFloatingPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

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

          {!isMaximized && (
            <div
              className={`bg-gray-900 border-t border-gray-800 flex flex-col shrink-0 transition-all duration-300 ${isBottomPanelOpen ? "h-56" : "h-10"}`}
            >
              <div
                className="h-10 px-4 border-b border-gray-800 text-sm font-medium text-gray-400 bg-gray-900 flex justify-between items-center shrink-0 cursor-pointer hover:bg-gray-800/80 transition-colors"
                onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
                title={isBottomPanelOpen ? "收起交易记录" : "展开交易记录"}
              >
                <span>交易记录 (持仓与历史)</span>

                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAIReview();
                    }}
                    className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded transition-colors text-xs font-bold border border-indigo-500/50"
                  >
                    <Activity size={14} /> 生成 AI 习惯画像
                  </button>
                  <button className="text-gray-500 hover:text-white transition-colors">
                    {isBottomPanelOpen ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronUp size={18} />
                    )}
                  </button>
                </div>
              </div>
              {isBottomPanelOpen && (
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-800/50 text-gray-500 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2 font-normal">状态</th>
                        <th className="px-4 py-2 font-normal">方向</th>
                        <th className="px-4 py-2 font-normal text-right">
                          数量
                        </th>
                        <th className="px-4 py-2 font-normal text-right">
                          开仓价
                        </th>
                        <th className="px-4 py-2 font-normal text-right">
                          止损 (SL)
                        </th>
                        <th className="px-4 py-2 font-normal text-right">
                          止盈 (TP)
                        </th>
                        <th className="px-4 py-2 font-normal text-right">
                          平仓价
                        </th>
                        <th className="px-4 py-2 font-normal text-right">
                          浮动/已结盈亏
                        </th>
                        <th className="px-4 py-2 font-normal text-center">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {trades.length === 0 && (
                        <tr>
                          <td
                            colSpan="9"
                            className="text-center py-6 text-gray-600"
                          >
                            暂无交易数据
                          </td>
                        </tr>
                      )}
                      {trades.map((trade) => {
                        const isOpen = trade.status === "Open";
                        const currentPnl = isOpen
                          ? trade.type === "Buy"
                            ? (currentPrice - trade.entry) * trade.units
                            : (trade.entry - currentPrice) * trade.units
                          : trade.pnl;
                        return (
                          <tr key={trade.id} className="hover:bg-gray-800/30">
                            <td className="px-4 py-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${isOpen ? "bg-blue-500/20 text-blue-400" : "bg-gray-700 text-gray-400"}`}
                              >
                                {isOpen ? "持仓中" : trade.reason}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-2 font-bold ${trade.type === "Buy" ? "text-emerald-500" : "text-red-500"}`}
                            >
                              {trade.type}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {trade.units}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {trade.entry.toFixed(priceDecimals)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-red-400/70">
                              {trade.sl !== null
                                ? trade.sl.toFixed(priceDecimals)
                                : "-"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-emerald-400/70">
                              {trade.tp !== null
                                ? trade.tp.toFixed(priceDecimals)
                                : "-"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-gray-400">
                              {isOpen
                                ? "-"
                                : trade.closePrice.toFixed(priceDecimals)}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-mono font-bold ${currentPnl > 0 ? "text-emerald-400" : currentPnl < 0 ? "text-red-400" : "text-gray-400"}`}
                            >
                              {currentPnl > 0 ? "+" : ""}
                              {currentPnl.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {isOpen ? (
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    onClick={() =>
                                      toggleTradeVisibility(trade.id)
                                    }
                                    className="text-gray-400 hover:text-white transition-colors"
                                    title={
                                      trade.visibleOnChart === false
                                        ? "显示图表标线"
                                        : "隐藏图表标线"
                                    }
                                  >
                                    {trade.visibleOnChart === false ? (
                                      <EyeOff size={16} />
                                    ) : (
                                      <Eye size={16} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleCloseMarket(trade.id)}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition-colors"
                                  >
                                    市价平仓
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-xs text-gray-600">
                                    已完结
                                  </span>
                                  <button
                                    onClick={() => handleAIReview(trade)}
                                    className="text-[10px] flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/50 px-2 py-0.5 rounded transition-colors"
                                    title="使用 AI 深度分析此笔交易"
                                  >
                                    <Bot size={12} /> AI
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {!isRightPanelOpen && !isMaximized && (
          <button
            onClick={() => setIsRightPanelOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 border-r-0 rounded-l-lg py-4 px-1 text-gray-400 hover:text-white hover:bg-gray-700 shadow-xl z-20"
            title="展开交易终端"
          >
            <PanelRightOpen size={18} />
          </button>
        )}

        {isRightPanelOpen && !isMaximized && (
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                交易终端
              </h2>
              <button
                onClick={() => setIsRightPanelOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
                title="收起侧边栏"
              >
                <PanelRightClose size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col flex-1">
              <div className="text-center mb-6">
                <div className="text-xs text-gray-500 mb-1">
                  当前市价 ({symbol})
                </div>
                <div className="text-3xl font-mono font-bold text-white tracking-tight">
                  {currentPrice.toFixed(priceDecimals)}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    交易数量 (Units)
                  </label>
                  <input
                    type="number"
                    value={orderUnits}
                    onChange={(e) =>
                      setOrderUnits(Math.max(1, Number(e.target.value)))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 flex items-center gap-1 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slEnabled}
                        onChange={(e) => setSlEnabled(e.target.checked)}
                      />{" "}
                      默认止损 (点)
                    </label>
                    <input
                      type="number"
                      step={symbol === "XAU/USD" ? "1" : "0.0001"}
                      value={slDistance}
                      disabled={!slEnabled}
                      onChange={(e) => setSlDistance(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none focus:border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 flex items-center gap-1 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tpEnabled}
                        onChange={(e) => setTpEnabled(e.target.checked)}
                      />{" "}
                      默认止盈 (点)
                    </label>
                    <input
                      type="number"
                      step={symbol === "XAU/USD" ? "1" : "0.0001"}
                      value={tpDistance}
                      disabled={!tpEnabled}
                      onChange={(e) => setTpDistance(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none focus:border-emerald-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center mt-2">
                  提示：建仓后可直接在图表上拖拽止损止盈线
                </div>
              </div>

              <div className="flex gap-3 mt-auto mb-4">
                <button
                  onClick={() => handlePlaceOrder("Sell")}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-red-900/20"
                >
                  做空 (Sell)
                </button>
                <button
                  onClick={() => handlePlaceOrder("Buy")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                >
                  做多 (Buy)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
