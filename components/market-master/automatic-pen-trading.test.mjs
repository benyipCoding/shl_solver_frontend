import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
} }).outputText;
function loadModule(relativePath, dependencies = {}) {
  const target = { exports: {} };
  vm.runInNewContext(transpile(fs.readFileSync(new URL(relativePath, import.meta.url), "utf8")), {
    module: target, exports: target.exports,
    require: (name) => { assert.ok(name in dependencies, `unexpected dependency ${name}`); return dependencies[name]; },
  });
  return target.exports;
}
const pens = loadModule("./automatic-pens.ts");
const trading = loadModule("./automatic-pen-trading.ts", { "./automatic-pens": pens });
const management = loadModule("./trade-management.ts");
const marketData = loadModule("./market-data.ts");
const chartWindow = loadModule("./chart-window.ts");
const bookModule = loadModule("./automatic-trade-book.ts");
const replay = loadModule("./backtest-replay.ts", { "./trade-management": management });
const persistence = loadModule("./backtest-persistence.ts");
const configModule = loadModule("./automatic-trading-config.ts");
const runner = loadModule("./automatic-trading-runner.ts");
const risk = loadModule("./automatic-pen-risk.ts", { "./automatic-trading-config": configModule, "./automatic-pens": pens, "./trade-management": management });
const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/gbp-usd-h4-202107.json", import.meta.url), "utf8")).candles;
const xauFixture = JSON.parse(fs.readFileSync(new URL("./fixtures/xau-usd-h4-201106.json", import.meta.url), "utf8")).candles;
const at = (date) => fixture.findIndex((candle) => candle.datetime === date);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("GBP/USD L1 buys when it first forms, L2 sells, and the p5/p6 counterexample does not sell", () => {
  const tracker = trading.createAutomaticPenTradeTracker([]);
  const signals = fixture.flatMap((candle) => {
    const side = tracker.advance(candle);
    return side ? [{ side, date: candle.datetime, price: candle.close }] : [];
  });
  assert.ok(signals.some((s) => s.side === "Buy" && s.date === "2021-08-01T20:00:00"));
  assert.ok(signals.some((s) => s.side === "Sell" && s.date === "2021-08-12T00:00:00"));
  assert.ok(!signals.some((s) => s.date === "2021-08-02T12:00:00" || s.date === "2021-08-12T04:00:00"));
  assert.ok(!signals.some((s) => s.side === "Sell" && s.date === "2021-08-18T08:00:00"));
  const generated = pens.generateAutomaticPens(fixture);
  assert.equal(generated[6].endPoint.price, 1.37732); // p1
  assert.equal(generated[9].endPoint.price, 1.37939); // p2
  assert.equal(generated[11].endPoint.price, 1.38852); // p3
  assert.equal(generated[14].endPoint.price, 1.38616); // p4
  assert.equal(generated[13].endPoint.price, 1.384645); // p5
  assert.equal(generated[16].endPoint.price, 1.38778); // p6
});

test("XAU/USD L1 is only the fourth pen after the new high, so old p1/p2 cannot authorize a short", () => {
  const index = xauFixture.findIndex((bar) => bar.datetime === "2011-07-04T00:00:00");
  const generated = pens.generateAutomaticPens(xauFixture.slice(0, index + 1));
  assert.equal(generated.length, 8);
  assert.equal(generated[3].endPoint.price, 1556.32); // p0, the new trend origin
  assert.equal(generated[2].startPoint.price, 1530.64); // invalid old origin
  assert.equal(generated[2].endPoint.price, 1523.955); // p1
  assert.equal(generated[5].endPoint.price, 1513.13); // p2
  assert.equal(generated[4].endPoint.price, 1493.985); // p3
  assert.ok(generated[5].endPoint.price < generated[2].endPoint.price);
  assert.ok(generated[7].endPoint.price <= generated[2].endPoint.price);
  assert.equal(trading.getAutomaticPenTradeSide(generated), null);
  for (const start of [0, index]) {
    const tracker = trading.createAutomaticPenTradeTracker(xauFixture.slice(0, start));
    const signals = xauFixture.slice(start).map((bar) => ({ date: bar.datetime, side: tracker.advance(bar) }));
    assert.ok(!signals.some((s) => s.date >= "2011-07-04T00:00:00" && s.side));
  }
});

const pivotCandles = (prices) => {
  const result = [{ time: 1, open: prices[0], close: prices[0] }];
  for (let leg = 1; leg < prices.length; leg++) {
    for (let step = 1; step <= 4; step++) {
      const price = prices[leg - 1] + (prices[leg] - prices[leg - 1]) * step / 4;
      result.push({ time: result.length + 1, open: price, close: price });
    }
  }
  return result;
};

test("a new extreme resets the structure; enter on its sixth pen, not its fourth or fifth", () => {
  // Old origin=130, p1=100; p0=145 starts over. Its first low p3=80.
  // L1 tops at 78 < p3; a down pen confirms it; the following up pen may sell.
  for (const direction of [1, -1]) {
    const data = pivotCandles([130, 100, 145, 80, 95, 70, 78, 60, 72].map((v) => direction * v));
    const tracker = trading.createAutomaticPenTradeTracker([]);
    const signals = data.map((bar) => tracker.advance(bar));
    assert.equal(signals[24], null); // fourth pen from p0; the old rules would enter
    assert.equal(signals[28], null); // fifth pen confirms L1's final turning point
    assert.equal(signals[32], direction === 1 ? "Sell" : "Buy"); // sixth pen first forms
    assert.equal(signals.filter(Boolean).length, 1);
    // Enabling after the reset must produce the same result without future data.
    const resumed = trading.createAutomaticPenTradeTracker(data.slice(0, 25));
    assert.deepEqual(data.slice(25).map((bar) => resumed.advance(bar)), signals.slice(25));
  }
});

test("a rebound failing to end beyond p3 or a sixth pen breaking p3 still cannot enter", () => {
  for (const direction of [1, -1]) {
    for (const [fourthTop, sixthTop] of [[80, 72], [81, 72], [78, 81]]) {
      const data = pivotCandles([130, 100, 145, 80, 95, 70, fourthTop, 60, sixthTop].map((v) => direction * v));
      const tracker = trading.createAutomaticPenTradeTracker([]);
      const signals = data.map((bar) => tracker.advance(bar));
      assert.equal(signals[24], null);
      assert.equal(signals[32], null);
    }
  }
});

test("equal extrema do not restart a valid six-pen structure", () => {
  for (const direction of [1, -1]) {
    const data = pivotCandles([130, 100, 130, 80, 95, 70, 78].map((v) => direction * v));
    const tracker = trading.createAutomaticPenTradeTracker([]);
    const signals = data.map((bar) => tracker.advance(bar));
    assert.equal(signals[24], direction === 1 ? "Sell" : "Buy");
  }
});

test("the third trend pen must strictly pass the second, not merely the first, in both directions", () => {
  for (const direction of [1, -1]) {
    for (const [thirdEnd, expected] of [[70, direction === 1 ? "Sell" : "Buy"], [80, null], [90, null]]) {
      // The other entry rules hold in all cases. The first down low is 100,
      // second is 80; a third low of 90 is below the first but still invalid.
      const data = pivotCandles([130, 100, 120, 80, 95, thirdEnd, 98].map((v) => direction * v));
      const generated = pens.generateAutomaticPens(data);
      assert.equal(generated.length, 6);
      assert.equal(generated[2].endPoint.price, direction * 80);
      assert.equal(generated[4].endPoint.price, direction * thirdEnd);
      assert.equal(trading.getAutomaticPenTradeSide(generated), expected);
      const tracker = trading.createAutomaticPenTradeTracker([]);
      const signals = data.map((bar) => tracker.advance(bar));
      assert.ok(signals.slice(0, -1).every((signal) => signal === null));
      assert.equal(signals.at(-1), expected);
      assert.equal(tracker.advance(data.at(-1)), null);
    }
  }
});

test("wait for the third trend pen's final endpoint and the next reversal before entering", () => {
  for (const direction of [1, -1]) {
    const data = pivotCandles([130, 100, 120, 80, 95, 90].map((v) => direction * v));
    // Third down pen first forms at 90, then extends past 80 down to 70.
    for (const price of [85, 80, 75, 70, 80, 85, 90, 98]) {
      data.push({ time: data.length + 1, open: direction * price, close: direction * price });
    }
    const tracker = trading.createAutomaticPenTradeTracker([]);
    const signals = data.map((bar) => tracker.advance(bar));
    assert.ok(signals.slice(0, -1).every((signal) => signal === null));
    assert.equal(signals.at(-1), direction === 1 ? "Sell" : "Buy");
  }
});

test("uses exactly the two specified pivots, is symmetric, and equality is not a signal", () => {
  const data = pens.generateAutomaticPens(fixture).slice(0, 12);
  assert.equal(trading.getAutomaticPenTradeSide(data), "Buy");
  const mirror = data.map((pen) => ({ ...pen, trend: -pen.trend,
    startPoint: { ...pen.startPoint, price: -pen.startPoint.price },
    endPoint: { ...pen.endPoint, price: -pen.endPoint.price },
  }));
  assert.equal(trading.getAutomaticPenTradeSide(mirror), "Sell");
  const equal = plain(data);
  equal[9].endPoint.price = equal[6].endPoint.price;
  assert.equal(trading.getAutomaticPenTradeSide(equal), null);
  assert.equal(trading.getAutomaticPenTradeSide(data.slice(0, 5)), null);
});

