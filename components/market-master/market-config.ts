import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  Time,
} from "lightweight-charts";

export const INITIAL_VISIBLE_COUNT = 200;
export const INITIAL_BACKTEST_BALANCE = 10000;
export const MIN_FORWARD_CANDLES = 2000;
export const MIN_BACKTEST_CANDLES = INITIAL_VISIBLE_COUNT + MIN_FORWARD_CANDLES;
export const SELECTED_LINE_WIDTH_BOOST = 1;
export const RIGHT_PANEL_DEFAULT_WIDTH = 480;
export const RIGHT_PANEL_MIN_WIDTH = 260;
export const MAIN_CONTENT_MIN_WIDTH = 520;
export const BOTTOM_PANEL_DEFAULT_HEIGHT = 224;
export const BOTTOM_PANEL_MIN_HEIGHT = 160;
export const MAIN_CHART_MIN_HEIGHT = 180;
export const MACD_PANEL_HEIGHT = 192;

export const TIMEFRAME_OPTIONS = [
  { value: "m1", label: "M1", interval: "1min" },
  { value: "m5", label: "M5", interval: "5min" },
  { value: "m15", label: "M15", interval: "15min" },
  { value: "m30", label: "M30", interval: "30min" },
  { value: "H1", label: "H1", interval: "1h" },
  { value: "H2", label: "H2", interval: "2h" },
  { value: "H4", label: "H4", interval: "4h" },
  { value: "D1", label: "D1", interval: "1day" },
  { value: "W1", label: "W1", interval: "1week" },
] as const;

export const DEFAULT_TIMEFRAME = "D1";
export const LAST_TIMEFRAME_STORAGE_KEY = "marketMasterLastTimeframe";

const isSupportedTimeframe = (timeframe: string) =>
  TIMEFRAME_OPTIONS.some((option) => option.value === timeframe);

export const resolveLastTimeframe = () => {
  if (typeof window === "undefined") return DEFAULT_TIMEFRAME;

  try {
    const savedTimeframe = localStorage.getItem(LAST_TIMEFRAME_STORAGE_KEY);
    return savedTimeframe && isSupportedTimeframe(savedTimeframe)
      ? savedTimeframe
      : DEFAULT_TIMEFRAME;
  } catch {
    return DEFAULT_TIMEFRAME;
  }
};

export const persistLastTimeframe = (timeframe: string) => {
  if (typeof window === "undefined" || !isSupportedTimeframe(timeframe)) return;

  try {
    localStorage.setItem(LAST_TIMEFRAME_STORAGE_KEY, timeframe);
  } catch {
    // Ignore unavailable or quota-limited browser storage.
  }
};

export type InstrumentContext = {
  symbol: string;
  assetType: string | null;
  currency: string | null;
  exchange: string | null;
};

export type InstrumentProfile = {
  priceDecimals: number;
  inputStep: string;
  sl: number;
  tp: number;
};

export type EmaConfig = {
  id: string;
  period: number;
  color: string;
  lineWidth: number;
};

export type BollingerConfig = {
  enabled: boolean;
  period: number;
  standardDeviation: number;
  middleColor: string;
  upperColor: string;
  lowerColor: string;
  lineWidth: number;
};

export type IndicatorConfig = {
  emas: EmaConfig[];
  bollinger: BollingerConfig;
  macd: {
    enabled: boolean;
    fast: number;
    slow: number;
    signal: number;
    macdColor: string;
    signalColor: string;
    lineWidth: number;
    histColors: {
      posGrow: string;
      posFall: string;
      negGrow: string;
      negFall: string;
    };
  };
};

const INTRADAY_TIMEFRAMES = new Set(["m1", "m5", "m15", "m30", "H1", "H4"]);

const SYMBOL_PROFILE_OVERRIDES: Record<string, InstrumentProfile> = {
  "BTC/USD": { priceDecimals: 2, inputStep: "1", sl: 1500, tp: 3000 },
  US30: { priceDecimals: 2, inputStep: "1", sl: 300, tp: 600 },
  NAS100: { priceDecimals: 2, inputStep: "1", sl: 200, tp: 400 },
  SPX500: { priceDecimals: 2, inputStep: "1", sl: 75, tp: 150 },
  "XAG/USD": { priceDecimals: 2, inputStep: "0.1", sl: 1, tp: 2 },
  "XAU/USD": { priceDecimals: 2, inputStep: "0.1", sl: 20, tp: 40 },
  UKOIL: { priceDecimals: 2, inputStep: "0.1", sl: 2, tp: 4 },
  USOIL: { priceDecimals: 2, inputStep: "0.1", sl: 2, tp: 4 },
};

