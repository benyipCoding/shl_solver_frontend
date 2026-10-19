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

export const DEFAULT_VOLUME_PROFILE_SETTINGS = {
  binCount: 24,
  valueAreaPercent: 70,
  maxWidth: 180,
  showValueArea: true,
  showPoc: true,
  showLevels: true,
};

export const normalizeVolumeProfileSettings = (settings: any = {}) => {
  const source = settings || {};
  return {
    binCount: Math.max(
      8,
      Math.min(48, Math.floor(Number(source.binCount) || DEFAULT_VOLUME_PROFILE_SETTINGS.binCount))
    ),
    valueAreaPercent: Math.max(
      50,
      Math.min(100, Number(source.valueAreaPercent) || DEFAULT_VOLUME_PROFILE_SETTINGS.valueAreaPercent)
    ),
    maxWidth: Math.max(
      80,
      Math.min(240, Number(source.maxWidth) || DEFAULT_VOLUME_PROFILE_SETTINGS.maxWidth)
    ),
    showValueArea: source.showValueArea !== false,
    showPoc: source.showPoc !== false,
    showLevels: source.showLevels !== false,
  };
};

const formatVolumeProfilePrice = (price: number) => {
  if (!Number.isFinite(price)) return "-";
  const absolute = Math.abs(price);
  const decimals = absolute >= 1000 ? 2 : absolute >= 100 ? 3 : absolute >= 1 ? 5 : 6;
  return price
    .toFixed(decimals)
    .replace(/\.?(0+)$/, "");
};

/**
 * Build a price/volume histogram for the candles between two points.  FXCM
 * supplies tick volume, so each candle's volume is spread uniformly across
 * its traded range.  This keeps the profile useful even when no trade-level
 * volume is available and avoids pretending that all volume happened at the
 * close.
 */
export const calculateVolumeProfile = (
  candles: any[] = [],
  startTime: number,
  endTime: number,
  binCount = 24,
  valueAreaPercent = 70
) => {
  const from = Math.min(Number(startTime), Number(endTime));
  const to = Math.max(Number(startTime), Number(endTime));
  const selected = candles.filter((candle) =>
    candle && Number(candle.time) >= from && Number(candle.time) <= to
  );
  const priced = selected.filter((candle) =>
    Number.isFinite(Number(candle.low)) &&
    Number.isFinite(Number(candle.high)) &&
    Number(candle.high) >= Number(candle.low) &&
    Number.isFinite(Number(candle.volume)) &&
    Number(candle.volume) > 0
  );
  if (!priced.length) {
    return {
      bins: [],
      coveredCount: selected.length,
      totalVolume: 0,
      pocIndex: -1,
      valueAreaLowIndex: -1,
      valueAreaHighIndex: -1,
    };
  }

  const low = Math.min(...priced.map((candle) => Number(candle.low)));
  const high = Math.max(...priced.map((candle) => Number(candle.high)));
  const span = Math.max(high - low, Number.EPSILON);
  const count = Math.max(8, Math.min(48, Math.floor(Number(binCount) || 24)));
  const step = span / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    low: low + index * step,
    high: index === count - 1 ? high : low + (index + 1) * step,
    volume: 0,
  }));

  for (const candle of priced) {
    const candleLow = Number(candle.low);
    const candleHigh = Number(candle.high);
    const volume = Number(candle.volume);
    if (candleHigh - candleLow < Number.EPSILON) {
      const index = Math.max(0, Math.min(count - 1, Math.floor((candleLow - low) / step)));
      bins[index].volume += volume;
      continue;
    }
    const candleSpan = candleHigh - candleLow;
    bins.forEach((bin) => {
      const overlap = Math.max(0, Math.min(candleHigh, bin.high) - Math.max(candleLow, bin.low));
      if (overlap > 0) bin.volume += volume * (overlap / candleSpan);
    });
  }

  const totalVolume = bins.reduce((sum, bin) => sum + bin.volume, 0);
  const maxVolume = Math.max(...bins.map((bin) => bin.volume), 0);
  const pocIndex = bins.findIndex((bin) => bin.volume === maxVolume);
  const normalizedValueAreaPercent = Math.max(50, Math.min(100, Number(valueAreaPercent) || 70));
  const valueAreaTarget = totalVolume * (normalizedValueAreaPercent / 100);
  let valueAreaLowIndex = pocIndex;
  let valueAreaHighIndex = pocIndex;
  let valueAreaVolume = pocIndex >= 0 ? bins[pocIndex].volume : 0;
  while (
    pocIndex >= 0 &&
    valueAreaVolume < valueAreaTarget &&
    (valueAreaLowIndex > 0 || valueAreaHighIndex < bins.length - 1)
  ) {
    const leftIndex = valueAreaLowIndex - 1;
    const rightIndex = valueAreaHighIndex + 1;
    const leftVolume = leftIndex >= 0 ? bins[leftIndex].volume : -1;
    const rightVolume = rightIndex < bins.length ? bins[rightIndex].volume : -1;
    if (rightVolume > leftVolume) {
      valueAreaHighIndex = rightIndex;
      valueAreaVolume += rightVolume;
    } else if (leftIndex >= 0) {
      valueAreaLowIndex = leftIndex;
      valueAreaVolume += leftVolume;
    } else {
      valueAreaHighIndex = rightIndex;
      valueAreaVolume += rightVolume;
    }
  }
  return {
    bins: bins.map((bin) => ({ ...bin, ratio: maxVolume ? bin.volume / maxVolume : 0 })),
    coveredCount: selected.length,
    totalVolume,
    pocIndex,
    valueAreaLowIndex,
    valueAreaHighIndex,
  };
};

