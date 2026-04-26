export const PRESET_COLORS = [
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

export const hexToRgba = (hex: any, alpha: any) => {
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

export class ShapeRenderer {
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

        this.fibY.forEach((y: any, i: any) => {
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
          // @ts-ignore
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

export class ShapePaneView {
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

export class ShapePrimitive {
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

export const dist2 = (v: any, w: any) =>
  Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
export const distToSegmentSquared = (p: any, v: any, w: any) => {
  const l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

export function calculateEMA(
  data: any[],
  period: number,
  key: string = "close"
) {
  const k = 2 / (period + 1);
  let ema = data[0][key];
  return data.map((d: any, i: number) => {
    if (i === 0) return { time: d.time, value: ema };
    ema = (d[key] - ema) * k + ema;
    return { time: d.time, value: ema };
  });
}

export function calculateMACD(
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

export function generateMockData(
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
