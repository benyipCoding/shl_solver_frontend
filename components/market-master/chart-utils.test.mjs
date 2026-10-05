import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const componentDir = path.dirname(fileURLToPath(import.meta.url));

function loadChartUtils() {
  const target = { exports: {} };
  const source = fs.readFileSync(path.join(componentDir, "chart-utils.ts"), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports: target.exports,
    module: target,
    require: (name) => {
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return target.exports;
}

const { calculateBollingerBands, ShapePrimitive } = loadChartUtils();

function attachShape(shape) {
  const viewport = { width: 800, offset: 0, spacing: 10 };
  shape.attached({
    chart: { timeScale: () => ({
      width: () => viewport.width,
      timeToCoordinate: (time) => time * viewport.spacing - viewport.offset,
    }) },
    series: { priceToCoordinate: (price) => 400 - price },
    requestUpdate() {},
  });
  return viewport;
}

function paintedRectangle(shape) {
  let rect;
  const context = {
    fillRect: (...args) => { rect = args; },
    strokeRect() {},
  };
  shape.paneViews()[0].renderer().draw({
    useMediaCoordinateSpace: (draw) => draw({ context }),
    useBitmapCoordinateSpace: () => assert.fail("CSS geometry must not use bitmap pixels on high-DPI screens"),
  });
  return rect;
}

test("manual zones follow the right edge as candles advance, the chart zooms and the pane resizes", () => {
  const zone = new ShapePrimitive({ time: 10, price: 120 }, { time: 20, price: 100 }, "zone");
  const viewport = attachShape(zone);
  assert.deepEqual(paintedRectangle(zone), [100, 280, 700, 20]);
  // New bars pan the starting candle left; the zone still covers the newest bars.
  viewport.offset = 200;
  assert.deepEqual(paintedRectangle(zone), [-100, 280, 900, 20]);
  viewport.width = 1000;
  viewport.spacing = 20;
  viewport.offset = 150;
  assert.deepEqual(paintedRectangle(zone), [50, 280, 950, 20]);
  assert.equal(zone.p1.time, 10);
  assert.equal(zone.p1.price, 120);
  assert.equal(zone.p2.price, 100);
});

test("manual zone handles edit prices and start time without creating a finite right endpoint", () => {
  const zone = new ShapePrimitive({ time: 10, price: 100 }, { time: 10, price: 100 }, "zone");
  attachShape(zone);
  zone.updatePoint(2, { time: 50, price: 120 });
  assert.deepEqual(paintedRectangle(zone), [100, 280, 700, 20]);
  zone.updatePoint(4, { time: 60, price: 90 });
  assert.equal(zone.p1.time, 10);
  assert.deepEqual(paintedRectangle(zone), [100, 280, 700, 30]);
  zone.updatePoint(3, { time: 20, price: 130 });
  assert.deepEqual(paintedRectangle(zone), [200, 270, 600, 40]);
  zone.updatePoint(1, { time: 25, price: 100 });
  zone.updatePoint(2, { time: 25, price: 140 });
  assert.deepEqual(paintedRectangle(zone), [250, 260, 550, 40]);
});

test("ordinary rectangles retain finite endpoints and zones never extend backwards before their start", () => {
  const rectangle = new ShapePrimitive({ time: 10, price: 120 }, { time: 20, price: 100 }, "rectangle");
  const viewport = attachShape(rectangle);
  assert.deepEqual(paintedRectangle(rectangle), [100, 280, 100, 20]);
  viewport.width = 1000;
  assert.deepEqual(paintedRectangle(rectangle), [100, 280, 100, 20]);
  const zone = new ShapePrimitive({ time: 90, price: 120 }, { time: 90, price: 100 }, "zone");
  attachShape(zone);
  assert.equal(zone.paneViews()[0].renderer(), null);
});

test("calculates a 20-period SMA with two population standard deviations", () => {
  const data = Array.from({ length: 21 }, (_, index) => ({
    time: index + 1,
    close: index + 1,
  }));
  const bands = calculateBollingerBands(data, 20, 2);

  assert.equal(bands[18].middle, null);
  assert.equal(bands[19].middle, 10.5);
  assert.ok(Math.abs(bands[19].upper - 22.032562594670797) < 1e-12);
  assert.ok(Math.abs(bands[19].lower - -1.0325625946707966) < 1e-12);
  assert.equal(bands[20].middle, 11.5);
});

test("applies a configurable standard-deviation multiplier", () => {
  const data = [1, 2, 3].map((close, index) => ({
    time: index + 1,
    close,
  }));
  const [first, second, third] = calculateBollingerBands(data, 3, 1);

  assert.equal(first.middle, null);
  assert.equal(second.middle, null);
  assert.equal(third.middle, 2);
  assert.ok(Math.abs(third.upper - (2 + Math.sqrt(2 / 3))) < 1e-12);
  assert.ok(Math.abs(third.lower - (2 - Math.sqrt(2 / 3))) < 1e-12);
});
