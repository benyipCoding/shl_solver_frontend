import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(name, dependencies = {}) {
  const target = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: target, exports: target.exports, fetch, performance, setTimeout,
    console: { error() {} }, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return target.exports;
}
const config = load("./automatic-trading-config");
const runner = load("./automatic-trading-runner");
const persistence = load("./backtest-persistence");
const pens = load("./automatic-pens");
const management = load("./trade-management");
const risk = load("./automatic-pen-risk", { "./automatic-pens": pens, "./trade-management": management, "./automatic-trading-config": config });
const defaults = config.DEFAULT_AUTOMATIC_TRADING_CONFIG;

test("configuration has valid defaults, restores settings, and rejects invalid persisted values", () => {
  assert.equal(config.automaticTradingConfigError(defaults), null);
  assert.equal(config.readAutomaticTradingConfig('{"addRiskPercent":25}').addRiskPercent, 25);
  const migrated = config.readAutomaticTradingConfig('{"addRiskPercent":25}');
  assert.equal(migrated.shortExitEnabled, true);
  assert.equal(migrated.shortExitPercent, 50);
  assert.equal(config.readAutomaticTradingConfig('{"shortExitEnabled":false,"shortExitPercent":25}').shortExitEnabled, false);
  for (const patch of [{ shortExitEnabled: "true" }, { shortExitPercent: 0 }, { shortExitPercent: 101 }, { shortExitPercent: NaN }]) {
    assert.ok(config.automaticTradingConfigError({ ...defaults, ...patch }));
  }
  for (const raw of ["bad", '{"stepCandles":-1}', '{"firstOrderUnits":1.5}', '{"takeProfitR":0}', '{"strategy":"unknown"}']) {
    assert.equal(JSON.stringify(config.readAutomaticTradingConfig(raw)), JSON.stringify(defaults));
  }
  for (const patch of [{ addRiskPercent: 101 }, { firstOrderRiskAmount: 0 }, { firstOrderRiskPercent: NaN }, { minStopTicks: 0 }, { stepCandles: Infinity }]) assert.ok(config.automaticTradingConfigError({ ...defaults, ...patch }));
});

test("first-order amount and balance-percent budgets floor quantity; addon and stop/target parameters apply independently", () => {
  const event = { side: "Buy", atr: 5, trendOrigin: { price: 100, time: 1 }, pen: { startPoint: { price: 150, time: 20 } } };
  for (const mode of ["amount", "balancePercent"]) {
    const plan = risk.planAutomaticPenOrder(event, 119, 99999, [], 2, { ...defaults, firstOrderMode: mode }, 10000);
    assert.equal(plan.units, 10); // 200 / 20
    assert.equal(plan.automaticPen.riskBudget, 200);
    assert.equal(plan.units * plan.automaticPen.initialRisk, 200);
  }
  assert.equal(risk.planAutomaticPenOrder(event, 119, 1, [], 2, defaults).units, 100);
  assert.equal(risk.planAutomaticPenOrder(event, 119, 1, [], 2, { ...defaults, firstOrderMode: "amount", firstOrderRiskAmount: 19 }), null);
  const parent = { id: "one", type: "Buy", status: "Open", entry: 90, entryTime: 1, sl: 100, tp: 400, units: 100, automaticPen: {} };
  const plan = risk.planAutomaticPenOrder(event, 119, 1, [parent], 2, { ...defaults, addRiskPercent: 25, stopAtrMultiplier: 1, takeProfitR: 5 });
  assert.equal(plan.sl, 95);
  assert.equal(plan.tp, 239);
  assert.equal(plan.units, 10);
  assert.equal(plan.automaticPen.riskBudget, 250);
  assert.equal(risk.planAutomaticPenOrder(event, 119, 1, [parent], 2, { ...defaults, addRiskPercent: 0 }), null);
});

