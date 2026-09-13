export const KLINE_PAGE_SIZE = 5000;

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
};

type MarketDataPayload = {
  error?: string;
  message?: string;
  data?: {
    candles?: CandleInput[];
    values?: CandleInput[];
    count?: number;
    filtering?: { reason?: string };
    meta?: {
      asset_type?: string;
      type?: string;
      currency?: string;
      exchange?: string;
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
): NormalizedCandle[] =>
  [...candles]
    .sort(
      (a, b) =>
        (toUtcEpochSeconds(a.datetime) || 0) -
        (toUtcEpochSeconds(b.datetime) || 0)
    )
    .map((candle) => {
      const time = toUtcEpochSeconds(candle.datetime);
      const open = Number(candle.open);
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);

      if (
        time === null ||
        [open, high, low, close].some((value) => Number.isNaN(value))
      ) {
        return null;
      }

      return { time, open, high, low, close };
    })
    .filter((candle): candle is NormalizedCandle => candle !== null);

const buildDefaultsMarketData = (
  payload: MarketDataPayload
): KlinePageMeta => {
  const rawCandles = payload.data?.candles ?? [];
  return {
    rawCandles,
    assetType: payload.data?.meta?.asset_type ?? null,
    currency: payload.data?.meta?.currency ?? null,
    exchange: payload.data?.meta?.exchange ?? null,
    latestClose: rawCandles[0]?.close,
  };
};

const buildTimeSeriesMarketData = (
  payload: MarketDataPayload
): KlinePageMeta => {
  const rawCandles = payload.data?.values ?? [];
  return {
    rawCandles,
    assetType: payload.data?.meta?.type ?? null,
    currency: payload.data?.meta?.currency ?? null,
    exchange: payload.data?.meta?.exchange ?? null,
    latestClose: rawCandles[0]?.close,
  };
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

export const getOldestRawDatetime = (rawCandles: CandleInput[]) => {
  const sorted = normalizeCandles(rawCandles);
  if (!sorted.length) return null;

  const oldestTime = sorted[0].time;
  const match = rawCandles.find(
    (candle) => toUtcEpochSeconds(candle.datetime) === oldestTime
  );
  return typeof match?.datetime === "string" ? match.datetime : null;
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
  }: {
    symbol: string;
    interval: string;
    outputsize: number;
    endDate?: string;
  }
): Promise<KlinePageMeta> => {
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(outputsize),
    timezone: "UTC",
  });
  if (endDate) params.set("end_date", endDate);

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
