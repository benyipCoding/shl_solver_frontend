import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const target = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(js, { module: target, exports: target.exports, require: (name) => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return target.exports;
}
const pens = load("./automatic-pens.ts");
const management = load("./trade-management.ts");
const trading = load("./automatic-pen-trading.ts", { "./automatic-pens": pens });
const risk = load("./automatic-pen-risk.ts", { "./automatic-pens": pens, "./trade-management": management });
const position = (extra = {}) => ({ id: "parent", type: "Buy", entry: 100, entryTime: 1, units: 100,
  sl: 90, tp: 250, status: "Open", pnl: 0, automaticPen: { initialStop: 90, initialRisk: 10 }, ...extra });
const event = (extra = {}) => ({ side: "Buy", atr: 5, trendOrigin: { price: 100, time: 0 },
  pen: { trend: -1, startPoint: { price: 130, time: 20 }, endPoint: { price: 119, time: 30 } }, ...extra });

test("buffer adapts to ATR, respects two ticks and rounds stops away from the pivot", () => {
  assert.equal(risk.automaticStopBuffer(10, 2), 2);
  assert.equal(risk.automaticStopBuffer(null, 2), 0.02);
  assert.equal(risk.automaticStopAtPivot("Sell", 100.005, 1, 2), 100.21);
  assert.equal(risk.automaticStopAtPivot("Buy", 100.005, 1, 2), 99.8);
  assert.equal(risk.automaticStopAtPivot("Sell", 1.3, 0.001, 5), 1.3002);
});

test("Wilder ATR is causal, includes gaps, warms up identically, and ignores duplicate bars", () => {
  const bars = Array.from({ length: 25 }, (_, i) => ({ time: i + 1, open: 100 + i, close: 100 + i, high: 101 + i, low: 99 + i }));
  bars[20] = { ...bars[20], open: 120, close: 120, high: 130, low: 118 };
  let atr = null, sum = 0, previous = null;
  const tracker = trading.createAutomaticPenTradeTracker([]);
  const expected = bars.map((bar, i) => {
    const tr = Math.max(bar.high - bar.low, previous === null ? 0 : Math.abs(bar.high - previous), previous === null ? 0 : Math.abs(bar.low - previous));
    if (i < 14) sum += tr;
    if (i === 13) atr = sum / 14;
    else if (i > 13) atr = (13 * atr + tr) / 14;
    previous = bar.close;
    const result = tracker.advanceEvent(bar);
    if (result) assert.equal(result.atr, atr);
    assert.equal(tracker.advanceEvent(bar), null);
    return result;
  });
  // Force a reversal after the ATR warmup to observe the updated gap-aware value.
  const reversal = [123, 122, 121, 120].map((price, i) => ({ time: 26 + i, open: price, close: price, high: price + 1, low: price - 1 }));
  const resumed = trading.createAutomaticPenTradeTracker(bars);
  const first = reversal.map((bar) => tracker.advanceEvent(bar));
  const second = reversal.map((bar) => resumed.advanceEvent(bar));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  const last = first.at(-1);
  assert.ok(last && last.atr > 2);
  assert.ok(expected.some(Boolean));
});

test("first orders use terminal units and symmetric p0 stops with a distant 10R target", () => {
  const long = risk.planAutomaticPenOrder(event(), 119, 100, [], 2);
  assert.equal(long.sl, 99);
  assert.equal(long.tp, 319);
  assert.equal(long.units, 100);
  const short = risk.planAutomaticPenOrder(event({ side: "Sell", trendOrigin: { price: 138, time: 0 } }), 119, 100, [], 2);
  assert.equal(short.sl, 139);
  assert.equal(short.tp, 0.01); // cannot put a take-profit below zero
  assert.equal(short.automaticPen.initialRisk, 20);
  assert.equal(risk.planAutomaticPenOrder(event(), 98, 100, [], 2), null);
  assert.equal(risk.planAutomaticPenOrder(event(), 119, 0, [], 2), null);
});

test("funding uses stop-locked profit and remaining units, never floating profit", () => {
  assert.equal(risk.automaticLockedProfit(position()), 0);
  assert.equal(risk.automaticLockedProfit(position({ sl: 100 })), 0);
  assert.equal(risk.automaticLockedProfit(position({ sl: 110 })), 1000);
  assert.equal(risk.automaticLockedProfit(position({ sl: 110, units: 30 })), 300);
  assert.equal(risk.automaticLockedProfit(position({ type: "Sell", sl: 90 })), 1000);
  assert.equal(risk.automaticLockedProfit(position({ sl: 110, status: "Closed" })), 0);
  assert.equal(risk.automaticLockedProfit(position({ sl: 110, automaticPen: undefined })), 0);
});

test("$1000 locked allows at most $500 initial risk with quantity rounded down", () => {
  const parent = position({ sl: 110 });
  const plan = risk.planAutomaticPenOrder(event(), 118, NaN, [parent], 2);
  assert.equal(plan.units, 26); // floor(500 / 19)
  assert.equal(plan.automaticPen.riskBudget, 500);
  assert.equal(plan.automaticPen.fundedBy, "parent");
  assert.ok(plan.units * (118 - plan.sl) <= 500);
  assert.ok((plan.units + 1) * (118 - plan.sl) > 500);
  assert.equal(risk.planAutomaticPenOrder(event(), 118, 100, [position({ sl: 100.01, units: 1 })], 2), null);
});

test("only latest open same-side automatic trade may fund, and a spent sponsor cannot fund twice", () => {
  const protectedTrade = position({ sl: 110 });
  const newer = position({ id: "newer", entryTime: 10 });
  assert.equal(risk.planAutomaticPenOrder(event(), 119, 100, [protectedTrade, newer], 2), null);
  assert.equal(risk.planAutomaticPenOrder(event(), 119, 100, [position({ sl: 110, automaticPen: { fundedChildId: "closed-child" } })], 2), null);
  const plan = risk.planAutomaticPenOrder(event(), 119, 777, [
    position({ type: "Sell", entryTime: 100 }), position({ automaticPen: undefined }), position({ status: "Closed" }),
  ], 2);
  assert.equal(plan.units, 777);
  assert.equal(plan.automaticPen.fundedBy, undefined);
});

test("confirmed lows/highs tighten only matching automatic survivors, never loosen stops", () => {
  for (const side of ["Buy", "Sell"]) {
    const buy = side === "Buy";
    const pivot = buy ? 110 : 90;
    const sl = buy ? 109 : 91;
    const input = position({ type: side, sl: buy ? 90 : 110 });
    const confirm = event({ side: null, pen: { trend: buy ? 1 : -1, startPoint: { price: pivot, time: 20 } } });
    const result = risk.trailAutomaticPenStops([input], confirm, buy ? 120 : 80, 2);
    assert.equal(result.changed.length, 1);
    assert.equal(result.trades[0].sl, sl);
    assert.notEqual(result.trades[0], input);
    assert.equal(input.sl, buy ? 90 : 110);
    for (const blocked of [
      { sl: buy ? 115 : 85 }, { entryTime: 21 }, { status: "Closed" }, { automaticPen: undefined }, { type: buy ? "Sell" : "Buy" },
    ]) {
      assert.equal(risk.trailAutomaticPenStops([{ ...input, ...blocked }], confirm, buy ? 120 : 80, 2).changed.length, 0);
    }
    assert.equal(risk.trailAutomaticPenStops([input], confirm, buy ? 108 : 92, 2).changed.length, 0);
  }
});

test("gap stops fill at open, ambiguous bars favor SL, targets remain conservative", () => {
  const buy = position();
  assert.equal(risk.resolveAutomaticPenExit(buy, { open: 80, high: 95, low: 75 }).price, 80);
  assert.equal(risk.resolveAutomaticPenExit(buy, { open: 110, high: 260, low: 85 }).reason, "SL Hit");
  assert.equal(risk.resolveAutomaticPenExit(buy, { open: 260, high: 270, low: 80 }).price, 250);
  assert.equal(risk.resolveAutomaticPenExit(buy, { open: 100, high: 120, low: 95 }), null);
  const sell = position({ type: "Sell", sl: 110, tp: 70 });
  assert.equal(risk.resolveAutomaticPenExit(sell, { open: 120, high: 125, low: 100 }).price, 120);
  assert.equal(risk.resolveAutomaticPenExit(sell, { open: 100, high: 115, low: 60 }).reason, "SL Hit");
  assert.equal(risk.resolveAutomaticPenExit(sell, { open: 60, high: 120, low: 50 }).price, 70);
});
