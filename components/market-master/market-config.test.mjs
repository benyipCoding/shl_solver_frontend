import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("./market-config.ts", import.meta.url), "utf8");
const target = { exports: {} };
const storage = new Map();
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText,
  {
    exports: target.exports,
    module: target,
    window: {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  }
);
const {
  createDefaultIndicatorConfig, cloneIndicatorConfig,
  loadPersistedIndicatorConfig, persistIndicatorConfig, isCrosshairRefreshEcho,
  replaceMacdSeriesData,
} = target.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("M1 is available only in realtime while every other timeframe stays available", () => {
  const { getTimeframeOptions, getIntervalByTimeframe } = target.exports;
  const history = plain(getTimeframeOptions("history"));
  const realtime = plain(getTimeframeOptions("realtime"));
  assert.equal(history[0].value, "m5");
  assert.equal(realtime[0].value, "m1");
  assert.deepEqual(history, realtime.slice(1));
  assert.equal(getIntervalByTimeframe("m1"), "1min");
});

test("saved M1 restores as M5 in history and remains M1 in realtime", () => {
  const { persistLastTimeframe, resolveLastTimeframe, LAST_TIMEFRAME_STORAGE_KEY } = target.exports;
  persistLastTimeframe("m1");
  assert.equal(resolveLastTimeframe(), "m5");
  assert.equal(resolveLastTimeframe("realtime"), "m1");
  persistLastTimeframe("H4");
  assert.equal(resolveLastTimeframe(), "H4");
  storage.set(LAST_TIMEFRAME_STORAGE_KEY, "invalid");
  assert.equal(resolveLastTimeframe(), "D1");
  storage.delete(LAST_TIMEFRAME_STORAGE_KEY);
});

