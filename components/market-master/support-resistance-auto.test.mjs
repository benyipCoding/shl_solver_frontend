import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const module = { exports: {} };
  cache.set(name, module.exports);
  const source = fs.readFileSync(new URL(`${name}.ts`, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module, exports: module.exports, require: load, AbortController, Error });
  return module.exports;
}
const { SupportResistanceAutoTracker } = load("./support-resistance-auto");
const { detectAutomaticSupportResistance } = load("./support-resistance");
const candles = Array.from({ length: 100 }, (_, index) => ({ time: index + 1, open: 100, high: 101, low: 99, close: 100, volume: 100 }));
const analyze = async (bars, previous) => detectAutomaticSupportResistance(bars, bars.length, previous);
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function until(predicate) {
  for (let index = 0; index < 30 && !predicate(); index++) await flush();
  assert.ok(predicate(), "expected asynchronous state was published");
}

test("backfill is analysis-only, excludes future/inclusive boundary data, and never changes input", async () => {
  const input = structuredClone(candles.slice(10));
  const original = structuredClone(input);
  const requests = [];
  const updates = [];
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null, analyze,
    loadBefore: async (before) => {
      requests.push(before);
      return { candles: candles.slice(0, 25), hasMore: false };
    },
    onUpdate: (snapshot, state) => updates.push({ snapshot, state }),
  });
  tracker.refresh(input, 5, true);
  await until(() => updates.some(({ snapshot }) => snapshot?.barsAnalyzed === 15));
  assert.deepEqual(requests, [11]);
  assert.deepEqual(input, original);
  assert.ok(updates.every(({ snapshot }) => !snapshot || snapshot.asOf === 15));
  assert.equal(updates.at(-1).snapshot.rangeStart, 1);
  assert.equal(updates.at(-1).state.hasMore, false);
  tracker.stop();
});

test("playback advancing during backfill is reconciled at the newest revealed cursor", async () => {
  let finishPage;
  let requested = false;
  const updates = [];
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null, analyze,
    loadBefore: () => { requested = true; return new Promise((resolve) => { finishPage = resolve; }); },
    onUpdate: (snapshot) => { if (snapshot) updates.push(snapshot); },
  });
  tracker.refresh(candles.slice(10), 5, true);
  await until(() => requested);
  tracker.refresh(candles.slice(10), 9, true);
  finishPage({ candles: candles.slice(0, 10), hasMore: false });
  await until(() => updates.some((snapshot) => snapshot.asOf === 19 && snapshot.barsAnalyzed === 19));
  assert.ok(updates.every((snapshot) => snapshot.asOf <= 19));
  tracker.stop();
});

test("stop/clear aborts history requests and ignores late responses", async () => {
  let finishPage;
  let requestSignal;
  const updates = [];
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null, analyze,
    loadBefore: (_, signal) => { requestSignal = signal; return new Promise((resolve) => { finishPage = resolve; }); },
    onUpdate: (snapshot) => updates.push(snapshot),
  });
  tracker.refresh(candles.slice(10), 5, true);
  await until(() => requestSignal != null);
  tracker.stop();
  const count = updates.length;
  assert.equal(requestSignal.aborted, true);
  finishPage({ candles: candles.slice(0, 10), hasMore: false });
  await flush();
  assert.equal(updates.length, count);
});

test("stopping during computation never republishes cleared rectangles", async () => {
  let finish;
  const updates = [];
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null,
    analyze: () => new Promise((resolve) => { finish = resolve; }),
    loadBefore: async () => { throw new Error("must not fetch"); },
    onUpdate: (snapshot) => updates.push(snapshot),
  });
  tracker.refresh(candles, 30, false);
  tracker.stop();
  finish(await analyze(candles.slice(0, 30), null));
  await flush();
  assert.equal(updates.length, 0);
});

test("history failure preserves current analysis, does not retry per candle, and can be retried explicitly", async () => {
  let attempts = 0;
  const updates = [];
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null, analyze,
    loadBefore: async () => { attempts++; if (attempts === 1) throw new Error("temporary history failure"); return { candles: candles.slice(0, 10), hasMore: false }; },
    onUpdate: (snapshot, state) => updates.push({ snapshot, state }),
  });
  tracker.refresh(candles.slice(10), 10, true);
  await until(() => updates.some(({ state }) => state.error));
  tracker.refresh(candles.slice(10), 11, true);
  await until(() => updates.at(-1).snapshot?.asOf === 21);
  assert.equal(attempts, 1);
  assert.equal(updates.at(-1).snapshot.barsAnalyzed, 11);
  tracker.retryHistory();
  await until(() => updates.at(-1).snapshot?.barsAnalyzed === 21);
  assert.equal(attempts, 2);
  assert.equal(updates.at(-1).state.error, null);
  tracker.stop();
});

test("overlapping pages with no older data cannot cause an endless request loop", async () => {
  let attempts = 0;
  const updates = [];
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null, analyze,
    loadBefore: async () => { attempts++; return { candles: candles.slice(10), hasMore: true }; },
    onUpdate: (snapshot, state) => updates.push({ snapshot, state }),
  });
  tracker.refresh(candles.slice(10), 10, true);
  await until(() => updates.some(({ state }) => state.error));
  assert.equal(attempts, 1);
  assert.equal(updates.at(-1).snapshot.barsAnalyzed, 10);
  tracker.stop();
});

test("restart reuses the analysis history and exhaustion state without fetching it again", async () => {
  const updates = [];
  let requests = 0;
  const loadBefore = async () => { requests++; return { candles: candles.slice(0, 10), hasMore: false }; };
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null, analyze, loadBefore,
    onUpdate: (snapshot) => { if (snapshot) updates.push(snapshot); },
  });
  tracker.refresh(candles.slice(10), 5, true);
  await until(() => updates.at(-1)?.barsAnalyzed === 15);
  const initialHistory = tracker.getHistoryContext();
  tracker.stop();
  const resumed = new SupportResistanceAutoTracker({ initialSnapshot: updates.at(-1), initialHistory, analyze, loadBefore,
    onUpdate: (snapshot) => { if (snapshot) updates.push(snapshot); },
  });
  resumed.refresh(candles.slice(10), 6, true);
  await until(() => updates.at(-1)?.asOf === 16);
  assert.equal(updates.at(-1).barsAnalyzed, 16);
  assert.equal(updates.at(-1).rangeStart, 1);
  assert.equal(resumed.getHistoryContext().hasMore, false);
  assert.equal(requests, 1);
  resumed.stop();
});

test("rapid replay during analysis is coalesced and never publishes an obsolete cursor", async () => {
  const jobs = [];
  const updates = [];
  const tracker = new SupportResistanceAutoTracker({ initialSnapshot: null,
    analyze: (bars, previous) => new Promise((resolve) => jobs.push({ bars, previous, resolve })),
    loadBefore: async () => { throw new Error("history is exhausted"); },
    onUpdate: (snapshot) => { if (snapshot) updates.push(snapshot); },
  });
  tracker.refresh(candles, 30, false);
  tracker.refresh(candles, 31, false);
  tracker.refresh(candles, 32, false);
  assert.equal(jobs.length, 1);
  jobs[0].resolve(await analyze(jobs[0].bars, jobs[0].previous));
  await until(() => jobs.length === 2);
  assert.equal(updates.length, 0);
  assert.equal(jobs[1].bars.at(-1).time, 32);
  jobs[1].resolve(await analyze(jobs[1].bars, jobs[1].previous));
  await until(() => updates.length === 1);
  assert.equal(updates[0].asOf, 32);
  tracker.stop();
});