test("warmup, repeated bars, extensions and re-enabling never backfill the existing signal", () => {
  const index = at("2021-08-01T20:00:00");
  const tracker = trading.createAutomaticPenTradeTracker(fixture.slice(0, index));
  assert.equal(tracker.advance(fixture[index]), "Buy");
  assert.equal(tracker.advance(fixture[index]), null);
  assert.equal(tracker.advance(fixture[index - 1]), null);
  for (const candle of fixture.slice(index + 1, at("2021-08-02T12:00:00") + 1)) {
    assert.equal(tracker.advance(candle), null);
  }
  const enabledLater = trading.createAutomaticPenTradeTracker(fixture.slice(0, index + 1));
  assert.equal(enabledLater.advance(fixture[index]), null);
  assert.equal(enabledLater.advance(fixture[index + 1]), null);
});

test("new pullback must respect the older pivot in both directions; touching it is allowed", () => {
  const index = at("2021-08-01T20:00:00");
  const original = pens.generateAutomaticPens(fixture.slice(0, index + 1));
  for (const direction of [1, -1]) {
    const data = original.map((pen) => ({ ...pen, trend: pen.trend * direction,
      startPoint: { ...pen.startPoint, price: pen.startPoint.price * direction },
      endPoint: { ...pen.endPoint, price: pen.endPoint.price * direction },
    }));
    const reference = data[data.length - 6].endPoint.price;
    const side = direction === 1 ? "Buy" : "Sell";
    data.at(-1).endPoint.price = reference + direction * 0.0001;
    assert.equal(trading.getAutomaticPenTradeSide(data), side);
    data.at(-1).endPoint.price = reference;
    assert.equal(trading.getAutomaticPenTradeSide(data), side);
    data.at(-1).endPoint.price = reference - direction * 0.0001;
    assert.equal(trading.getAutomaticPenTradeSide(data), null);
  }
});

test("broken body endpoint skips entry even if the close recovers; wicks alone do not block it", () => {
  const index = at("2021-08-01T20:00:00");
  const p1 = 1.37732;
  const warmup = fixture.slice(0, index);
  const candle = fixture[index];
  for (const direction of [1, -1]) {
    const transform = (bar) => ({ ...bar, open: direction * bar.open, close: direction * bar.close });
    for (const body of [
      { open: candle.open, close: p1 - 0.0001 },
      { open: p1 - 0.0001, close: p1 + 0.0001 },
    ]) {
      const tracker = trading.createAutomaticPenTradeTracker(warmup.map(transform));
      const broken = transform({ ...candle, ...body });
      const generated = pens.generateAutomaticPens([...warmup.map(transform), broken]);
      assert.equal(generated.length, 12); // A new pen did form; only the order is filtered.
      assert.equal(tracker.advance(broken), null);
      assert.equal(tracker.advance(broken), null);
      assert.equal(tracker.advance(transform({ ...candle, time: candle.time + 14400, open: p1 + 0.0001, close: p1 + 0.0002 })), null);
    }
  }
  const wickOnly = trading.createAutomaticPenTradeTracker(warmup);
  assert.equal(wickOnly.advance({ ...candle, low: p1 - 0.01 }), "Buy");
});

function hookHarness(initial) {
  let data = initial;
  let reads = 0;
  const listeners = new Set();
  const slots = [];
  let cursor = 0;
  let effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useRef: (value) => { const i = cursor++; return slots[i] ??= { current: value }; },
    useState: (value) => { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, (next) => { slots[i].value = next; }]; },
    useCallback: (fn, deps) => { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect: (fn, deps) => {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const { useAutomaticPenTrading: runHook } = loadModule("../../hooks/useAutomaticPenTrading.ts", {
    react, "@/components/market-master/automatic-pen-trading": trading,
  });
  const args = { canTrade: true, marketKey: "GBP/USD:H4", seriesRef: { current: {
    data: () => { reads++; return data; },
    subscribeDataChanged: (fn) => listeners.add(fn),
    unsubscribeDataChanged: (fn) => listeners.delete(fn),
  } } };
  let hook;
  const render = (changes = {}) => {
    Object.assign(args, changes); cursor = 0; effects = [];
    hook = runHook(args); effects.forEach((fn) => fn()); return hook;
  };
  render();
  return { render, listeners, get reads() { return reads; }, get hook() { return hook; },
    replace: (next) => { data = next; listeners.forEach((fn) => fn("full")); },
  };
}

test("hook gates permissions, clears on market/permission changes, and does not read history on advance", () => {
  const index = at("2021-08-01T20:00:00");
  const h = hookHarness(fixture.slice(0, index));
  h.render({ canTrade: false }); h.hook.toggleAutomaticTrading();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.hook.advanceAutomaticTrading(fixture[index]), null);
  h.render({ canTrade: true }); h.hook.toggleAutomaticTrading(); h.render();
  assert.equal(h.hook.isAutomaticTradingEnabled, true);
  const reads = h.reads;
  assert.equal(h.hook.advanceAutomaticTrading(fixture[index])?.side, "Buy");
  assert.equal(h.hook.advanceAutomaticTrading(fixture[index]), null);
  assert.equal(h.reads, reads);
  h.render({ marketKey: "EUR/USD:H4" }); h.render();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.hook.isAutomaticTradingEnabled, false);
  h.hook.toggleAutomaticTrading(); h.render({ canTrade: false });
  assert.equal(h.listeners.size, 0);
  assert.equal(h.hook.advanceAutomaticTrading(fixture[index]), null);
});

test("data reload/prepend retains the activation boundary and never triggers historical orders", () => {
  const index = at("2021-08-01T20:00:00");
  const h = hookHarness(fixture.slice(0, index));
  h.hook.toggleAutomaticTrading(fixture[0].time);
  h.replace(fixture.slice(0, index + 1));
  assert.equal(h.hook.advanceAutomaticTrading(fixture[index]), null);
  h.hook.stopAutomaticTrading();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.hook.advanceAutomaticTrading(fixture[index + 1]), null);
});

test("turning entries off keeps pivot events for protection; re-enabling never backfills", () => {
  const index = at("2021-08-01T20:00:00");
  const h = hookHarness(fixture.slice(0, index));
  h.hook.toggleAutomaticTrading(); h.render();
  h.hook.toggleAutomaticTrading(); h.render();
  assert.equal(h.hook.isAutomaticTradingEnabled, false);
  assert.equal(h.listeners.size, 1);
  const event = h.hook.advanceAutomaticTrading(fixture[index]);
  assert.ok(event.pen);
  assert.equal(event.side, null);
  h.hook.toggleAutomaticTrading(); h.render();
  assert.equal(h.hook.isAutomaticTradingEnabled, true);
  assert.equal(h.hook.advanceAutomaticTrading(fixture[index]), null);
  h.hook.stopAutomaticTrading();
  assert.equal(h.listeners.size, 0);
});

test("switching trading pen mode rebuilds the revealed context without backfilling or re-enabling entries", () => {
  const data = pivotCandles([100, 130, 110, 145, 135, 160, 140, 170]).map((bar) => ({ ...bar, high: bar.close + 100, low: bar.close - 100 }));
  const h = hookHarness(data.slice(0, 24));
  h.hook.setAutomaticTradingPenMode("strict");
  h.hook.toggleAutomaticTrading(); h.render();
  assert.equal(h.hook.advanceAutomaticTrading(data[24]), null); // Too short for strict pens and well below ATR.
  h.replace(data.slice(0, 25));
  h.hook.setAutomaticTradingPenMode("simple");
  assert.equal(h.hook.advanceAutomaticTrading(data[24]), null); // Newly selected historical signal is not entered.
  h.hook.toggleAutomaticTrading(); h.render();
  assert.equal(h.hook.isAutomaticTradingEnabled, false);
  h.hook.setAutomaticTradingPenMode("strict");
  h.hook.setAutomaticTradingPenMode("simple"); h.render();
  assert.equal(h.hook.isAutomaticTradingEnabled, false);
  const reference = trading.createAutomaticPenTradeTracker(data.slice(0, 25), "simple");
  for (const bar of data.slice(25)) {
    const event = reference.advanceEvent(bar);
    assert.deepEqual(plain(h.hook.advanceAutomaticTrading(bar)), plain(event && { ...event, side: null }));
  }
  assert.equal(h.listeners.size, 1);
});