const INDICATOR_CONFIG_STORAGE_KEY = "marketMasterIndicatorConfig";

export const CANDLE_TOOLTIP_OFFSET = { x: 5, y: 5 };
export const CANDLE_TOOLTIP_OHLC_LABELS = [
  { key: "open", label: "Open" },
  { key: "high", label: "High" },
  { key: "low", label: "Low" },
  { key: "close", label: "Close" },
] as const;

export const pickRandomBacktestStartIndex = (totalCount: number) => {
  if (totalCount < MIN_BACKTEST_CANDLES) return null;
  const minIndex = INITIAL_VISIBLE_COUNT;
  const maxIndex = totalCount - MIN_FORWARD_CANDLES;
  return minIndex + Math.floor(Math.random() * (maxIndex - minIndex + 1));
};

export const computeBacktestKlineWindow = (
  totalCount: number,
  startCurrentIndex: number,
  pageSize: number
) => {
  const focusBarIndex = Math.max(0, startCurrentIndex - 1);
  const beforeBudget = Math.max(0, pageSize - 1 - MIN_FORWARD_CANDLES);
  let offset = Math.max(0, focusBarIndex - beforeBudget);
  if (offset + pageSize > totalCount) {
    offset = Math.max(0, totalCount - pageSize);
  }
  return {
    offset,
    outputsize: Math.min(pageSize, Math.max(0, totalCount - offset)),
    localCurrentIndex: startCurrentIndex - offset,
  };
};

const padTimePart = (value: number) => String(value).padStart(2, "0");

const toUtcDate = (timeValue: Time | number) => {
  if (typeof timeValue === "number") {
    return new Date(timeValue * 1000);
  }

  if (typeof timeValue === "string") {
    const parsedTime = Date.parse(
      timeValue.includes("T") ? timeValue : `${timeValue}T00:00:00Z`
    );
    return Number.isNaN(parsedTime) ? null : new Date(parsedTime);
  }

  if (
    timeValue &&
    typeof timeValue === "object" &&
    typeof timeValue.year === "number" &&
    typeof timeValue.month === "number" &&
    typeof timeValue.day === "number"
  ) {
    return new Date(
      Date.UTC(timeValue.year, timeValue.month - 1, timeValue.day)
    );
  }

  return null;
};

export const formatChartTimeLabel = (timeValue: Time, timeframe: string) => {
  const utcDate = toUtcDate(timeValue);
  if (!utcDate) return "";

  const dateLabel = `${utcDate.getUTCFullYear()}/${padTimePart(
    utcDate.getUTCMonth() + 1
  )}/${padTimePart(utcDate.getUTCDate())}`;

  if (!INTRADAY_TIMEFRAMES.has(timeframe)) {
    return dateLabel;
  }

  return `${dateLabel} ${padTimePart(utcDate.getUTCHours())}:${padTimePart(
    utcDate.getUTCMinutes()
  )}`;
};

export const formatCandleTooltipTime = (timeValue: Time | number) => {
  const utcDate = toUtcDate(timeValue);
  if (!utcDate) return "";

  return `${utcDate.getUTCFullYear()}-${padTimePart(
    utcDate.getUTCMonth() + 1
  )}-${padTimePart(utcDate.getUTCDate())} ${padTimePart(
    utcDate.getUTCHours()
  )}:${padTimePart(utcDate.getUTCMinutes())}`;
};

export const findPointByTime = <T extends { time: Time }>(
  data: readonly T[] | null | undefined,
  time: Time | null | undefined
) => {
  if (!data?.length || time == null) return null;
  return data.find((point) => point.time === time) ?? null;
};

export const applySyncedCrosshair = (
  chart: IChartApi | null | undefined,
  series: ISeriesApi<SeriesType> | null | undefined,
  time: Time | null | undefined,
  price: number | null | undefined
) => {
  if (!chart || !series) return;
  if (time != null && price != null && Number.isFinite(Number(price))) {
    chart.setCrosshairPosition(Number(price), time, series);
    return;
  }
  chart.clearCrosshairPosition();
};

