export const KLINE_PAGE_SIZE = 5000;
export const KLINE_HISTORY_EDGE_BARS = 40;
export const KLINE_FORWARD_PREFETCH_BARS = 400;

export type CandleInput = {
  datetime?: string;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
  [key: string]: unknown;
};

export type NormalizedCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type KlinePageMeta = {
  rawCandles: CandleInput[];
  assetType: string | null;
  currency: string | null;
  exchange: string | null;
  latestClose: unknown;
  total: number;
  offset: number;
  hasMoreHistory: boolean;
  hasMoreFuture: boolean;
  earliest: string | null;
  latest: string | null;
};

type MarketDataPayload = {
  error?: string;
  message?: string;
  data?: {
    candles?: CandleInput[];
    values?: CandleInput[];
    count?: number;
    total?: number;
    offset?: number;
    has_more_history?: boolean;
    has_more_future?: boolean;
    earliest?: string;
    latest?: string;
    filtering?: { reason?: string };
    meta?: {
      asset_type?: string;
      type?: string;
      currency?: string;
      exchange?: string;
      total?: number;
      offset?: number;
      has_more_history?: boolean;
      has_more_future?: boolean;
      earliest?: string;
      latest?: string;
    };
  };
};

const toUtcEpochSeconds = (dateTimeValue?: string) => {
  if (!dateTimeValue) return null;

  const normalizedValue = dateTimeValue.includes("T")
    ? dateTimeValue
    : dateTimeValue.includes(" ")
      ? dateTimeValue.replace(" ", "T")
      : `${dateTimeValue}T00:00:00`;

  const utcValue = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalizedValue)
    ? normalizedValue
    : `${normalizedValue}Z`;

  const parsedTime = Date.parse(utcValue);
  return Number.isNaN(parsedTime) ? null : Math.floor(parsedTime / 1000);
};

