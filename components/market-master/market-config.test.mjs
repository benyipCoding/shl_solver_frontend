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
  loadPersistedIndicatorConfig, persistIndicatorConfig,
} = target.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

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

test("legacy indicator settings gain disabled pen momentum and edits persist independently", () => {
  const legacy = createDefaultIndicatorConfig();
  delete legacy.penMomentum;
  legacy.macd.enabled = true;
  storage.set("marketMasterIndicatorConfig", JSON.stringify(legacy));
  const restored = loadPersistedIndicatorConfig();
  assert.equal(restored.macd.enabled, true);
  assert.deepEqual(plain(restored.penMomentum), plain(createDefaultIndicatorConfig().penMomentum));
  const draft = cloneIndicatorConfig(restored);
  draft.penMomentum = { enabled: true, atrPeriod: 20, weakThreshold: 0.8, includeDeveloping: false };
  assert.equal(restored.penMomentum.enabled, false);
  persistIndicatorConfig(draft);
  assert.deepEqual(plain(loadPersistedIndicatorConfig().penMomentum), plain(draft.penMomentum));
});

test("invalid saved momentum settings are restored to usable defaults", () => {
  storage.set("marketMasterIndicatorConfig", JSON.stringify({ penMomentum: { enabled: true, atrPeriod: -2, weakThreshold: "invalid" } }));
  const config = loadPersistedIndicatorConfig().penMomentum;
  assert.equal(config.atrPeriod, 14);
  assert.equal(config.weakThreshold, 0.5);
  assert.equal(config.includeDeveloping, true);
});
