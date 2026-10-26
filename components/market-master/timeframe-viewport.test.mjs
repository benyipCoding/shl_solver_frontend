import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const load = (file, require = () => ({})) => {
  const target = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: target.exports, module: target, require });
  return target.exports;
};
const chartWindow = load("./chart-window.ts");
const {
  captureTimeframeViewportAnchor,
  resolveTimeframeViewportRange,
  timeframeViewportIsLoaded,
} = load("./timeframe-viewport.ts", () => chartWindow);

const DAY = 86400, H4 = 14400;
const bars = (start, step, count) => Array.from({ length: count }, (_, i) => ({ time: start + i * step }));
const JUN_15 = Date.UTC(2026, 5, 15) / 1000;
const capture = (data, logical, extra = {}) => captureTimeframeViewportAnchor({
  data, count: data.length, windowFrom: 0, logical,
  sourceSymbol: "XAU/USD", sourceTimeframe: "D1", sourceBarSeconds: DAY, ...extra,
});

test("D1 -> H4 keeps the date at the centre of the chart and the candle width", () => {
  const d1 = bars(JUN_15 - 400 * DAY, DAY, 500); // newest bar is far right of the view
  const center = d1.findIndex((bar) => bar.time === JUN_15);
  const anchor = capture(d1, { from: center - 60, to: center + 60 });
  assert.equal(anchor.barSpan, 120);
  assert.equal(anchor.anchorTime, JUN_15 + DAY / 2);

  const h4 = bars(JUN_15 - 3000 * H4, H4, 6000);
  const range = resolveTimeframeViewportRange(h4, h4.length, anchor);
  const middle = h4[(range.from + range.to) / 2];
  assert.equal(middle.time, JUN_15 + 12 * 3600); // 2026-06-15 12:00, inside the source day
  assert.equal(range.to - range.from, 120);
});

test("H4 -> D1 lands on the H4 bar's own day, not the next one", () => {
  const h4 = bars(JUN_15 - 1000 * H4, H4, 2000);
  const center = h4.findIndex((bar) => bar.time === JUN_15 + 20 * 3600); // 06-15 20:00
  const anchor = capture(h4, { from: center - 50, to: center + 50 }, { sourceTimeframe: "H4", sourceBarSeconds: H4 });
  const d1 = bars(JUN_15 - 300 * DAY, DAY, 600);
  const range = resolveTimeframeViewportRange(d1, d1.length, anchor);
  assert.equal(d1[(range.from + range.to) / 2].time, JUN_15);
});

test("a wide view that also shows the newest bar still anchors on its centre, not the newest bar", () => {
  // Regression seen in the browser: D1 showing ~400 bars up to today, centre
  // 2026-01-25, switched to H4 and landed on the latest bars.
  const d1 = bars(JUN_15 - 299 * DAY, DAY, 300);
  const anchor = capture(d1, { from: -100, to: 304 });
  const centre = d1[Math.round((-100 + 304) / 2)].time;
  const h4 = bars(d1[0].time - 3000 * H4, H4, 4800);
  const range = resolveTimeframeViewportRange(h4, h4.length, anchor);
  assert.equal(h4[(range.from + range.to) / 2].time, centre + 12 * 3600);
});

test("H4 at today -> D1 ends at the newest bar instead of leaving half the chart empty", () => {
  const d1 = bars(JUN_15, DAY, 300);
  const anchor = { sourceSymbol: "X", sourceTimeframe: "H4", anchorTime: d1[290].time + 7200, barSpan: 200 };
  assert.deepEqual({ ...resolveTimeframeViewportRange(d1, d1.length, anchor) }, { from: 104, to: 304 });
});

test("backtest never shows unrevealed bars and keeps the anchor on screen", () => {
  const h4 = bars(JUN_15, H4, 1000);
  const anchor = { sourceSymbol: "X", sourceTimeframe: "D1", anchorTime: h4[900].time, barSpan: 100 };
  const range = resolveTimeframeViewportRange(h4, 600, anchor); // only 600 revealed
  assert.deepEqual({ ...range }, { from: 504, to: 604 });
  const inside = resolveTimeframeViewportRange(h4, 600, { ...anchor, anchorTime: h4[300].time });
  assert.equal((inside.from + inside.to) / 2, 300);
});

test("extreme spans are clamped to fit the bounded chart window", () => {
  const data = bars(0, 60, 50000);
  const anchor = { sourceSymbol: "X", sourceTimeframe: "D1", anchorTime: data[25000].time, barSpan: 30000 };
  const range = resolveTimeframeViewportRange(data, data.length, anchor);
  assert.ok(range.to - range.from <= chartWindow.CHART_WINDOW_BARS - 2 * chartWindow.CHART_WINDOW_EDGE);
});

test("a realtime snapshot that starts after the anchor must page back before restoring", () => {
  const snapshot = bars(JUN_15 + 100 * DAY, H4, 256);
  const anchor = { sourceSymbol: "X", sourceTimeframe: "D1", anchorTime: JUN_15, barSpan: 120 };
  assert.equal(timeframeViewportIsLoaded(snapshot, anchor, true), false);
  const loaded = bars(JUN_15 - 30 * H4, H4, 2000);
  assert.equal(timeframeViewportIsLoaded(loaded, anchor, true), false); // too few bars left of centre
  assert.equal(timeframeViewportIsLoaded(bars(JUN_15 - 80 * H4, H4, 2000), anchor, true), true);
  assert.equal(timeframeViewportIsLoaded(snapshot, anchor, false), true); // nothing older exists
});