test("strict strategy and drawing use identical warmup and cannot see prefetched future candles", () => {
  const past = Array.from({ length: 101 }, (_, i) => ({ time: i + 1, open: 100, close: 100, high: 200, low: 0 }));
  const sequence = pivotCandles([100, 130, 110, 145, 135, 160, 140, 170]).map((bar) => ({ ...bar, time: bar.time + 101, high: bar.close, low: bar.close }));
  const all = [...past, ...sequence, { time: 9999, open: 1000000, close: 1000000, high: 2000000, low: 0 }];
  let count = 106;
  const h = hookHarness(all.slice(0, count));
  h.render({ source: () => ({ candles: all, count }) });
  h.hook.setAutomaticTradingPenMode("strict");
  h.hook.toggleAutomaticTrading(sequence[0].time);
  const drawing = pens.createAutomaticPenGenerator(undefined, undefined, "strict");
  past.forEach(drawing.warmup);
  sequence.slice(0, 5).forEach(drawing.append);
  for (const bar of sequence.slice(5)) {
    count++;
    const before = drawing.totalPens;
    drawing.append(bar);
    const event = h.hook.advanceAutomaticTrading(bar);
    assert.equal(Boolean(event), drawing.totalPens > before);
    if (event) assert.deepEqual(plain(event.pen), plain(drawing.pens.at(-1)));
  }
});

test("strict warmup boundary survives prepends and is reused when restarting the same sample", () => {
  const data = pivotCandles([100, 130, 110, 145, 135, 160, 140]);
  const older = Array.from({ length: 101 }, (_, i) => ({ time: i - 101, open: 100, close: 100, high: 10000, low: -10000 }));
  const h = hookHarness(data.slice(0, 24));
  h.hook.setAutomaticTradingPenMode("strict");
  h.hook.toggleAutomaticTrading(data[0].time);
  h.replace([...older, ...data.slice(0, 24)]);
  const expected = trading.createAutomaticPenTradeTracker(data.slice(0, 24), "strict").advanceEvent(data[24]);
  assert.equal(expected.side, "Buy");
  assert.deepEqual(plain(h.hook.advanceAutomaticTrading(data[24])), plain(expected));
  h.hook.stopAutomaticTrading();
  h.hook.toggleAutomaticTrading(data[0].time, data[0].time);
  assert.deepEqual(plain(h.hook.advanceAutomaticTrading(data[24])), plain(expected));
});

// Exercise the actual page handlers with a small chart/account harness. This
// catches stale entry prices, wrong persistence indexes and same-bar SL/TP hits.
const pageSource = fs.readFileSync(new URL("./MarketMasterPage.tsx", import.meta.url), "utf8");
const pageAst = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function pageHandler(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(pageAst) === name) {
      found = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(pageAst);
  assert.ok(found, `missing page handler ${name}`);
  return found.getText(pageAst);
}

function pageHarness(data, index, initialTrades = [], penMode = "simple") {
  const events = [];
  const tracker = trading.createAutomaticPenTradeTracker(data.slice(0, index), penMode);
  let nextId = 0;
  const context = {
    ...chartWindow, ...bookModule,
    chartWindowRef: { current: { from: 0, to: data.length } }, indicatorOffsetRef: { current: 0 }, fullEmaDataRef: { current: {} },
    KLINE_FORWARD_PREFETCH_BARS: 400,
    currentIndexRef: { current: index }, isDataLoadingRef: { current: false },
    fullDataRef: { current: data }, loadedOffsetRef: { current: 5000 }, totalCandlesRef: { current: 0 },
    replayEndCurrentIndexRef: { current: 0 }, isReplayModeRef: { current: false }, isBacktestModeRef: { current: true },
    seriesRef: { current: { update: () => {} } }, volumeSeriesRef: { current: null },
    updateAutomaticPensAfterCandle() {}, updateAutomaticSegmentsAfterCandle() {}, toVolumePoint() {},
    indConfig: { emas: [], bollinger: { enabled: false }, macd: { enabled: false }, volume: {} },
    fullMacdDataRef: { current: [] }, subChartRef: { current: null },
    advanceAutomaticTrading: tracker.advanceEvent, placeOrderRef: { current: null },
    ...risk, priceDecimals: 5,
    automaticRunRef: { current: null }, automaticTradingConfigRef: { current: { ...configModule.DEFAULT_AUTOMATIC_TRADING_CONFIG, penMode, firstOrderUnits: 1234 } },
    restartingBacktestRef: { current: false }, backtestSampleRef: { current: null }, chartPanGuardRef: { current: null },
    balanceRef: { current: 10000 }, setBalance() {},
    performance, AbortController,
    isAutomaticTradingEnabled: true, automaticAccessRef: { current: true },
    historyLoadingRef: { current: false }, dataSessionRef: { current: 1 },
    setAutomaticRun() {}, setTrades() {}, recomputeIndicators() {}, syncDisplayedData() {},
    runAutomaticTradingBatch: (options) => runner.runAutomaticTradingBatch({ ...options, now: () => performance.now(), yieldToBrowser: async () => {} }),
    setCurrentIndex() {}, setIsPlaying() {}, closeTradeRecord: management.closeTradeRecord, closeTradeUnits: management.closeTradeUnits, withSettlementBalances: management.withSettlementBalances,
    isBacktestMode: true, currentPrice: data[index - 1]?.close,
    orderUnits: 1234, slEnabled: true, slDistance: 0.0001, tpEnabled: true, tpDistance: 0.0002,
    crypto: { randomUUID: () => `automatic-order-${++nextId}` },
    tradesRef: { current: initialTrades },
    syncTradeMarkers() {}, getActiveCandle: (data, count) => data[count - 1],
    pendingSessionStartRef: { current: { marker: "pending" } },
    persistRef: { current: { beginBatch() {}, endBatch: async () => {}, startSession: () => events.push("session"), recordOpen: (order) => events.push(plain(order)), recordModify: (order) => events.push(plain(order)), recordClose: (order) => events.push(plain(order)) } },
    toPersistSide: (side) => side === "Buy" ? "buy" : "sell",
    toast: { error: (message) => assert.fail(message) },
  };
  context.commitTrades = (next) => { context.tradesRef.current = next; };
  context.settleClosedTrades = (next) => { events.push("settle"); context.commitTrades(next); };
  vm.createContext(context);
  vm.runInContext(transpile(`globalThis.placeOrder = ${pageHandler("handlePlaceOrder")}; globalThis.step = ${pageHandler("handleNextCandle")}; globalThis.settleReal = ${pageHandler("settleClosedTrades")}; globalThis.commitReal = ${pageHandler("commitTrades")}; globalThis.runBulk = ${pageHandler("handleRunAutomaticTrading")};`), context);
  context.placeOrderRef.current = context.placeOrder;
  context.commitTrades = context.commitReal;
  context.handleNextCandle = context.step;
  return { context, events };
}

test("page settlement snapshots follow execution order even when same-bar fills offset to zero", () => {
  const { context, events } = pageHarness(fixture, 1);
  const a = { id: "a:close:1", parentTradeId: "a", status: "Closed", closeTime: 1, closePrice: 110, units: 10, pnl: 100 };
  const b = { id: "b", status: "Closed", closeTime: 1, closePrice: 90, units: 10, pnl: -100 };
  const open = { id: "a", status: "Open", units: 10, pnl: 0 };
  context.settleReal([b, open, a], [a, b], 0, 0);
  assert.equal(context.balanceRef.current, 10000);
  assert.equal(context.tradesRef.current.find((t) => t.id === a.id).balanceAfter, 10100);
  assert.equal(context.tradesRef.current.find((t) => t.id === b.id).balanceAfter, 10000);
  assert.equal(context.tradesRef.current.find((t) => t.id === "a").balanceAfter, undefined);
  assert.equal(a.balanceAfter, undefined);
  assert.deepEqual(events.map((event) => event.client_event_id), ["close:a:close:1", "close:b"]);
  const oldFill = context.tradesRef.current.find((t) => t.id === a.id);
  const later = { ...open, status: "Closed", closeTime: 2, closePrice: 120, pnl: 200 };
  context.settleReal([later, ...context.tradesRef.current.filter((t) => t.id !== "a")], [later], 200, 1);
  assert.equal(context.balanceRef.current, 10200);
  assert.equal(context.tradesRef.current[0].balanceAfter, 10200);
  assert.equal(oldFill.balanceAfter, 10100);
});

test("page settles old trades first, enters at the signal close with structural risk, and preserves manual parameters", () => {
  const index = at("2021-08-01T20:00:00");
  const candle = fixture[index];
  const { context, events } = pageHarness(fixture, index, [{ id: "old", type: "Buy", entry: 1.4, units: 10, status: "Open", sl: candle.close, tp: null }]);
  const event = trading.createAutomaticPenTradeTracker(fixture.slice(0, index)).advanceEvent(candle);
  const expected = risk.planAutomaticPenOrder(event, candle.close, 1234, [], 5);
  context.step();
  const order = context.tradesRef.current[0];
  assert.equal(order.type, "Buy");
  assert.equal(order.entry, candle.close);
  assert.equal(order.entryTime, candle.time);
  assert.equal(order.units, 1234);
  assert.equal(order.sl, expected.sl);
  assert.equal(order.tp, expected.tp);
  assert.equal(order.automaticPen.initialStop, expected.sl);
  assert.equal(order.status, "Open");
  assert.equal(context.tradesRef.current[1].status, "Closed");
  assert.equal(context.currentIndexRef.current, index + 1);
  assert.deepEqual(events.slice(0, 2), ["settle", "session"]);
  assert.equal(events[2].bar_index, 5000 + index);
  assert.equal(events[2].bar_time, candle.time);
  context.orderUnits = 4321; context.slEnabled = false; context.tpEnabled = false;
  context.placeOrder("Sell", fixture[index + 1], index + 1);
  assert.equal(context.tradesRef.current[0].units, 4321);
  assert.equal(context.tradesRef.current[0].sl, null);
  assert.equal(context.tradesRef.current[0].tp, null);
  assert.equal(context.tradesRef.current[0].automaticPen, undefined);
});