export class ShapeRenderer {
  p1: any;
  p2: any;
  hoveredPoint: any;
  type: any;
  config: any;
  fibY: any;
  fibLevels: any;
  series: any;
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
    // Chart coordinates (including the pane width) are CSS pixels.
    target.useMediaCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      if (!this.p1 || !this.p2) return;

      const color = this.config.color || "#2962FF";
      const selectedBoost = this.config.isSelected ? 1 : 0;
      const lineWidth = (this.config.lineWidth || 2) + selectedBoost;

      if (this.type === "volumeProfile" && this.config.profile?.bins?.length) {
        const profile = this.config.profile;
        const profileSettings = normalizeVolumeProfileSettings(this.config.profileSettings);
        const panelRight = Math.max(this.p1.x, this.p2.x);
        const maxWidth = profileSettings.maxWidth;
        const panelLeft = Math.max(0, panelRight - maxWidth);
        const profileCoordinates = profile.bins
          .map((bin: any) => [this.series?.priceToCoordinate?.(bin.low), this.series?.priceToCoordinate?.(bin.high)])
          .flat()
          .filter((value: any) => value != null);
        const profileTop = profileCoordinates.length ? Math.max(0, Math.min(...profileCoordinates) - 8) : 0;
        const profileBottom = profileCoordinates.length ? Math.min(scope.mediaSize.height, Math.max(...profileCoordinates) + 8) : scope.mediaSize.height;
        ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
        ctx.fillRect(panelLeft, profileTop, panelRight - panelLeft, profileBottom - profileTop);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
        ctx.lineWidth = 1;
        ctx.strokeRect(panelLeft, profileTop, panelRight - panelLeft, profileBottom - profileTop);

        const maxVolume = Math.max(...profile.bins.map((bin: any) => bin.volume), 0);
        profile.bins.forEach((bin: any, index: number) => {
          if (!maxVolume) return;
          const yHigh = this.series?.priceToCoordinate?.(bin.high);
          const yLow = this.series?.priceToCoordinate?.(bin.low);
          if (yHigh == null || yLow == null) return;
          const height = Math.max(1, Math.abs(yLow - yHigh) - 1);
          const width = Math.max(1, (bin.volume / maxVolume) * (panelRight - panelLeft - 4));
          const inValueArea =
            profileSettings.showValueArea &&
            index >= profile.valueAreaLowIndex &&
            index <= profile.valueAreaHighIndex;
          ctx.fillStyle =
            profileSettings.showPoc && index === profile.pocIndex
              ? "rgba(251, 191, 36, 0.82)"
              : inValueArea
                ? "rgba(96, 165, 250, 0.72)"
                : "rgba(56, 189, 248, 0.52)";
          ctx.fillRect(panelRight - width - 2, Math.min(yHigh, yLow), width, height);
        });

        if (profileSettings.showLevels) {
          const profileLevels = [
            profile.pocIndex >= 0 && profile.bins[profile.pocIndex]
              ? {
                  name: "POC",
                  price:
                    (profile.bins[profile.pocIndex].low +
                      profile.bins[profile.pocIndex].high) /
                    2,
                  color: "#fbbf24",
                }
              : null,
            profile.valueAreaHighIndex >= 0 && profile.bins[profile.valueAreaHighIndex]
              ? {
                  name: "VAH",
                  price: profile.bins[profile.valueAreaHighIndex].high,
                  color: "#a78bfa",
                }
              : null,
            profile.valueAreaLowIndex >= 0 && profile.bins[profile.valueAreaLowIndex]
              ? {
                  name: "VAL",
                  price: profile.bins[profile.valueAreaLowIndex].low,
                  color: "#a78bfa",
                }
              : null,
          ].filter(Boolean) as any[];
          const labelX = Math.max(4, Math.min(panelRight + 6, scope.mediaSize.width - 76));
          profileLevels.forEach((level) => {
            const y = this.series?.priceToCoordinate?.(level.price);
            if (y == null) return;
            ctx.save?.();
            ctx.strokeStyle = level.color;
            ctx.fillStyle = level.color;
            ctx.lineWidth = 1;
            ctx.setLineDash?.([4, 4]);
            ctx.beginPath();
            ctx.moveTo(panelRight, y);
            ctx.lineTo(scope.mediaSize.width, y);
            ctx.stroke();
            ctx.setLineDash?.([]);
            ctx.font = "10px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(`${level.name} ${formatVolumeProfilePrice(level.price)}`, labelX, y);
            ctx.restore?.();
          });
        }
        ctx.fillStyle = "rgba(226, 232, 240, 0.82)";
        ctx.font = "10px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`VP · ${profile.coveredCount}`, panelLeft + 5, profileTop + 4);
      }

