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
const xauCandles = JSON.parse(fs.readFileSync(new URL("./fixtures/xau-usd-h4-201701.json", import.meta.url), "utf8")).candles;
const unix = (date) => Date.parse(date) / 1000;

test("XAU/USD H4 reversal forms after the large Jan 5 candle without retracing its whole body", () => {
  const topTime = unix("2017-01-05T12:00:00Z");
  const firstDownTime = unix("2017-01-06T04:00:00Z");
  const bottomTime = unix("2017-01-06T16:00:00Z");
  const first = generateAutomaticPens(xauCandles.filter((candle) => candle.time <= firstDownTime));
  assert.equal(first.at(-1).trend, -1);
  assert.equal(first.at(-1).startPoint.time, topTime);
  assert.equal(first.at(-1).endPoint.time, firstDownTime);
  assert.equal(first.at(-1).endPoint.price, 1174.825);
  const atBottom = generateAutomaticPens(xauCandles.filter((candle) => candle.time <= bottomTime));
  const down = atBottom.at(-1);
  assert.equal(down.trend, -1);
  assert.equal(down.startPoint.time, topTime);
  assert.equal(down.startPoint.price, 1181.47);
  assert.equal(down.endPoint.time, bottomTime);
  assert.equal(down.endPoint.price, 1172.305);
  assert.equal(down.endPoint.index - down.startPoint.index + 1, 8);
  assert.deepEqual(atBottom.at(-2).endPoint, down.startPoint);
  const later = generateAutomaticPens(xauCandles);
  assert.deepEqual(later.find((pen) => pen.trend === -1 && pen.startPoint.time === topTime), down);
});

test("a reversal inside the endpoint candle body is recognized symmetrically in either direction", () => {
  const bodies = [[100, 101], [101, 102], [102, 103], [103, 104], [104, 120],
    [120, 119], [119, 118], [118, 117], [117, 116]];
  for (const direction of [1, -1]) {
    const data = bodies.map(([open, close], index) => ({ time: index + 1, open: direction * open, close: direction * close }));
    assert.equal(generateAutomaticPens(data.slice(0, -1)).length, 1);
    const pens = generateAutomaticPens(data);
    assert.equal(pens.length, 2);
    assert.equal(pens[1].trend, -direction);
    assert.equal(pens[1].startPoint.price, direction * 120);
    assert.equal(pens[1].endPoint.price, direction * 116);
    assert.deepEqual(pens[0].endPoint, pens[1].startPoint);
  }
});

test("a new trend endpoint clears all reversal candidates from before that endpoint", () => {
  const bodies = [[100, 101], [101, 102], [102, 103], [103, 104], [104, 120],
    [120, 110], [110, 115], [115, 130], [130, 129], [129, 128], [128, 127], [127, 126]];
  for (const direction of [1, -1]) {
    const data = bodies.map(([open, close], index) => ({ time: index + 1, open: direction * open, close: direction * close }));
    assert.equal(generateAutomaticPens(data.slice(0, -1)).length, 1);
    const pens = generateAutomaticPens(data);
    assert.equal(pens.length, 2);
    assert.equal(pens[1].startPoint.index, 7);
    assert.equal(pens[1].endPoint.index, 11);
  }
});

test("an outside candle extends the established trend without seeding a same-candle reversal", () => {
  const bodies = [[100, 101], [101, 102], [102, 103], [103, 104], [104, 120],
    [90, 125], [125, 124], [124, 123], [123, 122], [122, 121]];
  for (const direction of [1, -1]) {
    const data = bodies.map(([open, close], index) => ({ time: index + 1, open: direction * open, close: direction * close }));
    const extended = generateAutomaticPens(data.slice(0, 6));
    assert.equal(extended.length, 1);
    assert.equal(extended[0].endPoint.index, 5);
    assert.equal(extended[0].endPoint.price, direction * 125);
    const pens = generateAutomaticPens(data);
    assert.equal(pens.length, 2);
    assert.equal(pens[1].startPoint.index, 5);
    assert.equal(pens[1].endPoint.index, 9);
  }
});

test("confirmed pens on the real H4 fixture do not change as later candles arrive", () => {
  const full = generateAutomaticPens(xauCandles);
  for (let size = 1; size <= xauCandles.length; size++) {
    const partial = generateAutomaticPens(xauCandles.slice(0, size));
    assert.deepEqual(plain(partial.slice(0, -1)), plain(full.slice(0, Math.max(0, partial.length - 1))));
    for (const [index, pen] of partial.entries()) {
      assert.ok(pen.endPoint.index - pen.startPoint.index + 1 >= 5);
      assert.ok(pen.trend * (pen.endPoint.price - pen.startPoint.price) > 0);
      if (index > 0) assert.deepEqual(partial[index - 1].endPoint, pen.startPoint);
    }
  }
});

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

test("逐 K drawing includes the previously missing XAU/USD downward pen", () => {
  const initialCount = xauCandles.findIndex((candle) => candle.time === unix("2017-01-05T12:00:00Z")) + 1;
  const harness = hookHarness(xauCandles.slice(0, initialCount), { from: xauCandles[0].time, to: xauCandles[initialCount - 1].time });
  harness.hook.drawAutomaticPens();
  for (let count = initialCount + 1; count <= xauCandles.length; count++) {
    harness.setData(xauCandles.slice(0, count));
    harness.hook.updateAutomaticPensAfterCandle();
  }
  const drawn = Array.from(harness.drawn, (series) => series.data);
  assert.ok(drawn.some((points) => points[0].time === unix("2017-01-05T12:00:00Z") && points[1].time === unix("2017-01-06T16:00:00Z")));
  assert.deepEqual(drawn, plain(generateAutomaticPens(xauCandles).map((pen) => [
    { time: pen.startPoint.time, value: pen.startPoint.price },
    { time: pen.endPoint.time, value: pen.endPoint.price },
  ])));
});