export const normalizeCandles = (
  candles: CandleInput[] = []
): NormalizedCandle[] => {
  const candlesByTime = new Map<number, NormalizedCandle>();

  for (const candle of candles) {
    const time = toUtcEpochSeconds(candle.datetime);
    const prices = [candle.open, candle.high, candle.low, candle.close];
    if (
      time === null ||
      prices.some(
        (value) =>
          value == null ||
          (typeof value === "string" && value.trim() === "") ||
          !Number.isFinite(Number(value))
      )
    ) {
      continue;
    }

    const [open, high, low, close] = prices.map(Number);
    // Lightweight Charts requires strictly increasing, unique times. Deduplicate
    // after UTC/second conversion, keeping the last valid candle for each time.
    // Do this before indicator calculation so every series uses the same bars.
    candlesByTime.set(time, { time, open, high, low, close });
  }

  return [...candlesByTime.values()].sort((a, b) => a.time - b.time);
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const withWindowMeta = (
  payload: MarketDataPayload,
  rawCandles: CandleInput[],
  extra: Pick<
    KlinePageMeta,
    "assetType" | "currency" | "exchange" | "latestClose"
  >
): KlinePageMeta => {
  const total = toFiniteNumber(
    payload.data?.total ?? payload.data?.meta?.total,
    rawCandles.length
  );
  const offset = Math.max(
    0,
    toFiniteNumber(payload.data?.offset ?? payload.data?.meta?.offset, 0)
  );
  return {
    rawCandles,
    ...extra,
    total: Math.max(total, rawCandles.length + offset),
    offset,
    hasMoreHistory: Boolean(
      payload.data?.has_more_history ??
        payload.data?.meta?.has_more_history ??
        offset > 0
    ),
    hasMoreFuture: Boolean(
      payload.data?.has_more_future ??
        payload.data?.meta?.has_more_future ??
        offset + rawCandles.length < total
    ),
    earliest:
      payload.data?.earliest ?? payload.data?.meta?.earliest ?? null,
    latest: payload.data?.latest ?? payload.data?.meta?.latest ?? null,
  };
};

const buildDefaultsMarketData = (
  payload: MarketDataPayload
): KlinePageMeta => {
  const rawCandles = payload.data?.candles ?? [];
  return withWindowMeta(payload, rawCandles, {
    assetType: payload.data?.meta?.asset_type ?? null,
    currency: payload.data?.meta?.currency ?? null,
    exchange: payload.data?.meta?.exchange ?? null,
    latestClose: rawCandles[0]?.close,
  });
};

const buildTimeSeriesMarketData = (
  payload: MarketDataPayload
): KlinePageMeta => {
  const rawCandles = payload.data?.values ?? [];
  return withWindowMeta(payload, rawCandles, {
    assetType: payload.data?.meta?.type ?? null,
    currency: payload.data?.meta?.currency ?? null,
    exchange: payload.data?.meta?.exchange ?? null,
    latestClose: rawCandles[0]?.close,
  });
};

const shouldRetryWithTimeSeries = (
  payload: MarketDataPayload,
  rawCandles: CandleInput[]
) => {
  if (rawCandles.length > 0) return false;
  const filteringReason = payload.data?.filtering?.reason;
  return (
    payload.data?.count === 0 ||
    (typeof filteringReason === "string" &&
      filteringReason.endsWith("_api_error_fallback"))
  );
};

export const getNewestRawDatetime = (rawCandles: CandleInput[]) => {
  const sorted = normalizeCandles(rawCandles);
  if (!sorted.length) return null;

  const newestTime = sorted[sorted.length - 1].time;
  const match = rawCandles.find(
    (candle) => toUtcEpochSeconds(candle.datetime) === newestTime
  );
  return typeof match?.datetime === "string" ? match.datetime : null;
};

export const getOldestRawDatetime = (rawCandles: CandleInput[]) => {
  const sorted = normalizeCandles(rawCandles);
  if (!sorted.length) return null;

  const oldestTime = sorted[0].time;
  const match = rawCandles.find(
    (candle) => toUtcEpochSeconds(candle.datetime) === oldestTime
  );
  return typeof match?.datetime === "string" ? match.datetime : null;
};

export const estimateUnixAtIndex = (
  earliestUnix: number,
  latestUnix: number,
  totalCount: number,
  index: number
) => {
  if (totalCount <= 1) return earliestUnix;
  const clamped = Math.min(Math.max(index, 0), totalCount - 1);
  return Math.round(
    earliestUnix + ((latestUnix - earliestUnix) * clamped) / (totalCount - 1)
  );
};

export const mergeCandleData = (
  existing: NormalizedCandle[],
  older: NormalizedCandle[]
) => {
  const merged = new Map<number, NormalizedCandle>();
  for (const candle of older) merged.set(candle.time, candle);
  for (const candle of existing) merged.set(candle.time, candle);
  return [...merged.values()].sort((a, b) => a.time - b.time);
};

export const windowsOverlapOrTouch = (
  leftOffset: number,
  leftLength: number,
  rightOffset: number,
  rightLength: number
) => {
  const leftEnd = leftOffset + leftLength;
  const rightEnd = rightOffset + rightLength;
  return rightOffset <= leftEnd && rightEnd >= leftOffset;
};

export const fetchKlinePage = async (
  customFetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>,
  {
    symbol,
    interval,
    outputsize,
    endDate,
    offset,
    aroundTime,
    beforeCount,
    afterDate,
  }: {
    symbol: string;
    interval: string;
    outputsize: number;
    endDate?: string;
    offset?: number;
    aroundTime?: string | number;
    beforeCount?: number;
    afterDate?: string;
  }
): Promise<KlinePageMeta> => {
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(outputsize),
    timezone: "UTC",
  });
  if (endDate) params.set("end_date", endDate);
  if (offset != null) params.set("offset", String(offset));
  if (aroundTime != null && aroundTime !== "") {
    params.set("around_time", String(aroundTime));
  }
  if (beforeCount != null) params.set("before_count", String(beforeCount));
  if (afterDate) params.set("after_date", afterDate);

  const response = await customFetch(
    `/api/market_master/kline/defaults?${params.toString()}`
  );
  const payload = (await response.json()) as MarketDataPayload;

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "获取 K 线数据失败");
  }

  let marketData = buildDefaultsMarketData(payload);
  if (shouldRetryWithTimeSeries(payload, marketData.rawCandles)) {
    const fallbackResponse = await customFetch(
      `/api/market_master/time-series?${params.toString()}`
    );
    const fallbackPayload =
      (await fallbackResponse.json()) as MarketDataPayload;

    if (
      fallbackResponse.ok &&
      Array.isArray(fallbackPayload.data?.values) &&
      fallbackPayload.data.values.length > 0
    ) {
      marketData = buildTimeSeriesMarketData(fallbackPayload);
    }
  }

  return marketData;
};