test("XAU example enters beyond p0, trails beyond p1 only when L2 forms, and persists that bar", () => {
  const data = JSON.parse(fs.readFileSync(new URL("./fixtures/xau-usd-h4-201601.json", import.meta.url), "utf8")).candles;
  const index = data.findIndex((c) => c.datetime === "2016-01-15T12:00:00");
  const trailIndex = data.findIndex((c) => c.datetime === "2016-01-18T20:00:00");
  const { context, events } = pageHarness(data, index);
  context.automaticTradingConfigRef.current.shortExitEnabled = false;
  context.priceDecimals = 2;
  context.step();
  const initial = context.tradesRef.current[0];
  assert.equal(initial.type, "Sell");
  assert.ok(initial.sl > 1109.87);
  assert.equal(initial.entry, data[index].close);
  while (context.currentIndexRef.current < trailIndex) context.step();
  assert.equal(context.tradesRef.current[0].sl, initial.sl);
  context.step();
  const updated = context.tradesRef.current[0];
  assert.ok(updated.sl > 1091.89 && updated.sl < initial.sl);
  assert.equal(updated.status, "Open");
  const modify = events.find((e) => e.kind === "sl");
  assert.equal(modify.bar_time, data[trailIndex].time);
  assert.equal(modify.bar_index, 5000 + trailIndex);
  assert.equal(modify.price, updated.sl);
  while (context.tradesRef.current.find((t) => t.id === initial.id).status === "Open" && context.currentIndexRef.current < data.length) context.step();
  const closed = context.tradesRef.current.find((t) => t.id === initial.id);
  assert.equal(closed.reason, "SL Hit");
  assert.equal(closed.closePrice, updated.sl);
  const saved = events.filter((e) => e.client_trade_id === initial.id).map((e, i) => ({ ...e,
    side: e.side?.toUpperCase(), event_type: e.kind === "sl" ? "MODIFY_SL" : "OPEN", sequence_no: i + 1,
  }));
  const beforeExit = replay.applyReplayTradeEvents([], saved);
  assert.equal(beforeExit.trades[0].sl, updated.sl);
  saved.push({ sequence_no: saved.length + 1, event_type: "CLOSE", client_trade_id: initial.id,
    price: closed.closePrice, units: closed.units, bar_time: closed.closeTime, close_reason: "SL_HIT" });
  const restored = replay.applyReplayTradeEvents([], saved);
  assert.equal(restored.trades[0].pnl, closed.pnl);
  assert.equal(restored.balanceChange, closed.pnl);
});

test("page persists entry without SL, then applies and replays the original trailing stop", () => {
  const data = JSON.parse(fs.readFileSync(new URL("./fixtures/xau-usd-h4-201601.json", import.meta.url), "utf8")).candles;
  const index = data.findIndex((c) => c.datetime === "2016-01-15T12:00:00");
  const trailIndex = data.findIndex((c) => c.datetime === "2016-01-18T20:00:00");
  const { context, events } = pageHarness(data, index);
  Object.assign(context.automaticTradingConfigRef.current, { initialStopEnabled: false, shortExitEnabled: false });
  context.priceDecimals = 2;
  context.step();
  const initial = context.tradesRef.current[0];
  assert.equal(initial.sl, null);
  assert.ok(initial.automaticPen.initialStop > 1109.87);
  const opened = events.find((e) => e.client_trade_id === initial.id);
  assert.equal(opened.sl_price, null);
  const savedOpen = { ...opened, side: "SELL", event_type: "OPEN", sequence_no: 1 };
  assert.equal(replay.applyReplayTradeEvents([], [savedOpen]).trades[0].sl, null);
  // Updating the preference must not install an entry stop on an existing order.
  context.automaticTradingConfigRef.current.initialStopEnabled = true;
  while (context.currentIndexRef.current < trailIndex) context.step();
  assert.equal(context.tradesRef.current[0].sl, null);
  context.step();
  const updated = context.tradesRef.current[0];
  assert.ok(updated.sl > 1091.89 && updated.sl < initial.automaticPen.initialStop);
  assert.equal(updated.tp, initial.tp);
  const modify = events.find((e) => e.kind === "sl");
  assert.equal(modify.bar_time, data[trailIndex].time);
  assert.equal(modify.price, updated.sl);
  const restored = replay.applyReplayTradeEvents([], [savedOpen, { ...modify, event_type: "MODIFY_SL", sequence_no: 2 }]);
  assert.equal(restored.trades[0].sl, updated.sl);
});

test("funded sizing is persisted, funding consumed once, and a blocked add does not mutate positions", () => {
  const candle = { time: 30, open: 118, high: 120, low: 117, close: 119 };
  const sponsor = { id: "sponsor", type: "Buy", entry: 90, entryTime: 1, units: 100, sl: 100, tp: 300, status: "Open", pnl: 0, automaticPen: { initialStop: 80, initialRisk: 10 } };
  const event = { side: "Buy", atr: 0, trendOrigin: { price: 109, time: 5 }, pen: { trend: -1, startPoint: { price: 125, time: 20 }, endPoint: { price: 119, time: 30 } } };
  const { context, events } = pageHarness([candle], 0, [sponsor]);
  context.orderUnits = NaN; // add-ons ignore terminal units
  context.placeOrder("Buy", candle, 0, event);
  const child = context.tradesRef.current[0];
  assert.equal(child.units, 49);
  assert.equal(child.automaticPen.riskBudget, 500);
  assert.ok(child.units * child.automaticPen.initialRisk <= 500);
  assert.equal(context.tradesRef.current[1].automaticPen.fundedChildId, child.id);
  assert.equal(events.at(-1).units, child.units);
  const snapshot = plain(context.tradesRef.current);
  context.placeOrder("Buy", candle, 0, event);
  assert.deepEqual(plain(context.tradesRef.current), snapshot);
  context.tradesRef.current[0] = { ...child, status: "Closed" };
  context.placeOrder("Buy", candle, 0, event);
  assert.equal(context.tradesRef.current.length, 2); // spent sponsor cannot be reused
});

test("a stop tightened at candle close cannot retroactively close on that candle's wick", () => {
  const data = [{ time: 30, open: 112, high: 120, low: 103, close: 115 }, { time: 31, open: 115, high: 116, low: 103, close: 106 }];
  const trade = { id: "long", type: "Buy", entry: 100, entryTime: 1, units: 100, sl: 90, tp: 200, status: "Open", pnl: 0, automaticPen: { initialStop: 90, initialRisk: 10 } };
  const { context } = pageHarness(data, 0, [trade]);
  context.advanceAutomaticTrading = (c) => c.time === 30 ? { side: null, atr: 2, pen: { trend: 1, startPoint: { time: 20, price: 110 } } } : null;
  context.step();
  assert.equal(context.tradesRef.current[0].status, "Open");
  assert.equal(context.tradesRef.current[0].sl, 109.6);
  context.step();
  assert.equal(context.tradesRef.current[0].status, "Closed");
  assert.equal(context.tradesRef.current[0].closePrice, 109.6);
});

function breakoutFailureCandles(direction = 1, endpoint = 125, wickOnly = false) {
  const bars = pivotCandles([100, 130, 110, 150, 135, 160, 140]);
  for (const price of [endpoint, 133, 137, 141, 145]) bars.push({ time: bars.length + 1, open: price, close: price });
  return bars.map((c, i) => {
    const low = wickOnly && i === 25 ? 125 : c.close;
    return direction === 1 ? { ...c, high: c.close, low } : { ...c, open: 300 - c.open, close: 300 - c.close, high: 300 - low, low: 300 - c.close };
  });
}

test("a failed sixth-pen breakout exits at the seventh pen's formation close, even after recovery, on both sides", () => {
  for (const direction of [1, -1]) {
    const data = breakoutFailureCandles(direction);
    const { context, events } = pageHarness(data, 24);
    context.step();
    const initial = context.tradesRef.current[0];
    assert.equal(initial.type, direction === 1 ? "Buy" : "Sell");
    assert.equal(initial.automaticPen.breakoutPrice, direction === 1 ? 130 : 170);
    assert.equal(initial.automaticPen.entryPenStartTime, 21);
    // Partial close bookkeeping keeps the setup with the remaining position.
    context.tradesRef.current[0] = { ...initial, units: 20 };
    context.settleClosedTrades = context.settleReal;
    while (context.currentIndexRef.current < 29) {
      context.step();
      assert.equal(context.tradesRef.current[0].status, "Open");
      assert.equal(context.tradesRef.current[0].sl, initial.sl);
    }
    context.step();
    const closed = context.tradesRef.current[0];
    assert.equal(closed.status, "Closed");
    assert.equal(closed.reason, "分笔突破失效");
    assert.equal(closed.closePrice, data[29].close);
    assert.equal(closed.closeTime, data[29].time);
    assert.equal(closed.units, 20);
    assert.equal(closed.pnl, 100);
    assert.equal(context.balanceRef.current, 10100);
    const record = events.find((e) => e.close_reason);
    assert.equal(record.bar_index, 5029);
    assert.equal(record.bar_time, data[29].time);
    assert.equal(record.units, 20);
    assert.equal(record.price, data[29].close);
    assert.equal(events.filter((e) => e.kind === "sl").length, 0); // exit before trailing
    const persistedReason = persistence.toPersistCloseReason(record.close_reason);
    assert.equal(persistedReason, "PEN_BREAKOUT_FAILED");
    const restored = replay.applyReplayTradeEvents([{ ...initial, units: 20 }], [{ ...record, sequence_no: 1, event_type: "CLOSE", close_reason: persistedReason }]);
    assert.equal(restored.trades[0].reason, closed.reason);
    assert.equal(restored.balanceChange, closed.pnl);
    context.step(); // no duplicate settlement at the end of the data
    assert.equal(events.filter((e) => e.close_reason).length, 1);
  }
});

