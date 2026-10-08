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

test("a new trend endpoint restarts the five-candle reversal span", () => {
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

test("a shallow reverse move forms a reverse pen once its endpoints span five candles", () => {
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

test("preserves the initial up-before-down priority on an outside candle", () => {
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

test("the first pen forms on candle five without a fresh body extreme", () => {
  for (const direction of [1, -1]) {
    for (const last of [102, 103]) {
      const data = candles([100, 103, 102, 101, last].map((price) => direction * price));
      assert.equal(generateAutomaticPens(data.slice(0, 4)).length, 0);
      const [pen] = generateAutomaticPens(data);
      assert.equal(pen.trend, direction);
      assert.equal(pen.startPoint.index, 0);
      assert.equal(pen.endPoint.index, 4);
      assert.equal(pen.endPoint.price, direction * last);
    }
  }
});

test("reversals form on candle five at an equal or recovered price, without backdating the endpoint", () => {
  for (const direction of [1, -1]) {
    for (const last of [100, 102]) {
      const prices = [100, 101, 102, 103, 104, 102, 100, 101, last];
      const data = candles(prices.map((price) => direction * price));
      assert.equal(generateAutomaticPens(data.slice(0, 8)).length, 1);
      const pens = generateAutomaticPens(data);
      assert.equal(pens.length, 2);
      assert.equal(pens[1].trend, -direction);
      assert.equal(pens[1].startPoint.index, 4);
      assert.equal(pens[1].endPoint.index, 8);
      assert.equal(pens[1].endPoint.price, direction * last);
      const extended = generateAutomaticPens([...data, ...candles([direction * 99], 1, 10)]);
      assert.equal(extended.length, 2);
      assert.equal(extended[1].endPoint.price, direction * 99);
    }
  }
});

test("waiting at the current endpoint cannot form a zero-height reverse pen", () => {
  for (const direction of [1, -1]) {
    const data = candles([100, 101, 102, 103, 104, ...Array(20).fill(104)].map((price) => direction * price));
    assert.equal(generateAutomaticPens(data).length, 1);
  }
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

function hookHarness(initialData, visibleRange, source) {
  let data = initialData;
  const drawn = new Set();
  const viewportListeners = new Set();
  const dataListeners = new Set();
  const stats = { reads: 0, writes: 0, creates: 0, count: 0 };
  const timeScale = {
    getVisibleRange: () => visibleRange,
    logicalToCoordinate: (index) => index * 10,
    subscribeVisibleTimeRangeChange: (listener) => viewportListeners.add(listener),
    unsubscribeVisibleTimeRangeChange: (listener) => viewportListeners.delete(listener),
  };
  const chart = {
    timeScale: () => timeScale,
    addSeries: () => assert.fail("automatic pens must not create chart series"),
  };
  const { useAutomaticPens: runHook } = loadModule("../../hooks/useAutomaticPens.ts", {
    react: { useCallback: (fn) => fn, useRef: (current) => ({ current }), useState: (value) => [value, (count) => { stats.count = count; }] },
    "lightweight-charts": { LineSeries: {} },
    "@/components/market-master/automatic-pens": pensModule,
    "@/components/market-master/chart-window": loadModule("./chart-window.ts"),
    "@/components/market-master/automatic-pens-primitive": {
      AutomaticPensPrimitive: class {
        constructor(project) { stats.project = project; }
        data = [];
        setPens(pens) {
          stats.writes++;
          this.data = plain(pens.length ? [
            { time: pens[0].startPoint.time, value: pens[0].startPoint.price },
            ...pens.map((pen) => ({ time: pen.endPoint.time, value: pen.endPoint.price })),
          ] : []);
        }
      },
    },
  });
  const hook = runHook({ source, chartRef: { current: chart }, seriesRef: { current: {
    data: () => { stats.reads++; return data; },
    dataByIndex: (index) => data[index],
    subscribeDataChanged: (listener) => dataListeners.add(listener),
    unsubscribeDataChanged: (listener) => dataListeners.delete(listener),
    attachPrimitive: (primitive) => { stats.creates++; drawn.add(primitive); },
    detachPrimitive: (primitive) => drawn.delete(primitive),
  } } });
  return {
    hook, drawn, stats, viewportListeners, dataListeners,
    legs: () => [...drawn].flatMap((series) => series.data.slice(1).map((point, index) => [series.data[index], point])),
    setData: (next) => { data = next; },
    replaceData: (next) => { data = next; dataListeners.forEach((fn) => fn("full")); },
    append: (candle) => { data.push(candle); dataListeners.forEach((fn) => fn("update")); hook.updateAutomaticPensAfterCandle(candle); },
    pan: (range) => { visibleRange = range; viewportListeners.forEach((fn) => fn(range)); },
  };
}

test("enabled drawing can start with zero pens and later acquire its first pen", () => {
  const harness = hookHarness(candles([100, 101, 102, 103]), { from: 1, to: 4 });
  harness.hook.drawAutomaticPens();
  assert.equal(harness.legs().length, 0);
  harness.setData(candles([100, 101, 102, 103, 104]));
  harness.hook.updateAutomaticPensAfterCandle();
  assert.equal(harness.drawn.size, 1);
});

test("bounded chart swaps preserve full pen geometry after a suppressed bulk advance", () => {
  const data = waveCandles(20000);
  let count = 10;
  const h = hookHarness(data.slice(0, count), { from: 1, to: 10 }, () => ({ candles: data, count }));
  h.hook.drawAutomaticPens();
  const writes = h.stats.writes;
  for (let i = count; i < data.length; i++) {
    count = i + 1;
    h.hook.updateAutomaticPensAfterCandle(data[i], false);
  }
  assert.equal(h.stats.writes, writes);
  h.replaceData(data.slice(-5000));
  assert.equal(h.stats.project(data[0].time), -150000); // The long-pen endpoint may be outside setData.
  h.pan({ from: 19000, to: 20000 });
  const latest = h.legs();
  assert.ok(latest.length > 0);
  h.replaceData(data.slice(0, 5000));
  h.pan({ from: 1, to: 1000 });
  assert.ok(h.legs().length > 0);
  assert.ok(h.legs()[0][0].time < 1000);
  h.replaceData(data.slice(-5000));
  h.pan({ from: 19000, to: 20000 });
  assert.deepEqual(h.legs(), latest);
  assert.equal(h.stats.reads, 1);
});

test("retaining six strategy pens preserves endpoints and cumulative formation counts", () => {
  const full = pensModule.createAutomaticPenGenerator();
  const bounded = pensModule.createAutomaticPenGenerator(undefined, 6);
  for (const candle of waveCandles(20000)) {
    full.append(candle); bounded.append(candle);
    assert.equal(bounded.totalPens, full.pens.length);
    assert.ok(bounded.pens.length <= 6);
    assert.deepEqual(plain(bounded.pens), plain(full.pens.slice(-6)));
  }
});

test("incremental drawing adds the first shallow pen when its fifth candle arrives", () => {
  const data = candles(Array.from({ length: 5 }, (_, i) => 100 + i * 0.01));
  const harness = hookHarness(data.slice(0, 4), { from: 1, to: 4 });
  harness.hook.drawAutomaticPens();
  assert.equal(harness.legs().length, 0);
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
  assert.equal(harness.legs().length, 3);
  assert.equal(harness.drawn.size, 1);
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
  const drawn = harness.legs();
  assert.ok(drawn.some((points) => points[0].time === unix("2017-01-05T12:00:00Z") && points[1].time === unix("2017-01-06T16:00:00Z")));
  assert.deepEqual(drawn, plain(generateAutomaticPens(xauCandles).map((pen) => [
    { time: pen.startPoint.time, value: pen.startPoint.price },
    { time: pen.endPoint.time, value: pen.endPoint.price },
  ])));
});

const waveCandles = (count) => candles(Array.from({ length: count }, (_, index) => 100 + (index % 8 <= 4 ? index % 8 : 8 - index % 8)));
const penLines = (pens) => plain(pens.map((pen) => [
  { time: pen.startPoint.time, value: pen.startPoint.price },
  { time: pen.endPoint.time, value: pen.endPoint.price },
]));

test("streaming generator matches every batch prefix and does not mutate past snapshots", () => {
  for (const data of [xauCandles, waveCandles(300)]) {
    const generator = pensModule.createAutomaticPenGenerator();
    for (let index = 0; index < data.length; index++) {
      const before = [...generator.pens];
      const snapshot = plain(before);
      generator.append(data[index]);
      assert.deepEqual(plain(before), snapshot);
      assert.deepEqual(plain(generator.pens), plain(generateAutomaticPens(data.slice(0, index + 1))));
    }
  }
});

test("20,000 playback candles use one bounded overlay without rereading history; panning restores old geometry", () => {
  const data = waveCandles(20000);
  const harness = hookHarness(data.slice(0, 5), { from: 1, to: 5 });
  harness.hook.drawAutomaticPens();
  const initialReads = harness.stats.reads;
  for (let index = 5; index < data.length; index++) {
    harness.pan({ from: Math.max(1, index - 400), to: index + 1 });
    harness.append(data[index]);
    assert.ok(harness.stats.count <= pensModule.AUTOMATIC_PENS_MAX_VISIBLE);
    assert.ok([...harness.drawn][0].data.length <= pensModule.AUTOMATIC_PENS_MAX_VISIBLE + 1);
  }
  assert.equal(harness.stats.reads, initialReads);
  assert.equal(harness.stats.creates, 1);
  assert.equal(harness.drawn.size, 1);
  const allPens = generateAutomaticPens(data);
  const range = { from: 101, to: 301 };
  harness.pan(range);
  assert.equal(harness.stats.reads, initialReads);
  assert.deepEqual(harness.legs(), penLines(pensModule.selectAutomaticPensForViewport(allPens, range)));
  assert.ok(harness.legs().at(-1)[1].time < 500);
  harness.pan({ from: 1, to: 20000 });
  assert.equal(harness.stats.count, pensModule.AUTOMATIC_PENS_MAX_VISIBLE);
  assert.equal(harness.legs().at(-1)[1].time, allPens.at(-1).endPoint.time);
});

test("offscreen tail changes do not rewrite the historical viewport", () => {
  const data = waveCandles(1000);
  const harness = hookHarness(data.slice(0, 999), { from: 1, to: 999 });
  harness.hook.drawAutomaticPens();
  harness.pan({ from: 1, to: 10 });
  const writes = harness.stats.writes;
  harness.append(data[999]);
  assert.equal(harness.stats.writes, writes);
});

test("viewport selection includes a long pen crossing the whole viewport", () => {
  const pens = generateAutomaticPens(candles(Array.from({ length: 10000 }, (_, index) => index)));
  assert.equal(pens.length, 1);
  assert.deepEqual(plain(pensModule.selectAutomaticPensForViewport(pens, { from: 500, to: 600 })), plain(pens));
});

test("initial offscreen revealed candles are caught up before taking the append path", () => {
  const data = waveCandles(100);
  const harness = hookHarness(data.slice(0, 99), { from: 1, to: 5 });
  harness.hook.drawAutomaticPens();
  assert.equal(harness.legs().length, 1);
  harness.append(data[99]);
  harness.pan({ from: 1, to: 100 });
  assert.deepEqual(harness.legs(), penLines(generateAutomaticPens(data)));
});

test("data replacement, same-bar correction, prepend and rewind keep the original start boundary", () => {
  const data = waveCandles(30);
  const harness = hookHarness(data.slice(10), { from: 11, to: 30 });
  harness.hook.drawAutomaticPens();
  harness.replaceData(data);
  assert.deepEqual(harness.legs(), penLines(generateAutomaticPens(data.slice(10))));
  const edited = { ...data.at(-1), open: 110, close: 111 };
  harness.setData([...data.slice(0, -1), edited]);
  harness.hook.updateAutomaticPensAfterCandle(edited);
  assert.deepEqual(harness.legs(), penLines(generateAutomaticPens([...data.slice(10, -1), edited])));
  harness.replaceData(data.slice(0, 15));
  assert.deepEqual(harness.legs(), penLines(generateAutomaticPens(data.slice(10, 15))));
  harness.replaceData([]);
  assert.equal(harness.legs().length, 0);
  assert.equal(harness.stats.count, 0);
});

test("redraw, clear and chart reset release viewport/data subscriptions", () => {
  const harness = hookHarness(waveCandles(1000), { from: 1, to: 1000 });
  harness.hook.drawAutomaticPens();
  harness.hook.drawAutomaticPens();
  assert.equal(harness.drawn.size, 1);
  assert.equal(harness.viewportListeners.size, 1);
  assert.equal(harness.dataListeners.size, 1);
  harness.hook.clearAutomaticPens();
  assert.equal(harness.viewportListeners.size, 0);
  assert.equal(harness.dataListeners.size, 0);
  assert.equal(harness.drawn.size, 0);
  harness.pan({ from: 100, to: 200 });
  assert.equal(harness.drawn.size, 0);
  harness.hook.drawAutomaticPens();
  harness.hook.resetAutomaticPensState();
  assert.equal(harness.drawn.size, 0);
  assert.equal(harness.viewportListeners.size, 0);
  assert.equal(harness.dataListeners.size, 0);
});

test("overlay projects pen endpoints and requests redraws without changing chart data", () => {
  const { AutomaticPensPrimitive } = loadModule("./automatic-pens-primitive.ts", { "./automatic-pens": pensModule });
  const primitive = new AutomaticPensPrimitive();
  const commands = [];
  let updates = 0;
  primitive.attached({
    chart: { timeScale: () => ({ timeToCoordinate: (time) => time * 10 }) },
    series: { priceToCoordinate: (price) => 1000 - price * 2 },
    requestUpdate: () => updates++,
  });
  primitive.setPens(generateAutomaticPens(candles([100, 101, 102, 103, 104, 103, 102, 101, 100])));
  const context = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    moveTo: (x, y) => commands.push(["move", x, y]),
    lineTo: (x, y) => commands.push(["line", x, y]),
  };
  const draw = () => primitive.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (fn) => fn({ context }) });
  draw();
  assert.deepEqual(commands, [["move", 10, 800], ["line", 50, 792], ["move", 50, 792], ["line", 90, 800]]);
  assert.equal(context.lineWidth, 2);
  assert.equal(context.strokeStyle, "#ffff00");
  assert.equal(updates, 2);
  primitive.detached();
  commands.length = 0;
  draw();
  assert.equal(commands.length, 0);
});