      if (this.type === "line") {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
      } else if (this.type === "rectangle" || this.type === "zone") {
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
          ctx.lineWidth = 1 + selectedBoost * 0.5;
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
      } else if (this.type === "volumeProfile") {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
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
        if (this.type === "rectangle" || this.type === "zone") {
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
    const coordinates = this.source.getCoordinates();
    if (!coordinates) return null;
    const { x1, x2, y1, y2 } = coordinates;

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

    const renderer = new ShapeRenderer(
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      this.source.hoveredPoint,
      this.source.type,
      this.source.config,
      fibY,
      fibLevels
    );
    renderer.series = this.source.series;
    return renderer;
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
  profileCandles: any[];
  anchorTimes: { p1: any; p2: any };

  constructor(p1: any, p2: any, type: string = "line") {
    this.id = "shape_" + Date.now() + Math.random().toString(36).substr(2, 9);
    this.p1 = p1;
    this.p2 = type === "zone" ? { ...p2, time: p1.time } : p2;
    this.type = type;
    this.profileCandles = [];
    this.anchorTimes = { p1: p1?.time, p2: p2?.time };
    this.hoveredPoint = null;
    this.config = {
      color: type === "zone" ? "#c084fc" : type === "volumeProfile" ? "#f59e0b" : "#2962ff",
      lineWidth: type === "zone" ? 1 : 2,
      isSelected: false,
      fillBaseColor: type === "zone" ? "#c084fc" : "#2962ff",
      profileSettings: { ...DEFAULT_VOLUME_PROFILE_SETTINGS },
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
  getCoordinates() {
    if (!this.chart || !this.series) return null;
    const timeScale = this.chart.timeScale();
    const x1 = timeScale.timeToCoordinate(this.p1.time);
    // Resolve the right edge on every paint/hit test. Advancing candles,
    // zooming and resizing never change the user's price boundaries.
    const x2 = this.type === "zone"
      ? timeScale.width()
      : timeScale.timeToCoordinate(this.p2.time);
    const y1 = this.series.priceToCoordinate(this.p1.price);
    const y2 = this.series.priceToCoordinate(this.p2.price);
    if (x1 === null || x2 === null || y1 === null || y2 === null) return null;
    if (this.type === "zone" && x1 >= x2) return null;
    return { x1, x2, y1, y2 };
  }
  updatePoint(index: any, newPoint: any) {
    if (this.type === "zone") {
      if (index === 1) this.p1 = newPoint;
      else if (index === 2) this.p2 = { ...this.p2, price: newPoint.price };
      else if (index === 3) {
        this.p1 = { ...this.p1, time: newPoint.time };
        this.p2 = { ...this.p2, price: newPoint.price };
      } else if (index === 4) this.p1 = { ...this.p1, price: newPoint.price };
      this.p2 = { ...this.p2, time: this.p1.time };
      this.anchorTimes = { p1: this.p1.time, p2: this.p2.time };
      this.refreshVolumeProfile();
      this.requestUpdate?.();
      return;
    }
    if (index === 1) this.p1 = newPoint;
    else if (index === 2) this.p2 = newPoint;
    else if (index === 3) {
      this.p1 = { ...this.p1, time: newPoint.time };
      this.p2 = { ...this.p2, price: newPoint.price };
    } else if (index === 4) {
      this.p2 = { ...this.p2, time: newPoint.time };
      this.p1 = { ...this.p1, price: newPoint.price };
    }
    this.anchorTimes = { p1: this.p1.time, p2: this.p2.time };
    this.refreshVolumeProfile();
    if (this.requestUpdate) this.requestUpdate();
  }
  /** Move drawing time anchors to candles available in the active timeframe. */
  reanchorTimes(candles: any[] = []) {
    if (!candles.length || !this.p1 || !this.p2) return;
    const resolve = (time: any) => {
      const numericTime = typeof time === "number"
        ? time
        : typeof time?.timestamp === "number"
          ? time.timestamp
          : Number(time);
      if (!Number.isFinite(numericTime)) return candles[0].time;
      let candidate = candles[0].time;
      for (const candle of candles) {
        if (candle.time > numericTime) break;
        candidate = candle.time;
      }
      return candidate;
    };

    this.p1 = { ...this.p1, time: resolve(this.anchorTimes?.p1 ?? this.p1.time) };
    this.p2 = this.type === "zone"
      ? { ...this.p2, time: this.p1.time }
      : { ...this.p2, time: resolve(this.anchorTimes?.p2 ?? this.p2.time) };
    this.refreshVolumeProfile();
    this.requestUpdate?.();
  }
  setProfileCandles(candles: any[] = []) {
    this.profileCandles = candles;
    this.refreshVolumeProfile();
  }
  refreshVolumeProfile() {
    if (this.type !== "volumeProfile" || !this.p1 || !this.p2 || !this.profileCandles.length) return;
    const profileSettings = normalizeVolumeProfileSettings(this.config.profileSettings);
    this.config = {
      ...this.config,
      profileSettings,
      profile: calculateVolumeProfile(
        this.profileCandles,
        this.p1.time,
        this.p2.time,
        profileSettings.binCount,
        profileSettings.valueAreaPercent
      ),
    };
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
  setSelected(isSelected: boolean) {
    if (this.config.isSelected === isSelected) return;
    this.config = { ...this.config, isSelected };
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

export function calculateBollingerBands(
  data: any[],
  period: number = 20,
  standardDeviation: number = 2,
  key: string = "close"
) {
  const normalizedPeriod = Math.max(1, Math.floor(Number(period) || 20));
  const normalizedDeviation = Math.max(
    Number.EPSILON,
    Number(standardDeviation) || 2
  );

  return data.map((point: any, index: number) => {
    if (index < normalizedPeriod - 1) {
      return {
        time: point.time,
        middle: null,
        upper: null,
        lower: null,
      };
    }

    const window = data.slice(index - normalizedPeriod + 1, index + 1);
    const middle =
      window.reduce((sum, item) => sum + Number(item[key]), 0) /
      normalizedPeriod;
    const variance =
      window.reduce((sum, item) => {
        const distance = Number(item[key]) - middle;
        return sum + distance * distance;
      }, 0) / normalizedPeriod;
    const bandDistance = Math.sqrt(variance) * normalizedDeviation;

    return {
      time: point.time,
      middle,
      upper: middle + bandDistance,
      lower: middle - bandDistance,
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
  const intervalSeconds: Record<string, number> = {
    m1: 60,
    m5: 300,
    m15: 900,
    m30: 1800,
    H1: 3600,
    H2: 7200,
    H3: 10800,
    H4: 14400,
    H6: 21600,
    H8: 28800,
    D1: 86400,
    W1: 604800,
  };
  const intervalStr = intervalSeconds[timeframe] ?? 86400;
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
