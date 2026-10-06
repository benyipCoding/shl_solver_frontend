import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule(relativePath, dependencies = {}) {
  const target = { exports: {} };
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module: target,
    exports: target.exports,
    require: (name) => {
      assert.ok(name in dependencies, `unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return target.exports;
}

const pensModule = loadModule("./automatic-pens.ts");
const { generateAutomaticPens } = pensModule;
const plain = (value) => JSON.parse(JSON.stringify(value));
const candles = (prices, wick = 1, startTime = 1) => prices.map((price, index) => ({
  time: startTime + index, open: price, close: price, high: price + wick, low: price - wick,
}));

test("requires both five candles and sufficient price movement, including equality", () => {
  assert.equal(generateAutomaticPens(candles([100, 101, 102, 104])).length, 0);
  assert.equal(generateAutomaticPens(candles([100, 100.1, 100.2, 100.3, 100.4])).length, 0);
  const pens = generateAutomaticPens(candles([100, 101, 102, 103, 104]));
  assert.equal(pens.length, 1);
  assert.equal(pens[0].startPoint.price, 100);
  assert.equal(pens[0].endPoint.price, 104);
});

test("ignores a shallow pullback and extends the original trend", () => {
  const data = candles([100, 101, 102, 103, 104, 103.5, 103, 102.5, 102, 105]);
  const pens = generateAutomaticPens(data);
  assert.equal(pens.length, 1);
  assert.equal(pens[0].startPoint.time, 1);
  assert.equal(pens[0].endPoint.price, 105);
});

test("a shallow initial leg qualifies at fifteen candles, but not fourteen, in both directions", () => {
  for (const direction of [1, -1]) {
    const data = candles(Array.from({ length: 15 }, (_, i) => 100 + direction * i * 0.01));
    assert.equal(generateAutomaticPens(data.slice(0, 14)).length, 0);
    const pens = generateAutomaticPens(data);
    assert.equal(pens.length, 1);
    assert.equal(pens[0].trend, direction);
    assert.equal(pens[0].startPoint.index, 0);
    assert.equal(pens[0].endPoint.index, 14);
  }
});

test("a shallow reversal qualifies at fifteen candles with an exactly shared pivot", () => {
  for (const direction of [1, -1]) {
    const data = candles([
      ...Array.from({ length: 5 }, (_, i) => 100 + direction * i),
      ...Array.from({ length: 14 }, (_, i) => 100 + direction * (4 - (i + 1) * 0.01)),
    ]);
    assert.equal(generateAutomaticPens(data.slice(0, -1)).length, 1);
    const pens = generateAutomaticPens(data);
    assert.equal(pens.length, 2);
    assert.deepEqual(pens[0].endPoint, pens[1].startPoint);
    assert.equal(pens[1].trend, -direction);
    assert.equal(pens[1].endPoint.index - pens[1].startPoint.index + 1, 15);
  }
});

test("the time-only threshold can be adjusted and defaults to three times the minimum span", () => {
  const data = candles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.01));
  const options = { timeOnlyMinCandleCount: 20 };
  assert.equal(generateAutomaticPens(data.slice(0, 19), undefined, options).length, 0);
  assert.equal(generateAutomaticPens(data.slice(0, 20), undefined, options).length, 1);
  assert.equal(generateAutomaticPens(data.slice(0, 17), 6).length, 0);
  assert.equal(generateAutomaticPens(data.slice(0, 18), 6).length, 1);
  for (const value of [4, -1, 15.5, NaN, Infinity]) {
    assert.throws(() => generateAutomaticPens(data, undefined, { timeOnlyMinCandleCount: value }), /timeOnlyMinCandleCount/);
  }
});

test("time alone cannot create pens when prices stay identical", () => {
  assert.equal(generateAutomaticPens(candles(Array(120).fill(100))).length, 0);
});

test("waiting after a shallow old extreme does not substitute for fifteen candles between endpoints", () => {
  const prices = [100, 101, 102, 103, 104, 103.9, 103.8, 103.7, 103.6, ...Array(30).fill(103.6)];
  assert.equal(generateAutomaticPens(candles(prices)).length, 1);
  const pens = generateAutomaticPens(candles([...prices, 103.5]));
  assert.equal(pens.length, 2);
  assert.equal(pens[1].startPoint.index, 4);
  assert.equal(pens[1].endPoint.index, prices.length);
});

test("extending the trend restarts the reversal span at the new extreme", () => {
  const prices = [
    100, 101, 102, 103, 104,
    ...Array.from({ length: 10 }, (_, i) => 104 - (i + 1) * 0.01),
    105,
    ...Array.from({ length: 14 }, (_, i) => 105 - (i + 1) * 0.01),
  ];
  assert.equal(generateAutomaticPens(candles(prices.slice(0, -1))).length, 1);
  const pens = generateAutomaticPens(candles(prices));
  assert.equal(pens.length, 2);
  assert.equal(pens[1].startPoint.index, 15);
  assert.equal(pens[1].endPoint.index, 29);
});

test("confirms meaningful reversals in both directions with exactly shared pivots", () => {
  const pens = generateAutomaticPens(candles([100, 101, 102, 103, 104, 103, 102, 101, 100, 101, 102, 103, 104]));
  assert.deepEqual(Array.from(pens, (pen) => pen.trend), [1, -1, 1]);
  assert.deepEqual(pens[0].endPoint, pens[1].startPoint);
  assert.deepEqual(pens[1].endPoint, pens[2].startPoint);
});

test("a falling trend ignores a shallow bounce before extending", () => {
  const pens = generateAutomaticPens(candles([104, 103, 102, 101, 100, 100.5, 101, 101.5, 102, 99]));
  assert.equal(pens.length, 1);
  assert.equal(pens[0].trend, -1);
  assert.equal(pens[0].endPoint.price, 99);
});

test("the ATR threshold stays fixed before the configured time-only threshold", () => {
  const data = candles([100, 101, 102, 103, 104]);
  data.push(...candles(Array.from({ length: 120 }, (_, i) => 104 - (i + 1) * 0.01), 0.005, 6));
  const pens = generateAutomaticPens(data, undefined, { timeOnlyMinCandleCount: 150 });
  assert.equal(pens.length, 1);
  assert.equal(pens[0].endPoint.price, 104);
});

test("background volatility warms up from history outside the drawing range", () => {
  const history = candles(Array(100).fill(100), 5);
  const quiet = candles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.1), 0.01, 101);
  assert.equal(generateAutomaticPens([...history, ...quiet], undefined, { startIndex: 120 }).length, 0);
  assert.equal(generateAutomaticPens(quiet.slice(20)).length, 1);
});

test("warmup candles never become endpoints", () => {
  const data = candles([90, 92, 94, 96, 100, 101, 102, 103, 104, 105, 106, 107]);
  const pens = generateAutomaticPens(data, undefined, { startIndex: 4 });
  assert.ok(pens.length > 0);
  assert.ok(pens.every((pen) => pen.startPoint.index >= 4));
});

test("uses bodies for endpoints and wicks for volatility", () => {
  const data = candles([100, 101, 102, 103, 104]);
  data[0].open = 99.5;
  const pens = generateAutomaticPens(data);
  assert.equal(pens[0].startPoint.price, 99.5);
  assert.equal(pens[0].endPoint.price, 104);
  assert.equal(generateAutomaticPens(candles([100, 101, 102, 103, 104], 5)).length, 0);
});

test("true range includes gaps to the preceding close", () => {
  const data = candles([90, 100, 100.1, 100.2, 100.3, 100.4], 0.01);
  assert.equal(generateAutomaticPens(data, undefined, { startIndex: 1 }).length, 0);
});

test("flat prices and repeated extrema cannot create zero-length pens or fake elapsed spans", () => {
  assert.equal(generateAutomaticPens(candles(Array(20).fill(100), 0)).length, 0);
  const prices = [100, 101, 102, 103, 104, 102, 100, ...Array(20).fill(100)];
  assert.equal(generateAutomaticPens(candles(prices)).length, 1);
  const pens = generateAutomaticPens(candles([...prices, 99]));
  assert.equal(pens.length, 2);
  assert.equal(pens[1].endPoint.price, 99);
});

test("confirmed pens remain stable as future candles arrive and inputs stay unchanged", () => {
  const data = candles([100, 101, 102, 103, 104, 103, 102, 101, 100, 101, 102, 103, 104, 105, 104, 103, 102, 101]);
  const original = structuredClone(data);
  const full = generateAutomaticPens(data);
  for (let size = 1; size <= data.length; size++) {
    const partial = generateAutomaticPens(data.slice(0, size));
    assert.deepEqual(plain(partial.slice(0, -1)), plain(full.slice(0, Math.max(0, partial.length - 1))));
  }
  assert.deepEqual(data, original);
});

test("price scaling does not change pivot selection and the multiplier is adjustable", () => {
  const data = candles([100, 101, 102, 103, 104, 103, 102, 101, 100]);
  const scaled = data.map((candle) => ({
    ...candle, open: candle.open * 100, close: candle.close * 100,
    high: candle.high * 100, low: candle.low * 100,
  }));
  const times = (pens) => Array.from(pens, (pen) => [pen.startPoint.time, pen.endPoint.time]);
  assert.deepEqual(times(generateAutomaticPens(data)), times(generateAutomaticPens(scaled)));
  assert.equal(generateAutomaticPens(data, undefined, { minMoveAtrMultiple: 3 }).length, 0);
});

function hookHarness(initialData, visibleRange) {
  let data = initialData;
  const drawn = new Set();
  const chart = {
    timeScale: () => ({ getVisibleRange: () => visibleRange }),
    addSeries: () => {
      const series = { data: [], setData: (points) => { series.data = plain(points); } };
      drawn.add(series);
      return series;
    },
    removeSeries: (series) => drawn.delete(series),
  };
  const { useAutomaticPens: runHook } = loadModule("../../hooks/useAutomaticPens.ts", {
    react: { useCallback: (fn) => fn, useRef: (current) => ({ current }), useState: (value) => [value, () => {}] },
    "lightweight-charts": { LineSeries: {} },
    "@/components/market-master/automatic-pens": pensModule,
  });
  const hook = runHook({ chartRef: { current: chart }, seriesRef: { current: { data: () => data } } });
  return { hook, drawn, setData: (next) => { data = next; } };
}

test("enabled drawing can start with zero pens and later acquire its first pen", () => {
  const harness = hookHarness(candles([100, 101, 102, 103]), { from: 1, to: 4 });
  harness.hook.drawAutomaticPens();
  assert.equal(harness.drawn.size, 0);
  harness.setData(candles([100, 101, 102, 103, 104]));
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 1);
});

test("incremental drawing adds the first shallow pen when its fifteenth candle arrives", () => {
  const data = candles(Array.from({ length: 15 }, (_, i) => 100 + i * 0.01));
  const harness = hookHarness(data.slice(0, 14), { from: 1, to: 14 });
  harness.hook.drawAutomaticPens();
  assert.equal(harness.drawn.size, 0);
  harness.setData(data);
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 1);
  assert.deepEqual([...harness.drawn][0].data, [{ time: 1, value: 100 }, { time: 15, value: 100.14 }]);
});

test("updates preserve the initial drawing boundary and refresh same-bar prices", () => {
  const data = candles([...Array(100).fill(100), 100, 101, 102, 103, 104]);
  const harness = hookHarness(data, { from: 101, to: 105 });
  harness.hook.drawAutomaticPens();
  const originalSeries = [...harness.drawn][0];
  harness.setData([...data.slice(0, -1), ...candles([105], 1, 105)]);
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 1);
  assert.ok(harness.drawn.has(originalSeries));
  assert.deepEqual(originalSeries.data, [{ time: 101, value: 100 }, { time: 105, value: 105 }]);
});

test("drawing reconciles multiple new pens, removes invalidated lines, and stays cleared", () => {
  const harness = hookHarness(candles([100, 101, 102, 103, 104]), { from: 1, to: 5 });
  harness.hook.drawAutomaticPens();
  harness.setData(candles([100, 101, 102, 103, 104, 103, 102, 101, 100, 101, 102, 103, 104]));
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 3);
  harness.setData(candles([100, 101, 102, 103, 104]));
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 1);
  harness.hook.clearAutomaticPens();
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 0);
});
