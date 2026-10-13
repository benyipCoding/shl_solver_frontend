import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const target = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("./realtime-data.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText, { exports: target.exports, module: target });
const { applyRealtimeCandles, realtimeExit } = target.exports;
const candle = (time, close = 11) => ({ time, open: 10, high: 13, low: 9, close, volume: null });

test("repeated forming-bar updates overwrite once and crossed bars append in order", () => {
  const rows = [candle(1), candle(2)];
  assert.equal(applyRealtimeCandles(rows, [candle(2, 12)]), 0);
  assert.equal(rows[1].close, 12);
  assert.equal(applyRealtimeCandles(rows, [candle(2, 13), candle(3), candle(4)]), 2);
  assert.deepEqual(rows.map((row) => row.time), [1, 2, 3, 4]);
});
test("reconnect snapshot repairs overlap, preserves older pages, and is idempotent", () => {
  const rows = [candle(1), candle(2), candle(3)];
  const oldest = rows[0];
  const snapshot = [candle(2, 12), candle(3, 13), candle(4)];
  applyRealtimeCandles(rows, snapshot);
  assert.equal(applyRealtimeCandles(rows, snapshot), 0);
  assert.equal(rows[0], oldest);
  assert.deepEqual(rows.map((row) => row.close), [11, 12, 13, 11]);
});
test("a disconnected snapshot fails without corrupting the historical window", () => {
  const rows = [candle(1), candle(2)];
  assert.throws(() => applyRealtimeCandles(rows, [candle(8)]), /缺口/);
  assert.deepEqual(rows.map((row) => row.time), [1, 2]);
});
test("tail updates use logarithmic lookup without copying million-bar history", () => {
  let reads = 0;
  const rows = new Proxy(Array.from({ length: 1_000_000 }, (_, i) => candle(i)), {
    get(target, key) { if (/^\d+$/.test(String(key))) reads++; return target[key]; },
  });
  applyRealtimeCandles(rows, [candle(999_999, 12), candle(1_000_000)]);
  assert.ok(reads < 60);
});
test("live stop-loss ignores pre-entry extrema and uses the first crossing quote", () => {
  const trade = { type: "Buy", sl: 9, tp: 13, realtimeQuoteTime: 100 };
  assert.equal(realtimeExit(trade, [{ timestamp: 99, bid: 7, ask: 9 }]), null);
  const exit = realtimeExit(trade, [{ timestamp: 101, bid: 7, ask: 9 }, { timestamp: 102, bid: 13, ask: 15 }]);
  assert.equal(exit.price, 8);
  assert.equal(exit.reason, "SL Hit");
});
test("sell take-profit works and missing quote baselines never replay historical fills", () => {
  const quotes = [{ timestamp: 101, bid: 7, ask: 9 }];
  assert.equal(realtimeExit({ type: "Sell", sl: 13, tp: 9, realtimeQuoteTime: 100 }, quotes).reason, "TP Hit");
  assert.equal(realtimeExit({ type: "Buy", sl: 9, tp: null }, quotes), null);
});
test("distinct quotes in the entry second are ordered by sequence", () => {
  const trade = { type: "Buy", sl: 9, tp: 13, realtimeQuoteTime: 100, realtimeQuoteSequence: 5 };
  assert.equal(realtimeExit(trade, [{ timestamp: 100, sequence: 5, bid: 7, ask: 9 }]), null);
  assert.equal(realtimeExit(trade, [{ timestamp: 100, sequence: 6, bid: 7, ask: 9 }]).reason, "SL Hit");
});
