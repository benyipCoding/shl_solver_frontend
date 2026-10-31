import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

let random = 0;
const math = Object.create(Math);
math.random = () => random;
const load = (file, dependencies = {}) => {
  const target = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: target, exports: target.exports, Math: math, Error, require: (name) => dependencies[name] });
  return target.exports;
};
const config = load("./market-config.ts");
const marketData = load("./market-data.ts");
const { prepareRandomBacktestStart: prepare, BACKTEST_HISTORY_REQUIREMENTS: requirements } = load("./backtest-start.ts", {
  "./market-config": config, "./market-data": marketData,
});
const DAY = 86400;
const unix = (date) => Date.parse(date) / 1000;
const start1994 = unix("1994-01-03T00:00:00Z");
const start2009 = unix("2009-01-05T00:00:00Z");
const end = unix("2026-10-30T00:00:00Z");

// Lazy feeds can represent millions of bars without allocating them. Include
// weekends and daily session timestamps, as the real API does.
function feed(start, step, options = {}) {
  const time = (index) => start + (options.weekends === false ? index * step
    : Math.floor(index * step / (5 * DAY)) * 7 * DAY + index * step % (5 * DAY)) + (options.session ?? 0);
  const total = options.total ?? Math.floor((end - start) * 5 / 7 / step);
  return { time, total, daily: options.daily ?? false };
}
const lowerBound = (source, time) => {
  let left = 0, right = source.total;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (source.time(mid) < time) left = mid + 1;
    else right = mid;
  }
  return left;
};
function defaultFeeds() {
  const feeds = {};
  for (const item of requirements) {
    if (item.interval === "1week") {
      feeds[item.interval] = feed(start1994, 7 * DAY, {
        total: Math.floor((end - start1994) / (7 * DAY)), weekends: false, daily: true, session: 21 * 3600,
      });
      continue;
    }
    const match = /^(\d+)(min|h|day)$/.exec(item.interval);
    const step = Number(match[1]) * { min: 60, h: 3600, day: DAY }[match[2]];
    feeds[item.interval] = feed(item.interval === "5min" ? start2009 : start1994, step, {
      daily: item.interval === "1day", session: item.interval === "1day" ? 21 * 3600 : 0,
    });
  }
  return feeds;
}
function api(feeds = defaultFeeds(), intercept) {
  const calls = [];
  const fetch = async (params) => {
    calls.push(params);
    const { interval, outputsize, aroundTime } = params;
    const source = feeds[interval];
    if (!source) throw new Error("No history");
    let offset, first, last;
    if (aroundTime != null) {
      const split = lowerBound(source, aroundTime);
      offset = Math.max(0, split - params.beforeCount);
      last = Math.min(source.total, split + Math.max(1, outputsize - (split - offset)));
      // Match the API's extra older bar at the end of history.
      first = Math.max(0, offset - 1, last - outputsize);
    } else {
      offset = Math.max(0, params.offset ?? source.total - outputsize);
      if (offset >= source.total) offset = Math.max(0, source.total - outputsize);
      first = offset;
      last = Math.min(source.total, first + outputsize);
    }
    const rawCandles = Array.from({ length: last - first }, (_, index) => {
      const time = source.time(first + index);
      const datetime = new Date(time * 1000).toISOString();
      return { datetime: source.daily ? datetime.slice(0, 10) : datetime, open: 10, high: 12, low: 9, close: 11 };
    }).reverse();
    const page = { rawCandles, offset, total: source.total, latest: new Date(source.time(source.total - 1) * 1000).toISOString() };
    return intercept?.(params, page) ?? page;
  };
  return { fetch, calls, feeds };
}
const timeOf = (result) => result.data[result.currentIndex - 1].time;
const threshold = (source, count) => source.daily ? Math.floor(source.time(count) / DAY) * DAY : source.time(count);

test("XAU-style D1 history from 1994 is bounded by m5 from 2009, checking every history timeframe", async () => {
  random = 0;
  const source = api();
  const result = await prepare(source.fetch, "D1", 20000);
  const m5Start = source.feeds["5min"].time(5000);
  assert.ok(timeOf(result) >= m5Start);
  assert.ok(timeOf(result) < m5Start + 3 * DAY);
  for (const item of requirements) {
    assert.ok(timeOf(result) >= threshold(source.feeds[item.interval], item.historyBars), item.timeframe);
  }
  assert.equal(source.calls.some(({ interval }) => interval === "1min"), false);
  assert.equal(source.calls.filter(({ offset, outputsize }) => offset === 5000 && outputsize === 1).length, 9);
  assert.equal(source.calls.filter(({ interval, offset }) => interval === "1day" && offset === 200).length, 1);
  assert.equal(source.calls.filter(({ interval, offset }) => interval === "1week" && offset === 200).length, 1);
  assert.ok(result.data.length - result.currentIndex >= 2000);
  assert.ok(source.calls.at(-1).offset != null, "final window must use an exact index");
});

