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
const { normalizeCandles, toVolumePoint, buildVolumeData } = target.exports;

const candle = (datetime, overrides = {}) => ({
  datetime,
  open: 10,
  high: 12,
  low: 9,
  close: 11,
  ...overrides,
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("forward pages append to million-bar history without reading, sorting or copying existing candles", () => {
  const original = Array.from({ length: 1000000 }, (_, time) => ({ time }));
  let reads = 0;
  const history = new Proxy(original, { get(target, key, receiver) {
    if (typeof key === "string" && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, receiver);
  } });
  const previousLast = original.at(-1);
  const page = [{ time: 999999 }, { time: 1000000 }, { time: 1000001 }];
  assert.equal(target.exports.appendCandlePage(history, page), 2);
  assert.equal(original.length, 1000002);
  assert.equal(original[999999], previousLast);
  assert.equal(original.at(-1), page.at(-1));
  assert.ok(reads < 10);
  assert.equal(target.exports.appendCandlePage(history, page), 0);
});

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
    open: 10, high: 12, low: 9, close: 12, volume: null,
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
  assert.deepEqual(plain(result), [{ time: 0, open: 0, high: 1.5, low: -2, close: -1, volume: null }]);
  assert.equal(normalizeCandles().length, 0);
});

test("preserves volume from the API, including numeric strings and actual zero", () => {
  const result = normalizeCandles([
    candle("2026-09-23 00:00:00", { volume: "1234.5" }),
    candle("2026-09-23 00:01:00", { volume: 0 }),
    candle("2026-09-23 00:02:00", { volume: 9876 }),
    candle("2026-09-23 00:02:00", { volume: "9999" }),
  ]);
  assert.deepEqual(plain(result.map((bar) => bar.volume)), [1234.5, 0, 9999]);
});

test("missing or invalid volume leaves the price candle usable without fabricating zero", () => {
  for (const volume of [undefined, null, "", "  ", "bad", NaN, Infinity, -1, "-2", true]) {
    const result = normalizeCandles([candle("2026-09-23 00:00:00", { volume })]);
    assert.equal(result.length, 1);
    assert.equal(result[0].volume, null, String(volume));
  }
});

test("volume histogram preserves missing timestamps for alignment and uses candle direction", () => {
  const bars = normalizeCandles([
    candle("2026-09-23 00:00:00", { volume: 100 }),
    candle("2026-09-23 00:01:00"),
    candle("2026-09-23 00:02:00", { close: 9, volume: 200 }),
    candle("2026-09-23 00:03:00", { close: 10, volume: 0 }),
  ]);
  const points = bars.map((bar) => toVolumePoint(bar, { upColor: "green", downColor: "red" }));
  assert.deepEqual(plain(points), [
    { time: bars[0].time, value: 100, color: "green" },
    { time: bars[1].time },
    { time: bars[2].time, value: 200, color: "red" },
    { time: bars[3].time, value: 0, color: "green" },
  ]);
});

test("replay volume excludes prefetched future bars and reveals only the next candle", () => {
  const bars = normalizeCandles([
    candle("2026-09-23 00:00:00", { volume: 100 }),
    candle("2026-09-23 00:01:00", { volume: 200 }),
    candle("2026-09-23 00:02:00", { volume: 99999 }),
  ]);
  const colors = { upColor: "green", downColor: "red" };
  const visible = buildVolumeData(bars, 2, colors);
  assert.deepEqual(plain(visible.map((bar) => bar.value)), [100, 200]);
  assert.deepEqual(plain(buildVolumeData(bars, 0, colors)), []);
  assert.deepEqual(plain(buildVolumeData(bars, -1, colors)), []);
  assert.deepEqual(
    plain([...visible, toVolumePoint(bars[2], colors)]),
    plain(buildVolumeData(bars, 3, colors))
  );
  assert.equal(buildVolumeData(bars, 1, colors).length, 1);
});
