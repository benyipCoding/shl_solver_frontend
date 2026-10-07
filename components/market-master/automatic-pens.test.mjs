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

test("tiny moves form a pen on the fifth candle in either direction, without an amplitude threshold", () => {
  for (const direction of [1, -1]) {
    const data = candles(Array.from({ length: 5 }, (_, i) => 100 + direction * i * 0.01), 50);
    assert.equal(generateAutomaticPens(data.slice(0, 4)).length, 0);
    const pens = generateAutomaticPens(data);
    assert.equal(pens.length, 1);
    assert.equal(pens[0].trend, direction);
    assert.equal(pens[0].startPoint.index, 0);
    assert.equal(pens[0].endPoint.index, 4);
  }
});

test("a shallow reverse move forms a reverse pen once its extrema span five candles", () => {
  for (const direction of [1, -1]) {
    const data = candles([
      ...Array.from({ length: 5 }, (_, i) => 100 + direction * i),
      ...Array.from({ length: 4 }, (_, i) => 100 + direction * (4 - (i + 1) * 0.01)),
    ]);
    assert.equal(generateAutomaticPens(data.slice(0, -1)).length, 1);
    const pens = generateAutomaticPens(data);
    assert.equal(pens.length, 2);
    assert.deepEqual(pens[0].endPoint, pens[1].startPoint);
    assert.equal(pens[1].trend, -direction);
    assert.equal(pens[1].endPoint.index - pens[1].startPoint.index + 1, 5);
  }
});

test("body endpoints are independent of wicks, gaps before the input, and candle colors", () => {
  const data = [[100, 100.05], [100.12, 100.1], [100.2, 100.25], [100.32, 100.3], [100.4, 100.45]]
    .map(([open, close], index) => ({ time: index + 1, open, close }));
  const pens = generateAutomaticPens(data);
  assert.equal(pens.length, 1);
  assert.equal(pens[0].startPoint.price, 100);
  assert.equal(pens[0].endPoint.price, 100.45);
  assert.deepEqual(plain(generateAutomaticPens(data.map((candle) => ({ ...candle, high: 10000, low: -10000 })))), plain(pens));
});

test("restores the legacy new-high-before-new-low order on an outside candle", () => {
  const data = [[100, 102], [101, 103], [102, 104], [103, 105], [99, 106]]
    .map(([open, close], index) => ({ time: index + 1, open, close }));
  const pens = generateAutomaticPens(data);
  assert.equal(pens.length, 1);
  assert.equal(pens[0].startPoint.price, 100);
  assert.equal(pens[0].startPoint.index, 0);
  assert.equal(pens[0].endPoint.price, 106);
  assert.equal(pens[0].endPoint.index, 4);
});

test("same-direction new extrema extend the final unconfirmed pen; equality does not move it", () => {
  const data = candles([100, 101, 102, 103, 104, 104, 104, 105, 105]);
  const pens = generateAutomaticPens(data);
  assert.equal(pens.length, 1);
  assert.equal(pens[0].endPoint.price, 105);
  assert.equal(pens[0].endPoint.index, 7);
});

test("the minimum span remains configurable independently of price movement", () => {
  const data = candles(Array.from({ length: 6 }, (_, i) => 100 + i * 0.01));
  assert.equal(generateAutomaticPens(data.slice(0, 5), 6).length, 0);
  assert.equal(generateAutomaticPens(data, 6).length, 1);
});

test("empty, single-candle and unchanged prices do not form pens", () => {
  for (const data of [[], candles([100]), candles(Array(120).fill(100))]) {
    assert.equal(generateAutomaticPens(data).length, 0);
  }
});

test("a quick reversal cannot gain an extrema span merely by waiting at the same price", () => {
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
  assert.deepEqual(Array.from(full, (pen) => pen.trend), [1, -1, 1, -1]);
  for (let size = 1; size <= data.length; size++) {
    const partial = generateAutomaticPens(data.slice(0, size));
    assert.deepEqual(plain(partial.slice(0, -1)), plain(full.slice(0, Math.max(0, partial.length - 1))));
  }
  assert.deepEqual(data, original);
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

test("incremental drawing adds the first shallow pen when its fifth candle arrives", () => {
  const data = candles(Array.from({ length: 5 }, (_, i) => 100 + i * 0.01));
  const harness = hookHarness(data.slice(0, 4), { from: 1, to: 4 });
  harness.hook.drawAutomaticPens();
  assert.equal(harness.drawn.size, 0);
  harness.setData(data);
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 1);
  assert.deepEqual([...harness.drawn][0].data, [{ time: 1, value: 100 }, { time: 5, value: 100.04 }]);
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