test("the limiting timeframe can be H8, independent of the selected chart", async () => {
  random = 0;
  const feeds = defaultFeeds();
  feeds["8h"] = feed(unix("2012-01-02T00:00:00Z"), 8 * 3600);
  const result = await prepare(api(feeds).fetch, "m5", 20000);
  assert.equal(timeOf(result), feeds["8h"].time(5000));
  assert.ok(result.currentIndex > 5000);
});

test("random samples respect the common latest date and keep 2000 future bars", async () => {
  const feeds = defaultFeeds();
  feeds["3h"] = feed(start1994, 3 * 3600, { total: 70000 });
  for (const value of [0, 0.1, 0.5, 0.9, 0.999999999]) {
    random = value;
    const result = await prepare(api(feeds).fetch, "m5", 20000);
    assert.ok(timeOf(result) >= feeds["5min"].time(5000));
    assert.ok(timeOf(result) <= feeds["3h"].time(feeds["3h"].total - 1));
    assert.ok(result.data.length - result.currentIndex >= 2000);
  }
});

test("exactly 5000 preceding bars and 2000 future bars leaves one valid start", async () => {
  const feeds = Object.fromEntries(requirements.map(({ interval }) => [interval,
    feed(start1994, DAY, { total: interval === "5min" ? 7001 : 9000, weekends: false })]));
  random = 0.999999999;
  const result = await prepare(api(feeds).fetch, "m5", 20000);
  assert.equal(result.currentIndex, 5001);
  assert.equal(result.data.length - result.currentIndex, 2000);
  feeds["5min"].total = 7000;
  await assert.rejects(prepare(api(feeds).fetch, "m5", 20000), /2000/);
});

test("insufficient or missing periods prevent startup instead of silently weakening the range", async () => {
  const feeds = defaultFeeds();
  feeds["15min"].total = 5000;
  await assert.rejects(prepare(api(feeds).fetch, "D1", 20000), /m15.*5000/);
  delete feeds["15min"];
  await assert.rejects(prepare(api(feeds).fetch, "D1", 20000), /m15.*重试/);
});

test("all insufficient periods report their actual counts and deficits in menu order", async () => {
  const feeds = defaultFeeds();
  feeds["5min"].total = 3200;
  feeds["15min"].total = 5000;
  feeds["1week"].total = 150;
  const source = api(feeds);
  // The first item completes last; diagnostics must not depend on network order.
  const fetch = async (params) => {
    if (params.interval === "5min") await new Promise((resolve) => setImmediate(resolve));
    return source.fetch(params);
  };
  await assert.rejects(prepare(fetch, "D1", 20000), (error) => {
    assert.match(error.message, /m5 历史不足：现有 3200 根.*还缺 1801 根/);
    assert.match(error.message, /m15 历史不足：现有 5000 根.*还缺 1 根/);
    assert.match(error.message, /W1 历史不足：现有 150 根.*还缺 51 根/);
    assert.ok(error.message.indexOf("m5") < error.message.indexOf("m15"));
    assert.ok(error.message.indexOf("m15") < error.message.indexOf("W1"));
    assert.equal(source.calls.length, requirements.length);
    return true;
  });
});

test("a failed check is reported alongside shortages without inventing a missing-bar count", async () => {
  const feeds = defaultFeeds();
  feeds["5min"].total = 3000;
  delete feeds["1week"];
  await assert.rejects(prepare(api(feeds).fetch, "D1", 20000), (error) => {
    assert.match(error.message, /m5 历史不足/);
    assert.match(error.message, /W1 历史数据检查失败/);
    assert.doesNotMatch(error.message, /W1 历史不足/);
    return true;
  });
});

test("D1 uses 200 preceding bars and missing weekly data prevents starting", async () => {
  const feeds = defaultFeeds();
  feeds["1day"] = feed(start2009, DAY, { total: 4500, daily: true, session: 21 * 3600 });
  random = 0;
  const source = api(feeds);
  const result = await prepare(source.fetch, "m5", 20000);
  assert.ok(timeOf(result) >= threshold(feeds["1day"], 200));
  assert.equal(source.calls.some(({ interval }) => interval === "1week"), true);
  feeds["1day"].total = 200;
  await assert.rejects(prepare(api(feeds).fetch, "m5", 20000), /D1.*200/);
  feeds["1day"].total = 4500;
  delete feeds["1week"];
  await assert.rejects(prepare(api(feeds).fetch, "m5", 20000), /W1.*重试/);
});