test("step advances exactly 1000 candles in bounded slices and never duplicates or skips a bar", async () => {
  let cursor = 100, yields = 0;
  const seen = [], reports = [];
  const result = await runner.runAutomaticTradingBatch({ limit: 1000, cursor: () => cursor, available: () => 5000, total: () => 5000,
    advance: () => seen.push(cursor++), loadMore: async () => assert.fail("unneeded fetch"), cancelled: () => false,
    progress: (p) => reports.push(p), now: () => 0, yieldToBrowser: async () => { yields++; } });
  assert.equal(result.processed, 1000);
  assert.equal(cursor, 1100);
  assert.deepEqual(seen, Array.from({ length: 1000 }, (_, i) => 100 + i));
  assert.ok(yields >= 5);
  assert.equal(reports.at(-1).processed, 1000);
});

test("run-to-end loads later pages and freezes the original right edge", async () => {
  let cursor = 2, available = 4, total = 13, loads = 0;
  const result = await runner.runAutomaticTradingBatch({ limit: Infinity, cursor: () => cursor, available: () => available, total: () => total,
    advance: () => { cursor++; }, loadMore: async () => { available += 4; total += 1; loads++; }, cancelled: () => false,
    progress() {}, yieldToBrowser: async () => {} });
  assert.equal(cursor, 13);
  assert.equal(result.processed, 11);
  assert.equal(loads, 3);
});

test("cancellation retains its last processed candle and can resume, and empty pages fail without spinning", async () => {
  let cursor = 0, stop = false;
  const options = { limit: 1000, cursor: () => cursor, available: () => 2000, total: () => 2000,
    advance: () => { cursor++; }, loadMore: async () => {}, cancelled: () => stop, progress() {}, now: () => 0,
    yieldToBrowser: async () => { if (cursor === 250) stop = true; } };
  const first = await runner.runAutomaticTradingBatch(options);
  assert.equal(first.cancelled, true);
  assert.equal(cursor, 250);
  stop = false;
  await runner.runAutomaticTradingBatch({ ...options, limit: 50, yieldToBrowser: async () => {} });
  assert.equal(cursor, 300);
  await assert.rejects(runner.runAutomaticTradingBatch({ ...options, available: () => 300, yieldToBrowser: async () => {} }), /未能加载/);
});

test("batch persistence preserves event order across 200-event requests and flushes before completion", async () => {
  const requests = [];
  const client = persistence.createBacktestPersistClient();
  client.configure({ enabled: true, fetchFn: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ data: { public_id: "session" } })); } });
  client.beginBatch();
  client.startSession({});
  client.recordOpen({ client_trade_id: "one", units: 100, price: 100, bar_time: 1 });
  for (let i = 0; i < 400; i++) client.recordModify({ client_trade_id: "one", kind: "sl", price: 90 + i / 100, bar_time: i + 2 });
  client.recordClose({ client_trade_id: "one", units: 100, price: 120, bar_time: 402, close_reason: "分笔突破失效" });
  await client.endBatch();
  assert.equal(requests.length, 4); // session + 3 batches
  assert.deepEqual(requests.slice(1).map((r) => r.body.events.length), [200, 200, 2]);
  const events = requests.slice(1).flatMap((r) => r.body.events);
  assert.equal(events[0].event_type, "OPEN");
  assert.equal(events.at(-1).close_reason, "PEN_BREAKOUT_FAILED");
  assert.deepEqual(events.map((e) => e.bar_time), Array.from({ length: 402 }, (_, i) => i + 1));
  client.recordOpen({ client_trade_id: "two", units: 5, price: 20, bar_time: 403 });
  await client.endBatch();
  assert.equal(requests.at(-1).body.event_type, "OPEN"); // normal single-event protocol unchanged
});

test("save failures are reported and do not silently send dependent events after a failed batch", async () => {
  const client = persistence.createBacktestPersistClient();
  let calls = 0;
  client.configure({ enabled: true, fetchFn: async () => { calls++; return new Response(JSON.stringify(calls === 1 ? { data: { public_id: "session" } } : { message: "offline" }), { status: calls === 1 ? 200 : 503 }); } });
  client.beginBatch(); client.startSession({});
  for (let i = 0; i < 401; i++) client.recordOpen({ client_trade_id: String(i), bar_time: i, units: 1, price: 1 });
  await assert.rejects(client.endBatch(), /offline/);
  assert.equal(calls, 2);
});
