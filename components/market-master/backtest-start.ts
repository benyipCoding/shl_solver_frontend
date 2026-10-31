import {
  computeBacktestKlineWindow,
  getIntervalByTimeframe,
  getTimeframeOptions,
  INITIAL_VISIBLE_COUNT,
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

type CoverageCheck = {
  coverage: { timeframe: string; earliestTime: number; latestTime: number };
} | { issue: string };

const formatBoundaryTime = (time: number) =>
  `${new Date(time * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const indexedCandles = (page: KlinePageMeta, timeframe: string) => {
  const candles = normalizeCandles(page.rawCandles);
  if (!candles.length || candles.length !== page.rawCandles.length) {
    throw new Error(`${timeframe} 历史 K 线缺失或格式异常，无法确定安全的回测起点`);
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
  const checks = await Promise.all(BACKTEST_HISTORY_REQUIREMENTS.map(async (requirement): Promise<CoverageCheck> => {
    const { interval, historyBars } = requirement;
    let page: KlinePageMeta;
    try {
      // Zero-based index N has N actual bars before it, including market closures.
      page = await fetchPage({ interval, offset: historyBars, outputsize: 1 });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      return { issue: `${requirement.timeframe} 历史数据检查失败，请检查该周期的数据或稍后重试。` };
    }
    const candle = normalizeCandles(page.rawCandles)[0];
    if (page.total <= historyBars) {
      const required = historyBars + 1;
      return { issue: `${requirement.timeframe} 历史不足：现有 ${page.total} 根，至少需 ${required} 根（起点前 ${historyBars} 根 + 起点 1 根），还缺 ${required - page.total} 根。` };
    }
    if (!candle || page.offset !== historyBars) {
      return { issue: `${requirement.timeframe} K 线缺失或位置异常，无法确认起点前的 ${historyBars} 根历史，请检查该周期数据。` };
    }
    const latestUnix = Date.parse(page.latest ?? "") / 1000;
    // Daily/weekly chart timestamps are UTC dates; metadata keeps the session time.
    const latestTime = interval === "1day" || interval === "1week"
      ? Math.floor(latestUnix / 86400) * 86400 : latestUnix;
    if (!Number.isFinite(latestTime) || latestTime < candle.time) {
      return { issue: `无法确认 ${requirement.timeframe} 的历史数据范围，请稍后重试。` };
    }
    return { coverage: { timeframe: requirement.timeframe, earliestTime: candle.time, latestTime } };
  }));
  // Report every failing timeframe in menu order, not whichever request finishes first.
  const issues = checks.flatMap((check) => "issue" in check ? [check.issue] : []);
  if (issues.length) {
    throw new Error(`无法开启逐K回测，以下周期的数据未满足要求：\n${issues.join("\n")}`);
  }
  const coverage = checks.flatMap((check) => "coverage" in check ? [check.coverage] : []);

  const earliestTime = Math.max(...coverage.map((item) => item.earliestTime));
  const latestTime = Math.min(...coverage.map((item) => item.latestTime));
  const earliestTimeframes = coverage.filter((item) => item.earliestTime === earliestTime).map((item) => item.timeframe).join("、");
  const latestTimeframes = coverage.filter((item) => item.latestTime === latestTime).map((item) => item.timeframe).join("、");
  const boundaryDetails =
    `最早起点受 ${earliestTimeframes} 限制：${formatBoundaryTime(earliestTime)}（已预留所需历史）。\n` +
    `最晚时间受 ${latestTimeframes} 限制：${formatBoundaryTime(latestTime)}。`;
  if (earliestTime > latestTime) {
    throw new Error(`各周期没有共同回测区间，最早起点晚于最晚数据时间。\n${boundaryDetails}\n请补齐上述周期的数据后再试。`);
  }

  const interval = getIntervalByTimeframe(timeframe);
  const fetchCurrentPage: FetchPage = async (params) => {
    try {
      return await fetchPage(params);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new Error(`无法加载 ${timeframe} 周期的回测 K 线，请检查该周期数据后重试。`);
    }
  };
  // Use real neighboring bars, not interpolation between first/last timestamps.
  // Include two newer bars: D1/W1's raw session time can be after the anchor even
  // though its chart timestamp (midnight) is before it. The next bar is needed.
  const [firstPage, lastPage] = await Promise.all([earliestTime, latestTime].map((aroundTime) =>
    fetchCurrentPage({ interval, aroundTime, beforeCount: 1, outputsize: 3 })
  ));
  const first = indexedCandles(firstPage, timeframe).find((candle) => candle.time >= earliestTime);
  const last = indexedCandles(lastPage, timeframe).filter((candle) => candle.time <= latestTime).at(-1);
  if (firstPage.total !== lastPage.total) {
    throw new Error(`${timeframe} 历史数据在检查期间发生变化，请重新开启逐K回测。`);
  }
  if (!first || !last || Math.max(first.currentIndex, INITIAL_VISIBLE_COUNT) > last.currentIndex) {
    throw new Error(`共同回测区间内没有 ${timeframe} K 线可作为合格起点。\n${boundaryDetails}\n请补齐相关周期数据或切换当前周期。`);
  }

  const total = firstPage.total;
  const randomStart = pickRandomBacktestStartIndex(total, {
    minIndex: first.currentIndex,
    maxIndex: last.currentIndex,
  });
  if (randomStart == null) {
    const availableForward = Math.max(0, total - Math.max(first.currentIndex, INITIAL_VISIBLE_COUNT));
    throw new Error(
      `共同回测区间不足：${timeframe} 后续 K 线不足。\n` +
      `最早起点受 ${earliestTimeframes} 限制：${formatBoundaryTime(earliestTime)}。\n` +
      `从最早合格起点开始，${timeframe} 最多剩 ${availableForward} 根可播放，至少需 ${MIN_FORWARD_CANDLES} 根，还缺 ${MIN_FORWARD_CANDLES - availableForward} 根。`
    );
  }
  const window = computeBacktestKlineWindow(total, randomStart, pageSize);
  const page = await fetchCurrentPage({ interval, offset: window.offset, outputsize: window.outputsize });
  const data = normalizeCandles(page.rawCandles);
  const currentIndex = randomStart - page.offset;
  const start = data[currentIndex - 1];
  if (
    page.total !== total || page.offset !== window.offset ||
    data.length !== window.outputsize || !start ||
    start.time < earliestTime || start.time > latestTime ||
    data.length - currentIndex < MIN_FORWARD_CANDLES
  ) {
    throw new Error(`${timeframe} 历史数据已变化或回测窗口不完整，请重新开启逐K回测`);
  }
  return { page, data, currentIndex };
}