test("W1's 200-bar warmup can set the common lower boundary", async () => {
  random = 0;
  const feeds = defaultFeeds();
  feeds["1week"] = feed(unix("2015-01-05T00:00:00Z"), 7 * DAY, {
    total: 600, weekends: false, daily: true, session: 21 * 3600,
  });
  const result = await prepare(api(feeds).fetch, "m5", 20000);
  assert.equal(timeOf(result), threshold(feeds["1week"], 200));
  feeds["1week"].total = 200;
  await assert.rejects(prepare(api(feeds).fetch, "m5", 20000), /W1.*200/);
});

test("the latest weekly bar also limits the common upper boundary using its chart date", async () => {
  random = 0.999999999;
  const feeds = defaultFeeds();
  feeds["1week"].total = 1100;
  const result = await prepare(api(feeds).fetch, "m5", 20000);
  assert.equal(timeOf(result), threshold(feeds["1week"], 1099));
});

test("disjoint histories have no common start", async () => {
  const feeds = defaultFeeds();
  feeds["30min"] = feed(start1994, 1800, { total: 6000 });
  await assert.rejects(prepare(api(feeds).fetch, "D1", 20000), (error) => {
    assert.match(error.message, /共同回测区间/);
    assert.match(error.message, /最早起点受 m5 限制/);
    assert.match(error.message, /最晚时间受 m30 限制/);
    assert.ok(error.message.includes(new Date(feeds["5min"].time(5000) * 1000).toISOString().slice(0, 10)));
    assert.ok(error.message.includes(new Date(feeds["30min"].time(5999) * 1000).toISOString().slice(0, 10)));
    assert.match(error.message, /UTC/);
    return true;
  });
});

test("all periods tied for a limiting boundary are named", async () => {
  const feeds = defaultFeeds();
  feeds["15min"] = feed(start1994, 900, { total: 11999 });
  feeds["30min"] = feed(start1994, 1800, { total: 6000 });
  await assert.rejects(prepare(api(feeds).fetch, "D1", 20000), /最晚时间受 m15、m30 限制/);
});

test("a late weekly start explains the resulting daily forward-bar shortage", async () => {
  const feeds = defaultFeeds();
  feeds["1week"] = feed(unix("2020-01-06T00:00:00Z"), 7 * DAY, {
    total: 350, weekends: false, daily: true,
  });
  const firstDaily = lowerBound(feeds["1day"], threshold(feeds["1week"], 200));
  const available = feeds["1day"].total - firstDaily - 1;
  assert.ok(available < 2000);
  await assert.rejects(prepare(api(feeds).fetch, "D1", 20000), (error) => {
    assert.match(error.message, /D1 后续 K 线不足/);
    assert.match(error.message, /最早起点受 W1 限制/);
    assert.ok(error.message.includes(`D1 最多剩 ${available} 根可播放`));
    assert.ok(error.message.includes(`还缺 ${2000 - available} 根`));
    return true;
  });
});

test("loading a changed or incomplete final window fails instead of clamping outside the allowed range", async () => {
  random = 0;
  for (const mutate of [
    (page) => ({ ...page, total: page.total + 1 }),
    (page) => ({ ...page, rawCandles: page.rawCandles.slice(1) }),
    (page) => ({ ...page, offset: page.offset + 1 }),
  ]) {
    const source = api(defaultFeeds(), (params, page) => params.outputsize > 3 ? mutate(page) : page);
    await assert.rejects(prepare(source.fetch, "m5", 20000), /历史数据已变化|窗口不完整/);
  }
});

test("abort propagates so an abandoned startup cannot become a different random session", async () => {
  const abort = new Error("cancelled");
  abort.name = "AbortError";
  await assert.rejects(prepare(async () => { throw abort; }, "D1", 20000), (error) => error === abort);
});

test("abort remains immediate even while other checks are still pending", { timeout: 1000 }, async () => {
  const abort = new Error("cancelled");
  abort.name = "AbortError";
  await assert.rejects(prepare(async ({ interval }) => {
    if (interval === "1week") throw abort;
    return new Promise(() => {});
  }, "D1", 20000), (error) => error === abort);
});

test("weekly charts use the common range and retain the existing future-bar requirement", async () => {
  random = 0;
  const feeds = defaultFeeds();
  // Synthetic long weekly history preserves the existing 2000-forward-bars rule.
  feeds["1week"] = feed(unix("1950-01-02T00:00:00Z"), 7 * DAY, { total: 6000, weekends: false, daily: true });
  const result = await prepare(api(feeds).fetch, "W1", 20000);
  assert.ok(timeOf(result) >= feeds["5min"].time(5000));
  assert.ok(timeOf(result) < feeds["5min"].time(5000) + 7 * DAY);
});