test("touching the level or piercing it only with a wick does not trigger the failure exit", () => {
  for (const direction of [1, -1]) {
    for (const [endpoint, wickOnly] of [[130, false], [130, true], [132, false]]) {
      const data = breakoutFailureCandles(direction, endpoint, wickOnly);
      const { context } = pageHarness(data, 24);
      while (context.currentIndexRef.current < data.length) context.step();
      assert.equal(context.tradesRef.current[0].status, "Open");
    }
  }
});

test("viewport replacements preserve live signal and ATR state, including activation from a historical window", () => {
  const index = at("2021-08-01T20:00:00");
  const viewportSyncRef = { current: false };
  const h = hookHarness(fixture.slice(0, 20));
  h.render({ viewportSyncRef, source: () => ({ candles: fixture, count: index }) });
  h.hook.toggleAutomaticTrading(fixture[0].time);
  const reference = trading.createAutomaticPenTradeTracker(fixture.slice(0, index));
  const reads = h.reads;
  for (let i = index; i < fixture.length; i++) {
    viewportSyncRef.current = true;
    h.replace(fixture.slice(5, 10));
    viewportSyncRef.current = false;
    assert.deepEqual(plain(h.hook.advanceAutomaticTrading(fixture[i])), plain(reference.advanceEvent(fixture[i])));
  }
  assert.equal(h.reads, reads);
});

test("both sides reduce half only at their seventh pen, persist and replay the fill, then manage the remainder", () => {
  for (const direction of [1, -1]) {
    const data = breakoutFailureCandles(direction, 130);
    // Continue the seventh pen, then confirm an eighth and ninth without hitting the stop.
    for (const price of [150, 155, 160, 165, 161, 157, 153, 149, 153, 157, 161, 165]) {
      const value = direction === 1 ? price : 300 - price;
      data.push({ time: data.length + 1, open: value, close: value, high: value, low: value });
    }
    const { context, events } = pageHarness(data, 24);
    context.settleClosedTrades = context.settleReal;
    context.step();
    const initial = context.tradesRef.current[0];
    assert.equal(initial.automaticPen.shortExitPercent, 50);
    // Changes to global settings and disabling new entries do not change this order's exits.
    context.automaticTradingConfigRef.current.shortExitEnabled = false;
    context.automaticTradingConfigRef.current.shortExitPercent = 25;
    const advance = context.advanceAutomaticTrading;
    context.advanceAutomaticTrading = (bar) => { const event = advance(bar); return event && { ...event, side: null }; };
    while (context.currentIndexRef.current < 29) context.step();
    assert.equal(events.filter((e) => e.close_reason).length, 0);
    context.step();
    const remaining = context.tradesRef.current.find((t) => t.status === "Open");
    const fill = context.tradesRef.current.find((t) => t.status === "Closed");
    assert.equal(remaining.id, initial.id);
    assert.equal(remaining.units, 617);
    assert.equal(remaining.tp, initial.tp);
    assert.equal(remaining.automaticPen.shortExitDone, true);
    assert.ok(direction * (remaining.sl - initial.sl) > 0);
    assert.equal(fill.reason, "分笔短线减仓");
    assert.equal(fill.units, 617);
    assert.equal(fill.closePrice, data[29].close);
    assert.equal(fill.closeTime, data[29].time);
    assert.equal(fill.parentTradeId, initial.id);
    assert.equal(fill.pnl, 3085);
    assert.equal(context.balanceRef.current, 13085);
    const record = events.find((e) => e.close_reason);
    assert.equal(record.client_trade_id, initial.id);
    assert.equal(record.client_event_id, `close:${fill.id}`);
    assert.equal(record.bar_index, 5029);
    assert.equal(record.units, 617);
    const saved = events.filter((e) => e.client_trade_id).map((e, i) => ({ ...e, sequence_no: i + 1,
      event_type: e.close_reason ? "CLOSE" : e.kind === "sl" ? "MODIFY_SL" : "OPEN",
      side: e.side?.toUpperCase(), close_reason: persistence.toPersistCloseReason(e.close_reason),
    }));
    assert.equal(saved.find((e) => e.event_type === "CLOSE").close_reason, "PEN_SHORT_EXIT");
    const restored = replay.applyReplayTradeEvents([], saved);
    assert.equal(restored.balanceChange, 3085);
    assert.equal(restored.trades.find((t) => t.status === "Open").units, 617);
    assert.equal(restored.trades.find((t) => t.status === "Open").sl, remaining.sl);
    assert.equal(restored.trades.find((t) => t.status === "Closed").reason, fill.reason);
    while (context.currentIndexRef.current < data.length) context.step();
    assert.equal(events.filter((e) => e.close_reason).length, 1);
    // The rest can still exit at its newly tightened stop, with no duplicate units or P&L.
    const survivor = context.tradesRef.current.find((t) => t.status === "Open");
    data.push({ time: data.length + 1, open: survivor.sl, close: survivor.sl, high: survivor.sl, low: survivor.sl });
    context.step();
    assert.equal(context.tradesRef.current.filter((t) => t.status === "Open").length, 0);
    assert.equal(context.tradesRef.current.reduce((sum, t) => sum + t.units, 0), initial.units);
    const last = events.filter((e) => e.close_reason).at(-1);
    assert.equal(last.close_reason, "SL Hit");
    assert.equal(last.units, 617);
    assert.equal(context.balanceRef.current, 10000 + context.tradesRef.current.reduce((sum, t) => sum + t.pnl, 0));
  }
});

test("short exit settings handle disabled, custom, full, odd and manually reduced quantities", () => {
  for (const [enabled, percent, units, reducedUnits, expected] of [
    [false, 50, 100, null, 0], [true, 25, 100, null, 25], [true, 100, 100, null, 100],
    [true, 50, 101, null, 50], [true, 50, 1, null, 0], [true, 50, 100, 30, 15],
  ]) {
    const data = breakoutFailureCandles(1, 130);
    const { context, events } = pageHarness(data, 24);
    context.settleClosedTrades = context.settleReal;
    Object.assign(context.automaticTradingConfigRef.current, { shortExitEnabled: enabled, shortExitPercent: percent, firstOrderUnits: units });
    context.step();
    if (reducedUnits !== null) context.tradesRef.current[0] = { ...context.tradesRef.current[0], units: reducedUnits };
    while (context.currentIndexRef.current < data.length) context.step();
    const fills = events.filter((e) => e.close_reason);
    assert.equal(fills.length, expected ? 1 : 0);
    if (expected) assert.equal(fills[0].units, expected);
    const remaining = context.tradesRef.current.find((t) => t.status === "Open");
    assert.equal(remaining?.units ?? 0, (reducedUnits ?? units) - expected);
    if (!enabled) assert.equal(remaining.automaticPen.shortExitPercent, 0);
  }
});

test("SL/TP on the seventh formation candle take precedence over short exits", () => {
  for (const kind of ["SL", "TP"]) {
    const data = breakoutFailureCandles(1, 130);
    const { context, events } = pageHarness(data, 24);
    context.settleClosedTrades = context.settleReal;
    while (context.currentIndexRef.current < 29) context.step();
    const trade = context.tradesRef.current[0];
    data[29] = { ...data[29], low: kind === "SL" ? trade.sl : 145, high: kind === "TP" ? trade.tp : 145 };
    context.step();
    assert.equal(context.tradesRef.current[0].reason, `${kind} Hit`);
    assert.equal(context.tradesRef.current[0].units, 1234);
    assert.equal(events.filter((e) => e.close_reason).length, 1);
  }
});

test("the failure exit remains enabled when new entries are off, and SL/TP always settle first", () => {
  for (const mode of ["entries-off", "SL", "TP"]) {
    const data = breakoutFailureCandles();
    const { context, events } = pageHarness(data, 24);
    context.step();
    if (mode === "entries-off") {
      const advance = context.advanceAutomaticTrading;
      context.advanceAutomaticTrading = (c) => { const event = advance(c); return event && { ...event, side: null }; };
    } else {
      context.tradesRef.current[0] = { ...context.tradesRef.current[0], ...(mode === "SL" ? { sl: 138 } : { tp: 142 }) };
    }
    context.settleClosedTrades = context.settleReal;
    while (context.currentIndexRef.current < data.length) context.step();
    assert.equal(context.tradesRef.current[0].reason, mode === "entries-off" ? "分笔突破失效" : `${mode} Hit`);
    assert.equal(events.filter((e) => e.close_reason).length, 1);
  }
});

