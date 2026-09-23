import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("./market-data.ts", import.meta.url), "utf8");
const target = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText,
  { exports: target.exports, module: target }
);
const { normalizeCandles } = target.exports;

const candle = (datetime, overrides = {}) => ({
  datetime,
  open: 10,
  high: 12,
  low: 9,
  close: 11,
  ...overrides,
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("removes duplicate backtest bars and sorts without mutating the response", () => {
  // A duplicate third bar produces non-monotonic internal indexes in the
  // production chart library and can throw 'Value is null' during rendering.
  const input = [
    candle("2026-09-23 00:03:00"),
    candle("2026-09-23 00:00:00"),
    candle("2026-09-23 00:02:00"),
    candle("2026-09-23 00:02:00", { close: 12 }),
    candle("2026-09-23 00:01:00"),
  ];
  const original = structuredClone(input);
  const result = normalizeCandles(input);

  assert.equal(result.length, 4);
  assert.equal(result[2].close, 12);
  assert.ok(result.every((bar, i) => i === 0 || bar.time > result[i - 1].time));
  assert.deepEqual(input, original);
});

test("deduplicates equivalent UTC timestamps and subsecond timestamps", () => {
  const result = normalizeCandles([
    candle("2026-09-23 00:00:00"),
    candle("2026-09-23T08:00:00+08:00", { close: 10 }),
    candle("2026-09-23T00:00:00.999Z", { close: 12 }),
  ]);
  assert.deepEqual(plain(result), [{
    time: Date.parse("2026-09-23T00:00:00Z") / 1000,
    open: 10, high: 12, low: 9, close: 12,
  }]);
});

test("rejects missing, blank, nonnumeric and nonfinite OHLC values", () => {
  for (const field of ["open", "high", "low", "close"]) {
    for (const value of [null, undefined, "", "  ", "bad", NaN, Infinity, -Infinity, "Infinity"]) {
      const input = [candle("2026-09-23 00:00:00", { [field]: value })];
      assert.equal(normalizeCandles(input).length, 0, `${field}: ${String(value)}`);
    }
  }
});

test("an invalid duplicate does not replace a valid candle", () => {
  const valid = candle("2026-09-23 00:00:00");
  assert.deepEqual(
    plain(normalizeCandles([valid, { ...valid, close: null }])),
    plain(normalizeCandles([valid]))
  );
});

test("accepts numeric strings, zero and negative prices while rejecting invalid dates", () => {
  const result = normalizeCandles([
    candle(undefined),
    candle("not-a-date"),
    candle("1970-01-01", { open: "0", high: "1.5", low: "-2", close: "-1" }),
  ]);
  assert.deepEqual(plain(result), [{ time: 0, open: 0, high: 1.5, low: -2, close: -1 }]);
  assert.equal(normalizeCandles().length, 0);
});