// Run the actual entry effect to cover cancellation/failure and the session
// handoff, without rendering the chart or making network requests.
const pageSource = fs.readFileSync(new URL("./MarketMasterPage.tsx", import.meta.url), "utf8");
const pageAst = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let entryEffect;
function findEntryEffect(node) {
  if (ts.isCallExpression(node) && node.expression.getText(pageAst) === "useEffect" &&
      node.arguments[0]?.getText(pageAst).includes("const enterBacktest = async")) {
    entryEffect = node.arguments[0].getText(pageAst);
  }
  ts.forEachChild(node, findEntryEffect);
}
findEntryEffect(pageAst);
assert.ok(entryEffect);

function entryHarness(prepareStart) {
  const changes = [];
  const context = {
    ...config, AbortController,
    isDataLoading: false, isBacktestMode: true, dataMode: "history", symbol: "XAU/USD", timeframe: "D1",
    fullDataRef: { current: [{ time: 999 }] }, wasBacktestModeRef: { current: false },
    isBacktestModeRef: { current: true }, replayDetailRef: { current: null }, historyLoadingRef: { current: false },
    backtestCompletionRequestedRef: { current: false }, isReplayModeRef: { current: false },
    clientSessionIdRef: { current: null }, pendingSessionStartRef: { current: null }, backtestSampleRef: { current: null },
    currentIndexRef: { current: 1 }, loadedOffsetRef: { current: 0 }, totalCandlesRef: { current: 1 },
    crypto: { randomUUID: () => "test-session" }, KLINE_PAGE_SIZE: 20000,
    prepareRandomBacktestStart: prepareStart,
    fetchKlinePage: (fetch, params) => fetch("/history", params),
    customFetch: async (_url, init) => { context.signal = init.signal; return {}; },
    resetBacktestAccount: () => changes.push(["reset"]), disableAutomaticDrawings() {},
    toast: { error: (message, options) => changes.push(["error", message, options]) },
    applyCandlePage: (page, data, options) => {
      changes.push(["apply"]);
      context.fullDataRef.current = data;
      context.currentIndexRef.current = options.currentIndex;
      context.loadedOffsetRef.current = page.offset;
      context.totalCandlesRef.current = page.total;
    },
  };
  for (const name of ["IsBacktestMode", "IsPreparingBacktest", "IsHistoryLoading", "HistoryLoadKind", "IsPlaying", "IsReplayMode"]) {
    context[`set${name}`] = (value) => changes.push([name, value]);
  }
  const run = vm.runInNewContext(ts.transpileModule(`(${entryEffect})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return { context, changes, cleanup: run() };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const preparedWindow = { page: { offset: 1000, total: 10000 }, data: [{ time: 10 }, { time: 20 }], currentIndex: 2 };

test("exiting or changing market during startup aborts requests and ignores their late result", async () => {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const h = entryHarness(async (fetch) => { await fetch({ interval: "1day", outputsize: 1 }); return pending; });
  assert.equal(h.context.historyLoadingRef.current, true);
  h.cleanup();
  assert.equal(h.context.signal.aborted, true);
  resolve(preparedWindow);
  await flush();
  assert.equal(h.context.historyLoadingRef.current, false);
  assert.equal(h.context.fullDataRef.current[0].time, 999);
  assert.equal(h.context.pendingSessionStartRef.current, null);
  assert.equal(h.changes.some(([kind]) => kind === "apply" || kind === "error"), false);
});

test("failed validation exits startup without resetting the chart or creating a session", async () => {
  const h = entryHarness(async () => { throw new Error("m5 历史不足"); });
  await flush();
  assert.ok(h.changes.some(([kind, value]) => kind === "IsBacktestMode" && value === false));
  assert.ok(h.changes.some(([kind, value]) => kind === "error" && value === "m5 历史不足"));
  const options = h.changes.find(([kind]) => kind === "error")[2];
  assert.ok(options.duration >= 10000);
  assert.equal(options.style.whiteSpace, "pre-line");
  assert.equal(h.changes.some(([kind]) => kind === "apply" || kind === "reset"), false);
  assert.equal(h.context.wasBacktestModeRef.current, false);
  assert.equal(h.context.historyLoadingRef.current, false);
  assert.equal(h.context.pendingSessionStartRef.current, null);
});

test("successful startup persists the verified candle and exact global index", async () => {
  const h = entryHarness(async () => preparedWindow);
  await flush();
  assert.equal(h.context.wasBacktestModeRef.current, true);
  assert.equal(h.context.pendingSessionStartRef.current.start_bar_time, 20);
  assert.equal(h.context.pendingSessionStartRef.current.start_bar_index, 1001);
  assert.equal(h.context.backtestSampleRef.current.endIndex, 10000);
  assert.equal(h.context.historyLoadingRef.current, false);
});
