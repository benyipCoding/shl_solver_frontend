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

const { calculateBollingerBands, calculateVolumeProfile, ShapePrimitive } = loadChartUtils();

test("volume profile selects covered candles and preserves total tick volume", () => {
  const result = calculateVolumeProfile([
    { time: 1, low: 100, high: 110, volume: 10 },
    { time: 2, low: 105, high: 115, volume: 20 },
    { time: 3, low: 110, high: 120, volume: 30 },
  ], 1, 2, 8);
  assert.equal(result.coveredCount, 2);
  assert.equal(result.bins.length, 8);
  assert.equal(Math.round(result.totalVolume), 30);
  assert.ok(result.pocIndex >= 0);
  assert.ok(result.valueAreaLowIndex >= 0);
  assert.ok(result.valueAreaHighIndex >= result.valueAreaLowIndex);
});

test("volume profile supports custom bin count and value-area percentage", () => {
  const result = calculateVolumeProfile([
    { time: 1, low: 100, high: 101, volume: 10 },
    { time: 2, low: 101, high: 102, volume: 20 },
    { time: 3, low: 102, high: 103, volume: 30 },
  ], 1, 3, 16, 100);
  assert.equal(result.bins.length, 16);
  assert.equal(result.valueAreaLowIndex, 0);
  assert.equal(result.valueAreaHighIndex, 15);
});

test("volume profile primitive refreshes when a line endpoint moves", () => {
  const profile = new ShapePrimitive({ time: 1, price: 100 }, { time: 2, price: 110 }, "volumeProfile");
  profile.setProfileCandles([
    { time: 1, low: 100, high: 110, volume: 10 },
    { time: 2, low: 105, high: 115, volume: 20 },
    { time: 3, low: 110, high: 120, volume: 30 },
  ]);
  assert.equal(profile.config.profile.coveredCount, 2);
  assert.equal(profile.config.profileSettings.binCount, 24);
  assert.equal(profile.config.profileSettings.showLevels, true);
  profile.updateConfig({
    profileSettings: {
      ...profile.config.profileSettings,
      binCount: 12,
      valueAreaPercent: 90,
      maxWidth: 220,
      showValueArea: false,
      showPoc: false,
      showLevels: false,
    },
  });
  profile.refreshVolumeProfile();
  assert.equal(profile.config.profile.bins.length, 12);
  assert.equal(profile.config.profileSettings.maxWidth, 220);
  assert.equal(profile.config.profileSettings.showLevels, false);
  profile.updatePoint(2, { time: 3, price: 120 });
  assert.equal(profile.config.profile.coveredCount, 3);
});

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

function paintedNote(shape) {
  const texts = [];
  const context = {
    fillRect() {},
    strokeRect() {},
    save() {},
    restore() {},
    measureText: (text) => ({ width: text.length * 8 }),
    fillText(text, x, y) { texts.push({ text, x, y, font: this.font, color: this.fillStyle }); },
  };
  shape.paneViews()[0].renderer().draw({
    useMediaCoordinateSpace: (draw) => draw({ context, mediaSize: { width: 800, height: 400 } }),
  });
  return texts;
}

test("zone notes default to white and stay visible inside the zone's top-left corner", () => {
  const zone = new ShapePrimitive({ time: 10, price: 120 }, { time: 20, price: 100 }, "zone");
  const viewport = attachShape(zone);
  assert.deepEqual(paintedNote(zone), []);
  zone.updateConfig({ noteText: "H8 阻力位\n第二行" });
  const [first, second] = paintedNote(zone);
  assert.equal(first.text, "H8 阻力位");
  assert.equal(first.color, "#ffffff");
  assert.match(first.font, /16px/);
  assert.deepEqual([first.x, first.y], [106, 286]);
  assert.equal(second.text, "第二行");
  assert.equal(second.y, 306);
  // Scrolling the zone start off-screen keeps the note pinned to the left edge.
  viewport.offset = 200;
  assert.equal(paintedNote(zone)[0].x, 6);
  zone.updateConfig({ noteColor: "#ff9800", noteFontSize: 24 });
  const [styled] = paintedNote(zone);
  assert.equal(styled.color, "#ff9800");
  assert.match(styled.font, /24px/);
});

test("shapes round-trip through their persisted snapshot", () => {
  const zone = new ShapePrimitive({ time: 10, price: 120 }, { time: 20, price: 100 }, "zone");
  zone.updateConfig({ color: "#ef5350", noteText: "H8 阻力位", noteFontSize: 20 });
  zone.setSelected(true);
  const snapshot = JSON.parse(JSON.stringify(zone.serialize()));
  assert.equal("isSelected" in snapshot.config, false);
  const restored = ShapePrimitive.deserialize(snapshot);
  assert.equal(restored.id, zone.id);
  assert.equal(restored.type, "zone");
  assert.equal(JSON.stringify([restored.p1, restored.p2]), JSON.stringify([zone.p1, zone.p2]));
  assert.equal(restored.config.color, "#ef5350");
  assert.equal(restored.config.noteText, "H8 阻力位");
  assert.equal(restored.config.noteFontSize, 20);
  assert.equal(restored.config.isSelected, false);

  const profile = new ShapePrimitive({ time: 2, price: 100 }, { time: 3, price: 110 }, "volumeProfile");
  profile.setProfileCandles([
    { time: 1, open: 1, close: 1, low: 100, high: 110, volume: 10 },
    { time: 2, open: 1, close: 1, low: 105, high: 115, volume: 20 },
    { time: 3, open: 1, close: 1, low: 110, high: 120, volume: 30 },
  ]);
  const profileSnapshot = JSON.parse(JSON.stringify(profile.serialize()));
  assert.equal("profile" in profileSnapshot.config, false);
  assert.equal(JSON.stringify(profileSnapshot.profileCandles), JSON.stringify([
    { time: 2, low: 105, high: 115, volume: 20 },
    { time: 3, low: 110, high: 120, volume: 30 },
  ]));
  const restoredProfile = ShapePrimitive.deserialize(profileSnapshot);
  assert.equal(restoredProfile.config.profile.coveredCount, 2);
  assert.equal(ShapePrimitive.deserialize({ type: "line" }), null);
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
