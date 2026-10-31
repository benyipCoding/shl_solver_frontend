import {
  computeBacktestKlineWindow,
  getIntervalByTimeframe,
  getTimeframeOptions,
  MIN_FORWARD_CANDLES,
  pickRandomBacktestStartIndex,
} from "./market-config";
import { normalizeCandles, type fetchKlinePage, type KlinePageMeta } from "./market-data";

export const BACKTEST_HISTORY_REQUIREMENTS = getTimeframeOptions("history")
  .map(({ value, interval }) => ({
    timeframe: value,
    interval,
    historyBars: value === "D1" || value === "W1" ? 200 : 5000,
  }));

type FetchPage = (params: Omit<Parameters<typeof fetchKlinePage>[1], "symbol">) => Promise<KlinePageMeta>;

const indexedCandles = (page: KlinePageMeta) => {
  const candles = normalizeCandles(page.rawCandles);
  if (!candles.length || candles.length !== page.rawCandles.length) {
    throw new Error("历史 K 线缺失或格式异常，无法确定安全的回测起点");
  }
  // An around_time beyond the last bar can include an extra preceding bar.
  // Anchor terminal pages to the real tail rather than trusting that offset.
  const offset = Math.min(page.offset, page.total - candles.length);
  return candles.map((candle, index) => ({ time: candle.time, currentIndex: offset + index + 1 }));
};

export async function prepareRandomBacktestStart(
  fetchPage: FetchPage,
  timeframe: string,
  pageSize: number
) {
  const coverage = await Promise.all(BACKTEST_HISTORY_REQUIREMENTS.map(async (requirement) => {
    const { interval, historyBars } = requirement;
    let page: KlinePageMeta;
    try {
      // Zero-based index N has N actual bars before it, including market closures.
      page = await fetchPage({ interval, offset: historyBars, outputsize: 1 });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new Error(`无法检查 ${requirement.timeframe} 的历史数据，请稍后重试`);
    }
    const candle = normalizeCandles(page.rawCandles)[0];
    if (!candle || page.total <= historyBars || page.offset !== historyBars) {
      throw new Error(`${requirement.timeframe} 历史不足：回测起点前至少需要 ${historyBars} 根 K 线`);
    }
    const latestUnix = Date.parse(page.latest ?? "") / 1000;
    // Daily/weekly chart timestamps are UTC dates; metadata keeps the session time.
    const latestTime = interval === "1day" || interval === "1week"
      ? Math.floor(latestUnix / 86400) * 86400 : latestUnix;
    if (!Number.isFinite(latestTime) || latestTime < candle.time) {
      throw new Error(`无法确认 ${requirement.timeframe} 的历史数据范围，请稍后重试`);
    }
    return { earliestTime: candle.time, latestTime };
  }));

  const earliestTime = Math.max(...coverage.map((item) => item.earliestTime));
  const latestTime = Math.min(...coverage.map((item) => item.latestTime));
  const noOverlap = () => new Error("各周期没有满足历史数量要求的共同回测区间，请补齐历史数据或切换品种");
  if (earliestTime > latestTime) throw noOverlap();

  const interval = getIntervalByTimeframe(timeframe);
  // Use real neighboring bars, not interpolation between first/last timestamps.
  // Include two newer bars: D1/W1's raw session time can be after the anchor even
  // though its chart timestamp (midnight) is before it. The next bar is needed.
  const [firstPage, lastPage] = await Promise.all([earliestTime, latestTime].map((aroundTime) =>
    fetchPage({ interval, aroundTime, beforeCount: 1, outputsize: 3 })
  ));
  const first = indexedCandles(firstPage).find((candle) => candle.time >= earliestTime);
  const last = indexedCandles(lastPage).filter((candle) => candle.time <= latestTime).at(-1);
  if (!first || !last || firstPage.total !== lastPage.total) throw noOverlap();

  const total = firstPage.total;
  const randomStart = pickRandomBacktestStartIndex(total, {
    minIndex: first.currentIndex,
    maxIndex: last.currentIndex,
  });
  if (randomStart == null) {
    throw new Error(`共同回测区间不足，当前周期还需保留至少 ${MIN_FORWARD_CANDLES} 根后续 K 线`);
  }
  const window = computeBacktestKlineWindow(total, randomStart, pageSize);
  const page = await fetchPage({ interval, offset: window.offset, outputsize: window.outputsize });
  const data = normalizeCandles(page.rawCandles);
  const currentIndex = randomStart - page.offset;
  const start = data[currentIndex - 1];
  if (
    page.total !== total || page.offset !== window.offset ||
    data.length !== window.outputsize || !start ||
    start.time < earliestTime || start.time > latestTime ||
    data.length - currentIndex < MIN_FORWARD_CANDLES
  ) {
    throw new Error("历史数据已变化或回测窗口不完整，请重新开启逐K回测");
  }
  return { page, data, currentIndex };
}
