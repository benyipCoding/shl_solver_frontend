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
const replay = loadModule("./backtest-replay.ts", { "./trade-management": management });
const risk = loadModule("./automatic-pen-risk.ts", { "./automatic-pens": pens, "./trade-management": management });
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

function pageHarness(data, index, initialTrades = []) {
  const events = [];
  const tracker = trading.createAutomaticPenTradeTracker(data.slice(0, index));
  let nextId = 0;
  const context = {
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
    setCurrentIndex() {}, setIsPlaying() {}, closeTradeRecord: management.closeTradeRecord,
    isBacktestMode: true, currentPrice: data[index - 1]?.close,
    orderUnits: 1234, slEnabled: true, slDistance: 0.0001, tpEnabled: true, tpDistance: 0.0002,
    crypto: { randomUUID: () => `automatic-order-${++nextId}` },
    tradesRef: { current: initialTrades },
    syncTradeMarkers() {}, getActiveCandle: (data, count) => data[count - 1],
    pendingSessionStartRef: { current: { marker: "pending" } },
    persistRef: { current: { startSession: () => events.push("session"), recordOpen: (order) => events.push(plain(order)), recordModify: (order) => events.push(plain(order)) } },
    toPersistSide: (side) => side === "Buy" ? "buy" : "sell",
    toast: { error: (message) => assert.fail(message) },
  };
  context.commitTrades = (next) => { context.tradesRef.current = next; };
  context.settleClosedTrades = (next) => { events.push("settle"); context.tradesRef.current = next; };
  vm.createContext(context);
  vm.runInContext(transpile(`globalThis.placeOrder = ${pageHandler("handlePlaceOrder")}; globalThis.step = ${pageHandler("handleNextCandle")};`), context);
  context.placeOrderRef.current = context.placeOrder;
  return { context, events };
}

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
  assert.match(html(), /role="switch" aria-checked="false"/);
  assert.match(html({ isAutomaticTradingEnabled: true }), /aria-checked="true"/);
  assert.doesNotMatch(html({ isReplayMode: true }), /自动做单/);
  assert.doesNotMatch(html({ isBacktestMode: false }), /自动做单/);
  user = { is_superuser: false };
  assert.doesNotMatch(html(), /自动做单/);
});