test("auto-trading switch is visible only to superusers in interactive backtest", () => {
  let user = { is_superuser: true };
  const Empty = () => null;
  const { TopBar } = loadModule("./TopBar.tsx", {
    react: { ...React, default: React }, "react-dom": { createPortal: Empty }, "next/link": { default: Empty },
    "next/navigation": { usePathname: () => "/market-master", useRouter: () => ({}) },
    "@/context/AuthContext": { useAuth: () => ({ user, isLoading: false }) },
    "@/components/common/UserHeaderActions": { default: Empty },
    "@/components/market-master/SymbolSearchSelect": { SymbolFavoriteButton: Empty, SymbolSearchSelect: Empty },
    "lucide-react": new Proxy({}, { get: () => Empty }),
  });
  const props = { isBacktestMode: true, totalCandles: 10000, currentIndex: 200, timeframeOptions: [], balance: 10000, totalFloatingPnl: 0 };
  const html = (extra = {}) => renderToStaticMarkup(React.createElement(TopBar, { ...props, ...extra }));
  const restartProps = { onRestartBacktest() {}, canRestartBacktest: true };
  assert.equal((html(restartProps).match(/aria-label="从头再跑"/g) || []).length, 2);
  assert.match(html({ ...restartProps, isAutomaticRunBusy: true }), /disabled="" aria-label="从头再跑"/);
  assert.match(html({ ...restartProps, isRestartingBacktest: true }), /disabled="" aria-label="从头再跑"/);
  assert.doesNotMatch(html({ ...restartProps, isReplayMode: true }), /aria-label="从头再跑"/);
  assert.match(html(), /aria-label="自动做单" aria-haspopup="dialog" aria-pressed="false"/);
  assert.match(html({ isAutomaticTradingEnabled: true }), /aria-label="自动做单" aria-haspopup="dialog" aria-pressed="true"/);
  assert.doesNotMatch(html({ isReplayMode: true }), /自动做单/);
  assert.doesNotMatch(html({ isBacktestMode: false }), /自动做单/);
  const penProps = { penMode: "strict", onPenModeChange() {} };
  assert.equal((html(penProps).match(/aria-label="分笔算法"/g) || []).length, 2);
  assert.match(html(penProps), /value="strict" selected=""/);
  assert.match(html({ ...penProps, penModeLocked: true }), /aria-label="分笔算法" disabled=""/);
  user = { is_superuser: false };
  assert.doesNotMatch(html(), /自动做单/);
  assert.doesNotMatch(html(restartProps), /aria-label="从头再跑"/);
  assert.doesNotMatch(html(penProps), /aria-label="分笔算法"/);
});

function installRestartHarness(context, sample) {
  const completed = [], starts = [], messages = [];
  Object.assign(context, {
    INITIAL_BACKTEST_BALANCE: 10000,
    backtestSampleRef: { current: sample },
    backtestCompletionRequestedRef: { current: false }, wasBacktestModeRef: { current: true },
    clientSessionIdRef: { current: "original-session" }, stateRef: { current: { lastHoveredTime: 123 } },
    setIsRestartingBacktest() {}, setManagedTradeId() {}, clearClosedTradeMarkers() {},
    disableAutomaticDrawings() {}, resetSupportResistance() {},
    stopAutomaticTrading: () => { context.isAutomaticTradingEnabled = false; context.advanceAutomaticTrading = () => null; },
    toggleAutomaticTrading: (startTime) => {
      const warmup = context.fullDataRef.current.slice(0, context.currentIndexRef.current).filter((bar) => startTime == null || bar.time >= startTime);
      context.advanceAutomaticTrading = trading.createAutomaticPenTradeTracker(warmup, context.automaticTradingConfigRef.current.penMode).advanceEvent;
      context.isAutomaticTradingEnabled = true;
    },
    toast: { success: (message) => messages.push(message), error: (message) => messages.push(message) },
  });
  context.persistRef.current.completeSession = (payload) => completed.push(plain(payload));
  context.persistRef.current.startSession = (payload) => starts.push(plain(payload));
  context.settleClosedTrades = context.settleReal;
  vm.runInContext(transpile(`globalThis.forceCloseAllOpenTrades = ${pageHandler("forceCloseAllOpenTrades")}; globalThis.requestBacktestCompletion = ${pageHandler("requestBacktestCompletion")}; globalThis.resetBacktestAccount = ${pageHandler("resetBacktestAccount")}; globalThis.restart = ${pageHandler("handleRestartBacktest")};`), context);
  return { completed, starts, messages };
}

test("restart reuses candles and strategy warmup, saves a separate run, survives prepends and keeps a fixed end", async () => {
  const data = Array.from({ length: 10000 }, (_, i) => ({ ...fixture[i % fixture.length], time: fixture[i % fixture.length].time + Math.floor(i / fixture.length) * 10000000 }));
  const { context, events } = pageHarness(data, 1);
  context.totalCandlesRef.current = 5000 + data.length;
  context.settleClosedTrades = context.settleReal;
  const sample = { start: { symbol: "GBP/USD", timeframe: "H4", interval: "4h", start_bar_time: data[0].time, initial_balance: 10000 },
    endIndex: 5000 + data.length, automatic: { cursorTime: data[0].time, contextTime: data[0].time } };
  const { completed, starts } = installRestartHarness(context, sample);
  await context.runBulk(Infinity);
  const clean = (trades) => JSON.parse(JSON.stringify(trades, (key, value) => ["id", "parentTradeId", "fundedBy", "fundedChildId"].includes(key) ? undefined : value));
  const first = clean(context.tradesRef.current), firstBalance = context.balanceRef.current;
  const settledBalance = firstBalance + context.tradesRef.current.filter((trade) => trade.status === "Open")
    .reduce((sum, trade) => sum + management.closeTradeRecord(trade, data.at(-1).close, "Forced Market Close", data.at(-1).time).pnl, 0);
  assert.ok(first.length > 10);
  const preceding = Array.from({ length: 10 }, (_, i) => ({ ...data[0], time: data[0].time - (10 - i) * 300 }));
  context.fullDataRef.current = [...preceding, ...data];
  context.loadedOffsetRef.current -= preceding.length;
  context.currentIndexRef.current += preceding.length;
  context.totalCandlesRef.current += 500; // Server metadata grew; comparisons must not use newer bars.
  const source = context.fullDataRef.current;
  await context.restart();
  assert.equal(context.fullDataRef.current, source);
  assert.equal(context.currentIndexRef.current, 11);
  assert.equal(context.balanceRef.current, 10000);
  assert.equal(context.tradesRef.current.length, 0);
  assert.equal(context.isAutomaticTradingEnabled, true);
  assert.equal(context.restartingBacktestRef.current, false);
  assert.equal(completed[0].ending_balance, settledBalance);
  assert.equal(completed[0].cursor_bar_index, sample.endIndex - 1);
  assert.equal(context.pendingSessionStartRef.current.start_bar_index, 5000);
  const secondSession = context.clientSessionIdRef.current;
  assert.notEqual(secondSession, "original-session");
  await context.runBulk(Infinity);
  assert.deepEqual(clean(context.tradesRef.current), first);
  assert.equal(context.balanceRef.current, firstBalance);
  assert.equal(context.loadedOffsetRef.current + context.currentIndexRef.current, sample.endIndex);
  assert.equal(starts.at(-1).client_session_id, secondSession);
  context.step();
  assert.equal(context.loadedOffsetRef.current + context.currentIndexRef.current, sample.endIndex);
  await context.restart();
  assert.equal(completed.length, 2);
  assert.notEqual(context.clientSessionIdRef.current, secondSession);
  context.automaticTradingConfigRef.current.firstOrderUnits = 2468;
  events.length = 0;
  await context.runBulk(Infinity);
  assert.equal(events.find((event) => event.side)?.units, 2468);
  assert.notDeepEqual(clean(context.tradesRef.current), first);
  assert.equal(context.fullDataRef.current, source);
});

test("both pen modes produce identical manual, bulk and same-sample rerun results", async () => {
  const data = Array.from({ length: 2000 }, (_, i) => ({ ...fixture[i % fixture.length], time: fixture[i % fixture.length].time + Math.floor(i / fixture.length) * 10000000 }));
  const clean = (trades) => JSON.parse(JSON.stringify(trades, (key, value) => ["id", "parentTradeId", "fundedBy", "fundedChildId"].includes(key) ? undefined : value));
  const results = [];
  for (const penMode of ["simple", "strict"]) {
    const { context } = pageHarness(data, 1, [], penMode);
    context.totalCandlesRef.current = 5000 + data.length;
    installRestartHarness(context, { start: { start_bar_time: data[0].time, initial_balance: 10000 },
      endIndex: 5000 + data.length, automatic: { cursorTime: data[0].time, contextTime: data[0].time } });
    while (context.currentIndexRef.current < data.length) context.step();
    const expected = clean(context.tradesRef.current), balance = context.balanceRef.current;
    assert.ok(expected.length > 0);
    results.push(expected);
    await context.restart();
    let report;
    context.setAutomaticRun = (value) => { report = value; };
    await context.runBulk(Infinity);
    assert.deepEqual(clean(context.tradesRef.current), expected);
    assert.equal(context.balanceRef.current, balance);
    assert.equal(report.penMode, penMode);
  }
  assert.notDeepEqual(results[0], results[1]);
});