// Exercise the real mode/replay handlers: filtering the dropdown alone would
// still allow a live M1 selection or an old saved replay to request history M1.
const pageSource = fs.readFileSync(new URL("./MarketMasterPage.tsx", import.meta.url), "utf8");
const pageAst = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function pageHandler(name, context) {
  let handler;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(pageAst) === name) {
      handler = node.initializer.arguments[0].getText(pageAst);
    }
    ts.forEachChild(node, visit);
  }
  visit(pageAst);
  assert.ok(handler, `missing ${name}`);
  return vm.runInNewContext(ts.transpileModule(`(${handler})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, { ...target.exports, ...context });
}

test("switching from realtime M1 changes the timeframe before enabling history", () => {
  const changes = [];
  const context = {
    timeframeRef: { current: "m1" }, dataModeRef: { current: "realtime" },
    pendingTimeframeViewportRef: { current: {} }, pendingBacktestTimeframeChangeRef: { current: {} },
    pendingReplayRef: { current: null },
    setManagedTradeId() {}, setBrokerCloseAll() {}, setPendingTradeClose() {},
    setReplayingSessionId() {}, setIsBacktestHistoryOpen() {},
    setTimeframe: (value) => changes.push(["timeframe", value]),
    setDataMode: (value) => changes.push(["mode", value]),
  };
  const apply = pageHandler("applyMarketChange", context);
  apply("dataMode", "history");
  assert.deepEqual(changes, [["timeframe", "m5"], ["mode", "history"]]);
  assert.equal(context.dataModeRef.current, "history");
  changes.length = 0;
  apply("timeframe", "m1");
  assert.deepEqual(changes, []);
});

test("realtime mode still accepts M1 timeframe changes", () => {
  const changes = [];
  const apply = pageHandler("applyMarketChange", {
    dataModeRef: { current: "realtime" }, isBacktestModeRef: { current: false },
    pendingTimeframeViewportRef: { current: null }, pendingBacktestTimeframeChangeRef: { current: null },
    captureTimeframeViewport: () => null, setTimeframe: (value) => changes.push(value),
  });
  apply("timeframe", "m1");
  assert.deepEqual(changes, ["m1"]);
});

test("old M1 replay records and share links cannot reactivate history M1", () => {
  const context = {
    dataModeRef: { current: "history" }, pendingReplayRef: { current: null },
    setIsBacktestHistoryOpen() {}, setReplayingSessionId() {}, setPendingReplayToken() {},
    isBacktestMode: false,
  };
  const restore = pageHandler("restoreReplayDetail", context);
  assert.throws(() => restore({ public_id: "old-m1", timeframe: "m1", interval: "1min" }), /m1/);
  assert.throws(() => restore({ public_id: "old-m1", interval: "1min" }), /m1/);
  assert.equal(context.pendingReplayRef.current, null);
  const supported = { public_id: "m5", timeframe: "m5", interval: "5min" };
  restore(supported);
  assert.equal(context.pendingReplayRef.current, supported);
});

test("old saved indicator settings gain disabled volume without losing existing indicators", () => {
  const legacy = createDefaultIndicatorConfig();
  delete legacy.volume;
  legacy.macd.enabled = true;
  legacy.macd.fast = 8;
  storage.set("marketMasterIndicatorConfig", JSON.stringify(legacy));
  const restored = loadPersistedIndicatorConfig();
  assert.deepEqual(plain(restored.volume), plain(createDefaultIndicatorConfig().volume));
  assert.equal(restored.macd.enabled, true);
  assert.equal(restored.macd.fast, 8);
});

test("volume enablement and colors persist while draft edits stay isolated", () => {
  const original = createDefaultIndicatorConfig();
  const draft = cloneIndicatorConfig(original);
  draft.volume.enabled = true;
  draft.volume.upColor = "#abcdef";
  draft.volume.downColor = "#123456";
  assert.equal(original.volume.enabled, false);
  assert.equal(original.volume.upColor, "#10b981");
  persistIndicatorConfig(draft);
  assert.deepEqual(plain(loadPersistedIndicatorConfig()), plain(draft));
});

// 分笔动能暂时停用，相关配置测试随实现一起保留。
// test("legacy indicator settings gain disabled pen momentum and edits persist independently", () => {
//   const legacy = createDefaultIndicatorConfig();
//   delete legacy.penMomentum;
//   legacy.macd.enabled = true;
//   storage.set("marketMasterIndicatorConfig", JSON.stringify(legacy));
//   const restored = loadPersistedIndicatorConfig();
//   assert.equal(restored.macd.enabled, true);
//   assert.deepEqual(plain(restored.penMomentum), plain(createDefaultIndicatorConfig().penMomentum));
//   const draft = cloneIndicatorConfig(restored);
//   draft.penMomentum = { enabled: true, atrPeriod: 20, weakThreshold: 0.8, includeDeveloping: false };
//   assert.equal(restored.penMomentum.enabled, false);
//   persistIndicatorConfig(draft);
//   assert.deepEqual(plain(loadPersistedIndicatorConfig().penMomentum), plain(draft.penMomentum));
// });

// test("invalid saved momentum settings are restored to usable defaults", () => {
//   storage.set("marketMasterIndicatorConfig", JSON.stringify({ penMomentum: { enabled: true, atrPeriod: -2, weakThreshold: "invalid" } }));
//   const config = loadPersistedIndicatorConfig().penMomentum;
//   assert.equal(config.atrPeriod, 14);
//   assert.equal(config.weakThreshold, 0.5);
//   assert.equal(config.includeDeveloping, true);
// });

test("realtime data refresh echoes do not drive the main crosshair, user moves and mouse leave do", () => {
  // Lightweight Charts re-fires crosshairMove after setData with the saved point and no sourceEvent.
  assert.equal(isCrosshairRefreshEcho({ time: 1, point: { x: 10, y: 20 } }), true);
  assert.equal(isCrosshairRefreshEcho({ time: 1, point: { x: 10, y: 20 }, sourceEvent: { clientX: 1 } }), false);
  assert.equal(isCrosshairRefreshEcho({}), false); // mouse leave: clear the main crosshair
});

test("MACD data is swapped with the crosshair hidden, then the synced crosshair returns", () => {
  const calls = [];
  const chart = {
    clearCrosshairPosition: () => calls.push("clear"),
    setCrosshairPosition: (price, time, series) => calls.push(`cross ${series.name} ${time} ${price}`),
  };
  const series = (name) => ({ name, setData: (rows) => calls.push(`${name} ${rows.length}`) });
  const [hist, line, signal] = [series("hist"), series("line"), series("signal")];
  const data = [
    { time: 1, hist: 0.5, macd: 2, signal: 1.5, colorType: "positiveGrowing" },
    { time: 2, hist: -0.5, macd: 1, signal: 1.5, colorType: "negativeFalling" },
  ];
  replaceMacdSeriesData({ chart, hist, line, signal, data, histColors: {}, crosshairTime: 2 });
  // Hiding the crosshair before the first setData avoids Lightweight Charts'
  // mid-update hit test that throws "Value is null".
  assert.deepEqual(calls, ["clear", "hist 2", "line 2", "signal 2", "cross line 2 1"]);

  calls.length = 0;
  replaceMacdSeriesData({ chart, hist, line, signal, data, histColors: {}, crosshairTime: 99 });
  assert.deepEqual(calls, ["clear", "hist 2", "line 2", "signal 2"]);
  calls.length = 0;
  replaceMacdSeriesData({ chart, hist, line, signal, data: [], histColors: {} });
  assert.deepEqual(calls, ["clear", "hist 0", "line 0", "signal 0"]);
  calls.length = 0;
  replaceMacdSeriesData({ chart, hist: null, line, signal, data, histColors: {} });
  assert.deepEqual(calls, []);
});
