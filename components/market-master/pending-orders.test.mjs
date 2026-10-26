import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const target = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("./pending-orders.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: target.exports, module: target });
const pending = target.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const candle = (open, high, low, close) => ({ time: 1, open, high, low, close });
const order = (type, kind, price, extra = {}) => ({ id: "p", type, kind, price, units: 10, sl: null, tp: null, ...extra });

test("order kind follows the price against the market", () => {
  assert.equal(pending.pendingOrderKind("Buy", 99, 100), "limit");
  assert.equal(pending.pendingOrderKind("Buy", 101, 100), "stop");
  assert.equal(pending.pendingOrderKind("Sell", 101, 100), "limit");
  assert.equal(pending.pendingOrderKind("Sell", 99, 100), "stop");
  assert.equal(pending.pendingOrderLabel({ type: "Buy", kind: "stop" }), "Buy Stop");
  assert.equal(pending.pendingOrderLabelZh({ type: "Sell", kind: "limit" }), "卖出限价挂单");
});

test("pending orders fill when a candle trades through the price; gaps fill at the open", () => {
  // Buy limit waits below.
  assert.equal(pending.resolvePendingFill(order("Buy", "limit", 99), candle(100, 101, 99.5, 100)), null);
  assert.equal(pending.resolvePendingFill(order("Buy", "limit", 99), candle(100, 101, 98, 99.5)), 99);
  assert.equal(pending.resolvePendingFill(order("Buy", "limit", 99), candle(97, 98, 96, 97)), 97); // gap down: better
  // Buy stop waits above.
  assert.equal(pending.resolvePendingFill(order("Buy", "stop", 101), candle(100, 100.9, 99, 100)), null);
  assert.equal(pending.resolvePendingFill(order("Buy", "stop", 101), candle(100, 102, 99, 101.5)), 101);
  assert.equal(pending.resolvePendingFill(order("Buy", "stop", 101), candle(103, 104, 102, 103)), 103); // gap up: worse
  // Sell limit waits above, sell stop below.
  assert.equal(pending.resolvePendingFill(order("Sell", "limit", 101), candle(100, 101, 99, 100)), 101);
  assert.equal(pending.resolvePendingFill(order("Sell", "limit", 101), candle(103, 104, 102, 103)), 103);
  assert.equal(pending.resolvePendingFill(order("Sell", "stop", 99), candle(100, 101, 99, 100)), 99);
  assert.equal(pending.resolvePendingFill(order("Sell", "stop", 99), candle(97, 98, 96, 97)), 97);
});

test("pending SL/TP are measured from the pending price, not the market", () => {
  assert.equal(pending.getPendingRiskError("Buy", "sl", 95, 99), null);
  assert.match(pending.getPendingRiskError("Buy", "sl", 99.5, 99), /低于挂单价/);
  assert.match(pending.getPendingRiskError("Buy", "tp", 98, 99), /高于挂单价/);
  assert.equal(pending.getPendingRiskError("Sell", "sl", 102, 101), null);
  assert.match(pending.getPendingRiskError("Sell", "tp", 102, 101), /低于挂单价/);
  assert.equal(pending.getPendingOrderError({ type: "Buy", price: 99, units: 10, sl: 98, tp: 101 }), null);
  assert.match(pending.getPendingOrderError({ type: "Buy", price: 0, units: 10, sl: null, tp: null }), /挂单价/);
  assert.match(pending.getPendingOrderError({ type: "Buy", price: 99, units: 1.5, sl: null, tp: null }), /正整数/);
});

test("terminal SL/TP distances become brackets around the pending price", () => {
  assert.deepEqual(plain(pending.pendingBracketsFromDistances("Buy", 99.5, { enabled: true, distance: 2 }, { enabled: true, distance: 4 }, 2)),
    { sl: 97.5, tp: 103.5 });
  assert.deepEqual(plain(pending.pendingBracketsFromDistances("Sell", 99.5, { enabled: true, distance: 2 }, { enabled: false, distance: 4 }, 2)),
    { sl: 101.5, tp: null });
});

test("broker entry rows become chart pending orders for the current symbol only", () => {
  const rows = [
    { order_id: "E1", type: "LE", rate: 1.09, amount: 2000, side: "Buy", symbol: "EUR/USD", entry: true, stop: 1.08, limit: null },
    { order_id: "E2", type: "SE", rate: 1.12, amount: 1000, side: "Sell", symbol: "EUR/USD", entry: true, stop: null, limit: 1.1 },
    { order_id: "S1", type: "S", rate: 1.08, amount: 2000, side: "Sell", symbol: "EUR/USD", entry: false },
    { order_id: "E3", type: "LE", rate: 150, amount: 1000, side: "Buy", symbol: "USD/JPY", entry: true },
  ];
  assert.deepEqual(plain(pending.brokerPendingOrders(rows, "EUR/USD")), [
    { id: "E1", brokerOrderId: "E1", type: "Buy", kind: "limit", price: 1.09, units: 2000, sl: 1.08, tp: null },
    { id: "E2", brokerOrderId: "E2", type: "Sell", kind: "stop", price: 1.12, units: 1000, sl: null, tp: 1.1 },
  ]);
});