test("toolbar and strategy config cannot mix pen modes into a run with trades", () => {
  const { context } = pageHarness(fixture, 1, [{ status: "Closed", id: "existing" }]);
  const messages = [], saved = [];
  Object.assign(context, {
    canUseAutomaticDraw: true, canUseAutomaticTrading: true, isDataLoading: false, isHistoryLoading: false,
    toast: { error: (message) => messages.push(message) }, localStorage: { setItem() {} },
    AUTOMATIC_TRADING_STORAGE_KEY: "test", setAutomaticTradingConfig: (config) => saved.push(config),
    setAutomaticTradingPenMode() {}, setIsAutomaticConfigOpen() {},
  });
  vm.runInContext(transpile(`globalThis.changeMode = ${pageHandler("handlePenModeChange")}; globalThis.applyConfig = ${pageHandler("applyAutomaticTradingConfig")};`), context);
  context.changeMode("strict");
  context.applyConfig({ ...context.automaticTradingConfigRef.current, penMode: "strict" });
  assert.equal(saved.length, 0);
  assert.equal(messages.length, 2);
  context.tradesRef.current = [];
  context.changeMode("strict");
  assert.equal(saved.at(-1).penMode, "strict");
  context.applyConfig({ ...context.automaticTradingConfigRef.current, penMode: "simple" });
  assert.equal(saved.at(-1).penMode, "simple");
});

test("restart settles open positions at the revealed candle before saving and retains settlement on failure", async () => {
  const data = [100, 110, 999].map((price, i) => ({ time: i + 1, open: price, close: price, high: price, low: price }));
  const { context, events } = pageHarness(data, 2, [
    { id: "long", status: "Open", type: "Buy", units: 10, entry: 100, entryTime: 1 },
    { id: "short", status: "Open", type: "Sell", units: 5, entry: 100, entryTime: 1 },
  ]);
  const sample = { start: { start_bar_time: 1, initial_balance: 10000 }, endIndex: 5003 };
  const { completed } = installRestartHarness(context, sample);
  const complete = context.persistRef.current.completeSession;
  context.persistRef.current.completeSession = (payload) => {
    assert.equal(events.filter((event) => event.close_reason).length, 2);
    assert.ok(context.tradesRef.current.every((trade) => trade.status === "Closed"));
    complete(payload);
  };
  context.persistRef.current.endBatch = async () => { throw Error("offline"); };
  await context.restart();
  assert.equal(completed[0].ending_balance, 10050);
  assert.equal(completed[0].mark_price, 110);
  assert.equal(context.balanceRef.current, 10050);
  assert.equal(context.currentIndexRef.current, 2);
  assert.equal(context.tradesRef.current.length, 2);
  for (const event of events.filter((event) => event.close_reason)) {
    assert.equal(event.price, 110);
    assert.equal(event.bar_time, 2);
    assert.equal(event.bar_index, 5001);
    assert.equal(event.close_reason, "Forced Market Close");
  }
  context.persistRef.current.endBatch = async () => {};
  await context.restart();
  assert.equal(events.filter((event) => event.close_reason).length, 2);
  assert.equal(completed.at(-1).ending_balance, 10050);
  assert.equal(context.balanceRef.current, 10000);
  assert.equal(context.tradesRef.current.length, 0);
  assert.equal(context.currentIndexRef.current, 1);
});

test("restart is locked while saving, retains results on save failure, and ignores a stale market", async () => {
  const { context } = pageHarness(fixture, 100, [{ id: "kept", status: "Closed", pnl: 50 }]);
  const sample = { start: { start_bar_time: fixture[20].time, initial_balance: 10000 }, endIndex: 5000 + fixture.length };
  const { messages, completed } = installRestartHarness(context, sample);
  const originalTrades = context.tradesRef.current;
  let release;
  context.persistRef.current.endBatch = () => new Promise((resolve) => { release = resolve; });
  const pending = context.restart();
  assert.equal(context.restartingBacktestRef.current, true);
  context.step();
  await context.restart();
  assert.equal(context.currentIndexRef.current, 100);
  assert.equal(completed.length, 1);
  context.dataSessionRef.current++;
  release(); await pending;
  assert.deepEqual(context.tradesRef.current, originalTrades);
  assert.equal(context.currentIndexRef.current, 100);
  context.persistRef.current.endBatch = async () => { throw Error("offline"); };
  await context.restart();
  assert.deepEqual(context.tradesRef.current, originalTrades);
  assert.equal(context.restartingBacktestRef.current, false);
  assert.ok(messages.at(-1).includes("尚未重置"));
  context.persistRef.current.endBatch = async () => {};
  context.isAutomaticTradingEnabled = false;
  await context.restart();
  assert.equal(context.currentIndexRef.current, 21);
  assert.equal(context.isAutomaticTradingEnabled, false);
});

test("batch and manual stepping produce identical trades, balances and ordered persistence on paged history", async () => {
  const data = JSON.parse(fs.readFileSync(new URL("./fixtures/xau-usd-h4-201601.json", import.meta.url), "utf8")).candles;
  const initial = data.findIndex((c) => c.datetime === "2016-01-15T12:00:00");
  const manual = pageHarness(data, initial);
  const batch = pageHarness(data.slice(0, initial + 10), initial);
  const setups = [manual, batch];
  for (const { context } of setups) {
    context.priceDecimals = 2;
    context.settleClosedTrades = context.settleReal;
    context.automaticTradingConfigRef.current = { ...configModule.DEFAULT_AUTOMATIC_TRADING_CONFIG, firstOrderMode: "amount", firstOrderRiskAmount: 200 };
  }
  while (manual.context.currentIndexRef.current < data.length) manual.context.step();
  let chartUpdates = 0, renders = 0, loads = 0;
  batch.context.seriesRef.current.update = () => { chartUpdates++; };
  batch.context.setCurrentIndex = () => { renders++; };
  batch.context.automaticRunRef.current = { suppress: true, cancelled: false };
  await runner.runAutomaticTradingBatch({ limit: Infinity, cursor: () => batch.context.currentIndexRef.current,
    available: () => batch.context.fullDataRef.current.length, total: () => data.length, advance: batch.context.step,
    loadMore: async () => { loads++; batch.context.fullDataRef.current = data.slice(0, Math.min(data.length, batch.context.fullDataRef.current.length + 15)); },
    cancelled: () => false, progress() {}, now: () => 0, yieldToBrowser: async () => {},
  });
  assert.ok(loads > 0);
  assert.equal(chartUpdates, 0);
  assert.equal(renders, 0);
  assert.deepEqual(plain(batch.context.tradesRef.current), plain(manual.context.tradesRef.current));
  assert.equal(batch.context.balanceRef.current, manual.context.balanceRef.current);
  assert.deepEqual(batch.events, manual.events);
});

test("actual page batch handler computes 1000 steps, flushes charts once, reports results and releases the running lock", async () => {
  const data = Array.from({ length: 1200 }, (_, i) => ({ ...fixture[i % fixture.length], time: fixture[i % fixture.length].time + Math.floor(i / fixture.length) * 10000000 }));
  const { context } = pageHarness(data, 1);
  context.totalCandlesRef.current = 5000 + data.length;
  context.commitTrades = context.commitReal;
  context.settleClosedTrades = context.settleReal;
  let chartUpdates = 0, fullRefreshes = 0, tradeRenders = 0;
  const progress = [];
  context.seriesRef.current.update = () => { chartUpdates++; };
  context.syncDisplayedData = (rows, cursor, backtest) => { fullRefreshes++; assert.equal(cursor, 1001); assert.equal(backtest, true); };
  context.setTrades = () => { tradeRenders++; };
  context.setAutomaticRun = (next) => progress.push(next);
  await context.runBulk(1000);
  assert.equal(context.currentIndexRef.current, 1001);
  assert.equal(chartUpdates, 0);
  assert.equal(fullRefreshes, 1);
  assert.equal(tradeRenders, 1);
  assert.equal(progress.at(-1).status, "done");
  assert.equal(progress.at(-1).processed, 1000);
  assert.ok(progress.at(-1).result.closed > 0);
  assert.equal(context.automaticRunRef.current, null);
});

function connectPageHistory(context) {
  const totals = [];
  Object.assign(context, {
    ...marketData, toUnixSeconds: replay.toUnixSeconds,
    earliestUnixRef: { current: null }, latestUnixRef: { current: null },
    replayNeedsMoreFutureRef: { current: false },
    setTotalCandles: (total) => totals.push(total), setLoadedOffset() {},
    setIsHistoryLoading() {}, setHistoryLoadKind() {},
  });
  vm.runInContext(transpile(`globalThis.applyCandlePage = ${pageHandler("applyCandlePage")}; globalThis.loadFutureHistory = ${pageHandler("loadFutureHistory")};`), context);
  context.loadFutureHistoryRef = { current: context.loadFutureHistory };
  return totals;
}