export const createDefaultIndicatorConfig = (): IndicatorConfig => ({
  emas: [],
  bollinger: {
    enabled: false,
    period: 20,
    standardDeviation: 2,
    middleColor: "#f59e0b",
    upperColor: "#38bdf8",
    lowerColor: "#38bdf8",
    lineWidth: 1.5,
  },
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

export const cloneIndicatorConfig = (
  config: IndicatorConfig
): IndicatorConfig => ({
  emas: config.emas.map((ema) => ({ ...ema })),
  bollinger: { ...config.bollinger },
  macd: {
    ...config.macd,
    histColors: { ...config.macd.histColors },
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const sanitizeColor = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const sanitizePositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const sanitizePositiveInteger = (value: unknown, fallback: number) =>
  Math.max(1, Math.floor(sanitizePositiveNumber(value, fallback)));

const sanitizeEmaConfig = (value: unknown): EmaConfig | null => {
  if (!isRecord(value)) return null;
  const period = sanitizePositiveNumber(value.period, 0);
  if (!period) return null;

  return {
    id:
      typeof value.id === "string" && value.id
        ? value.id
        : `ema_${period}_${Math.random().toString(36).slice(2, 8)}`,
    period,
    color: sanitizeColor(value.color, "#ef5350"),
    lineWidth: sanitizePositiveNumber(value.lineWidth, 1.5),
  };
};

const sanitizeIndicatorConfig = (value: unknown): IndicatorConfig => {
  const defaults = createDefaultIndicatorConfig();
  if (!isRecord(value)) return defaults;

  const macdRaw = isRecord(value.macd) ? value.macd : {};
  const histRaw = isRecord(macdRaw.histColors) ? macdRaw.histColors : {};
  const bollingerRaw = isRecord(value.bollinger) ? value.bollinger : {};

  return {
    emas: Array.isArray(value.emas)
      ? value.emas
          .map(sanitizeEmaConfig)
          .filter((ema): ema is EmaConfig => ema !== null)
      : [],
    bollinger: {
      enabled: Boolean(bollingerRaw.enabled),
      period: sanitizePositiveInteger(
        bollingerRaw.period,
        defaults.bollinger.period
      ),
      standardDeviation: sanitizePositiveNumber(
        bollingerRaw.standardDeviation,
        defaults.bollinger.standardDeviation
      ),
      middleColor: sanitizeColor(
        bollingerRaw.middleColor,
        defaults.bollinger.middleColor
      ),
      upperColor: sanitizeColor(
        bollingerRaw.upperColor,
        defaults.bollinger.upperColor
      ),
      lowerColor: sanitizeColor(
        bollingerRaw.lowerColor,
        defaults.bollinger.lowerColor
      ),
      lineWidth: sanitizePositiveNumber(
        bollingerRaw.lineWidth,
        defaults.bollinger.lineWidth
      ),
    },
    macd: {
      enabled: Boolean(macdRaw.enabled),
      fast: sanitizePositiveNumber(macdRaw.fast, defaults.macd.fast),
      slow: sanitizePositiveNumber(macdRaw.slow, defaults.macd.slow),
      signal: sanitizePositiveNumber(macdRaw.signal, defaults.macd.signal),
      macdColor: sanitizeColor(macdRaw.macdColor, defaults.macd.macdColor),
      signalColor: sanitizeColor(
        macdRaw.signalColor,
        defaults.macd.signalColor
      ),
      lineWidth: sanitizePositiveNumber(
        macdRaw.lineWidth,
        defaults.macd.lineWidth
      ),
      histColors: {
        posGrow: sanitizeColor(
          histRaw.posGrow,
          defaults.macd.histColors.posGrow
        ),
        posFall: sanitizeColor(
          histRaw.posFall,
          defaults.macd.histColors.posFall
        ),
        negGrow: sanitizeColor(
          histRaw.negGrow,
          defaults.macd.histColors.negGrow
        ),
        negFall: sanitizeColor(
          histRaw.negFall,
          defaults.macd.histColors.negFall
        ),
      },
    },
  };
};

export const loadPersistedIndicatorConfig = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(INDICATOR_CONFIG_STORAGE_KEY);
    return raw ? sanitizeIndicatorConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const persistIndicatorConfig = (config: IndicatorConfig) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      INDICATOR_CONFIG_STORAGE_KEY,
      JSON.stringify(cloneIndicatorConfig(config))
    );
  } catch {
    // Ignore quota and private-mode storage failures.
  }
};

export const createInitialAiReviewModal = () => ({
  visible: false,
  type: "single",
  trade: null,
  title: "",
  text: "",
  loading: false,
});

const normalizeAssetType = (assetType?: string | null) =>
  assetType?.trim().toLowerCase() || "";

const roundToDecimals = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const stepFromDecimals = (decimals: number) =>
  decimals <= 0 ? "1" : (1 / 10 ** decimals).toFixed(decimals);

const resolvePriceDecimals = (referencePrice?: number | null) => {
  if (!referencePrice || !Number.isFinite(referencePrice)) return 5;
  if (referencePrice >= 1000) return 2;
  if (referencePrice >= 1) return 5;
  return 6;
};

const buildRatioProfile = ({
  priceDecimals,
  referencePrice,
  slRatio,
  tpRatio,
  minSl,
  minTp,
}: {
  priceDecimals: number;
  referencePrice?: number | null;
  slRatio: number;
  tpRatio: number;
  minSl: number;
  minTp: number;
}): InstrumentProfile => {
  const hasReferencePrice =
    typeof referencePrice === "number" && Number.isFinite(referencePrice);
  const nextSl = Math.max(
    hasReferencePrice ? referencePrice * slRatio : minSl,
    minSl
  );
  const nextTp = Math.max(
    hasReferencePrice ? referencePrice * tpRatio : minTp,
    minTp
  );

  return {
    priceDecimals,
    inputStep:
      hasReferencePrice && referencePrice >= 1000 && priceDecimals <= 2
        ? "1"
        : stepFromDecimals(priceDecimals),
    sl: roundToDecimals(nextSl, priceDecimals),
    tp: roundToDecimals(nextTp, priceDecimals),
  };
};

export const getInstrumentProfile = ({
  symbol,
  assetType,
  referencePrice,
}: {
  symbol: string;
  assetType?: string | null;
  referencePrice?: number | null;
}): InstrumentProfile => {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedAssetType = normalizeAssetType(assetType);

  if (SYMBOL_PROFILE_OVERRIDES[normalizedSymbol]) {
    return SYMBOL_PROFILE_OVERRIDES[normalizedSymbol];
  }

  if (normalizedAssetType === "physical currency") {
    return { priceDecimals: 5, inputStep: "0.01", sl: 0.01, tp: 0.01 };
  }

  if (
    normalizedAssetType === "digital currency" ||
    normalizedAssetType === "cryptocurrency"
  ) {
    const priceDecimals = referencePrice && referencePrice >= 1000 ? 2 : 4;
    return buildRatioProfile({
      priceDecimals,
      referencePrice,
      slRatio: 0.02,
      tpRatio: 0.04,
      minSl: 50,
      minTp: 100,
    });
  }

  if (
    normalizedAssetType === "commodity" ||
    normalizedAssetType === "precious metal"
  ) {
    return buildRatioProfile({
      priceDecimals: 2,
      referencePrice,
      slRatio: 0.01,
      tpRatio: 0.02,
      minSl: 1,
      minTp: 2,
    });
  }

  if (
    normalizedAssetType === "index" ||
    normalizedAssetType === "common stock" ||
    normalizedAssetType === "stock" ||
    normalizedAssetType === "etf" ||
    normalizedAssetType === "mutual fund"
  ) {
    return buildRatioProfile({
      priceDecimals: 2,
      referencePrice,
      slRatio: 0.01,
      tpRatio: 0.02,
      minSl: 0.5,
      minTp: 1,
    });
  }

  if (normalizedSymbol.includes("/")) {
    return { priceDecimals: 5, inputStep: "0.01", sl: 0.01, tp: 0.01 };
  }

  const priceDecimals = resolvePriceDecimals(referencePrice);
  return buildRatioProfile({
    priceDecimals,
    referencePrice,
    slRatio: 0.01,
    tpRatio: 0.02,
    minSl: priceDecimals >= 5 ? 0.01 : 0.5,
    minTp: priceDecimals >= 5 ? 0.01 : 1,
  });
};

export const getDefaultRiskDistance = (
  symbol: string,
  assetType?: string | null,
  referencePrice?: number | null
) => {
  const profile = getInstrumentProfile({ symbol, assetType, referencePrice });
  return { sl: profile.sl, tp: profile.tp };
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getIntervalByTimeframe = (timeframe: string) =>
  TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.interval ??
  "1day";

export const getTimeframeByInterval = (interval: string) =>
  TIMEFRAME_OPTIONS.find((option) => option.interval === interval)?.value ??
  DEFAULT_TIMEFRAME;