test("merged history counts from the loaded window origin, not the newly fetched page offset", () => {
  const bars = Array.from({ length: 28086 }, (_, i) => ({ time: i + 1, open: 100, close: 100, high: 100, low: 100 }));
  const { context } = pageHarness(bars.slice(5000, 24999), 100);
  context.loadedOffsetRef.current = 5000;
  const totals = connectPageHistory(context);
  context.applyCandlePage({ total: 28086, offset: 24999 }, bars.slice(5000), { skipDisplaySync: true });
  // Previously 24999 + 23086 = 48085: the user's 28086 / 48085 mismatch.
  assert.equal(context.totalCandlesRef.current, 28086);
  assert.deepEqual(totals, [28086]);
  assert.equal(context.loadedOffsetRef.current, 5000);
  assert.equal(context.currentIndexRef.current, 100);
});

test("actual play-to-end loads every future page and ends at 48085 / 48085", async () => {
  const total = 48085, offset = 5000, start = 86;
  const bars = Array.from({ length: total }, (_, i) => ({
    time: 1600000000 + i * 14400, datetime: new Date((1600000000 + i * 14400) * 1000).toISOString(),
    open: 100, close: 100, high: 100, low: 100,
  }));
  const { context } = pageHarness(bars.slice(offset, offset + 5000), start);
  context.loadedOffsetRef.current = offset;
  context.totalCandlesRef.current = total;
  const totals = connectPageHistory(context), loads = [], seen = [], reports = [];
  context.fetchSymbolPage = async ({ afterDate, outputsize }) => {
    const lastTime = Date.parse(afterDate) / 1000;
    const pageOffset = bars.findIndex((bar) => bar.time === lastTime); // inclusive boundary overlaps one bar
    assert.ok(pageOffset >= 0);
    loads.push(pageOffset);
    return { total, offset: pageOffset, rawCandles: bars.slice(pageOffset, pageOffset + outputsize) };
  };
  const step = context.handleNextCandle;
  context.handleNextCandle = () => {
    seen.push(context.loadedOffsetRef.current + context.currentIndexRef.current);
    step();
  };
  context.setAutomaticRun = (value) => reports.push(value);
  let displayedIndex;
  context.setCurrentIndex = (index) => { displayedIndex = offset + index; };
  await context.runBulk(Infinity);
  assert.ok(loads.length > 1);
  assert.ok(totals.every((value) => value === total));
  assert.equal(displayedIndex, total);
  assert.equal(context.loadedOffsetRef.current + context.currentIndexRef.current, total);
  assert.deepEqual(seen, Array.from({ length: total - offset - start }, (_, i) => offset + start + i));
  assert.equal(reports.at(-1).status, "done");
  assert.equal(reports.at(-1).processed, total - offset - start);
  assert.equal(reports.at(-1).processed, reports.at(-1).target);
  assert.equal(context.automaticRunRef.current, null);
});

test("keeping closed fills outside the execution loop preserves every trade, ordered event and balance", async () => {
  const data = Array.from({ length: 20000 }, (_, i) => ({ ...fixture[i % fixture.length], time: fixture[i % fixture.length].time + Math.floor(i / fixture.length) * 10000000 }));
  const manual = pageHarness(data, 1), batch = pageHarness(data, 1);
  for (const { context } of [manual, batch]) {
    context.settleClosedTrades = context.settleReal;
    context.totalCandlesRef.current = 5000 + data.length;
  }
  manual.context.automaticRunRef.current = { suppress: true }; // original execution scans the full ledger
  while (manual.context.currentIndexRef.current < data.length) manual.context.step();
  let peakActive = 0;
  const step = batch.context.handleNextCandle;
  batch.context.handleNextCandle = () => {
    step();
    peakActive = Math.max(peakActive, batch.context.tradesRef.current.length);
    assert.ok(batch.context.tradesRef.current.every((trade) => trade.status === "Open"));
  };
  await batch.context.runBulk(10000);
  await batch.context.runBulk(Infinity); // Reopen the journal with prior fills and funding metadata.
  assert.deepEqual(plain(batch.context.tradesRef.current), plain(manual.context.tradesRef.current));
  assert.deepEqual(batch.events, manual.events);
  assert.equal(batch.context.balanceRef.current, manual.context.balanceRef.current);
  assert.ok(batch.context.tradesRef.current.length > peakActive * 10);
});

test("million-bar display keeps every series bounded and historical navigation leaves the strategy cursor alone", () => {
  const data = Array.from({ length: 1000000 }, (_, i) => ({ time: 1600000000 + i * 300, open: 2000 + i % 100, close: 2001 + i % 100, high: 2002 + i % 100, low: 1999 + i % 100, volume: 10 }));
  const { context } = pageHarness([], 0);
  const utils = loadModule("./chart-utils.ts", { "lightweight-charts": {} });
  let widest = 0, lastRange;
  const series = () => ({ setData: (rows) => { widest = Math.max(widest, rows.length); assert.ok(rows.length <= chartWindow.CHART_WINDOW_BARS); }, update() {} });
  const chart = { timeScale: () => ({ getVisibleLogicalRange: () => ({ from: 0, to: 100 }), setVisibleLogicalRange: (range) => { lastRange = range; } }) };
  Object.assign(context, {
    ...utils, ...marketData, fullDataRef: { current: data }, currentIndexRef: { current: 900000 },
    indConfigRef: { current: { emas: [{ id: "ema", period: 20 }], bollinger: { enabled: true, period: 20, standardDeviation: 2 }, macd: { enabled: true, fast: 12, slow: 26, signal: 9, histColors: {} }, volume: {} } },
    fullBollingerDataRef: { current: [] }, chartViewportSyncRef: { current: false }, chartRef: { current: chart },
    seriesRef: { current: series() }, volumeSeriesRef: { current: series() }, emaSeriesRefs: { current: { ema: series() } },
    bollingerSeriesRefs: { current: { middle: series(), upper: series(), lower: series() } },
    macdHistSeriesRef: { current: series() }, macdLineSeriesRef: { current: series() }, macdSignalSeriesRef: { current: series() },
    BOLLINGER_LINE_DEFINITIONS: [{ key: "middle" }, { key: "upper" }, { key: "lower" }],
    toBollingerLineData: (rows, key) => rows.map((row) => ({ time: row.time, value: row[key] })),
    focusLatestCandles() {}, volumeChartRef: { current: null },
  });
  vm.runInContext(transpile(`globalThis.recomputeIndicators = ${pageHandler("recomputeIndicators")}; globalThis.syncDisplayedData = ${pageHandler("syncDisplayedData")};`), context);
  context.syncDisplayedData(data, 900000, true, true);
  assert.ok(widest > 0 && widest <= 5000);
  assert.ok(context.indicatorOffsetRef.current > 890000);
  assert.ok(context.fullMacdDataRef.current.length < 10000);
  context.syncDisplayedData(data, 900000, true, false, { focusRange: { from: 90, to: 210 } });
  assert.equal(context.currentIndexRef.current, 900000);
  assert.equal(context.chartWindowRef.current.from, 0);
  assert.deepEqual(plain(lastRange), { from: 90, to: 210 });
  assert.equal(context.chartViewportSyncRef.current, false);
});

test("large backtest benchmark", { skip: process.env.BACKTEST_PERF !== "1" }, async () => {
  for (const count of [100000, 1000000]) {
    const data = Array.from({ length: count }, (_, i) => ({ ...fixture[i % fixture.length], time: fixture[i % fixture.length].time + Math.floor(i / fixture.length) * 10000000 }));
    const { context } = pageHarness(data, 1);
    context.settleClosedTrades = context.settleReal;
    context.totalCandlesRef.current = 5000 + count;
    let peakActive = 0, reports = 0;
    const step = context.handleNextCandle;
    context.handleNextCandle = () => { step(); peakActive = Math.max(peakActive, context.tradesRef.current.length); };
    context.setAutomaticRun = () => { reports++; };
    const started = performance.now();
    await context.runBulk(Infinity);
    assert.equal(context.currentIndexRef.current, count);
    console.log(JSON.stringify({ candles: count, seconds: (performance.now() - started) / 1000, records: context.tradesRef.current.length, peakActive, reports, heapMB: process.memoryUsage().heapUsed / 1024 / 1024 }));
    if (count === 100000) {
      const baseline = pageHarness(data, 1);
      baseline.context.settleClosedTrades = baseline.context.settleReal;
      baseline.context.automaticRunRef.current = { suppress: true };
      const before = performance.now();
      while (baseline.context.currentIndexRef.current < count) baseline.context.step();
      assert.deepEqual(plain(baseline.context.tradesRef.current), plain(context.tradesRef.current));
      assert.equal(baseline.context.balanceRef.current, context.balanceRef.current);
      console.log(JSON.stringify({ fullLedgerScanCandles: count, seconds: (performance.now() - before) / 1000 }));
    }
  }
});
