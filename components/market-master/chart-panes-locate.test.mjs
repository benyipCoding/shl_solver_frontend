import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const load = (file, globals = {}) => {
  const target = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: target.exports, module: target, ...globals });
  return target.exports;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

const storage = new Map();
const panes = load("./chart-panes.ts", {
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
});
const locate = load("./chart-locate.ts");

test("dragging a pane border trades height between the two adjacent panes only", () => {
  // Main 500 / MACD 192: drag up 80 -> MACD 272, total unchanged.
  assert.deepEqual(plain(panes.resizeAdjacentPanes(500, 192, -80, 180, 96)), { upper: 420, lower: 272 });
  // MACD / volume pair, drag down 50.
  assert.deepEqual(plain(panes.resizeAdjacentPanes(192, 192, 50, 96, 96)), { upper: 242, lower: 142 });
});

test("pane borders stop at each pane's minimum height", () => {
  assert.deepEqual(plain(panes.resizeAdjacentPanes(500, 192, -1000, 180, 96)), { upper: 180, lower: 512 });
  assert.deepEqual(plain(panes.resizeAdjacentPanes(192, 192, 1000, 96, 96)), { upper: 288, lower: 96 });
});

test("pane heights persist and ignore invalid saved values", () => {
  panes.persistPaneHeights({ macd: 260, volume: 140 });
  assert.deepEqual(plain(panes.readPaneHeights()), { macd: 260, volume: 140 });
  storage.set(panes.PANE_HEIGHTS_STORAGE_KEY, JSON.stringify({ macd: 10, volume: "x" }));
  assert.deepEqual(plain(panes.readPaneHeights()), {});
  storage.set(panes.PANE_HEIGHTS_STORAGE_KEY, "{broken");
  assert.deepEqual(plain(panes.readPaneHeights()), {});
});

const H = 3600;
const JUN_15 = Date.UTC(2026, 5, 15) / 1000;

test("time-of-day choices come from the loaded bars: H8 offers 00:00, 08:00 and 16:00", () => {
  const h8 = Array.from({ length: 30 }, (_, i) => ({ time: JUN_15 + i * 8 * H }));
  assert.deepEqual(plain(locate.barMinutesOfDay(h8)), [0, 480, 960]);
  const byHour = locate.groupMinutesByHour([0, 15, 30, 45, 60, 75]);
  assert.deepEqual(plain([...byHour.keys()]), [0, 1]);
  assert.deepEqual(plain(byHour.get(0)), [0, 15, 30, 45]);
});

test("only revealed bars contribute time-of-day choices in backtest", () => {
  const bars = [{ time: JUN_15 }, { time: JUN_15 + 8 * H }, { time: JUN_15 + 16 * H }];
  assert.deepEqual(plain(locate.barMinutesOfDay(bars, 2)), [0, 480]);
});

test("a missing time jumps to the nearest bar", () => {
  // Half-day session: 06-15 has 00:00 and 08:00, the next bar is 06-16 00:00.
  const bars = [{ time: JUN_15 }, { time: JUN_15 + 8 * H }, { time: JUN_15 + 24 * H }];
  assert.equal(locate.nearestCandleIndex(bars, 3, JUN_15 + 16 * H - 60), 2 - 1); // 15:59 -> 08:00
  assert.equal(locate.nearestCandleIndex(bars, 3, JUN_15 + 17 * H), 2); // 17:00 -> next day 00:00
  assert.equal(locate.nearestCandleIndex(bars, 3, JUN_15 - 99 * H), 0);
  assert.equal(locate.nearestCandleIndex(bars, 3, JUN_15 + 99 * H), 2);
  assert.equal(locate.nearestCandleIndex(bars, 2, JUN_15 + 99 * H), 1); // capped at revealed bars
  assert.equal(locate.nearestCandleIndex([], 0, JUN_15), -1);
});

test("picked date and time map to UTC chart time", () => {
  assert.equal(locate.utcDateTimeToUnix("2026-06-15", 16 * 60), JUN_15 + 16 * H);
  assert.equal(locate.toUtcDateInput(JUN_15 + 23 * H), "2026-06-15");
  assert.equal(locate.utcDateTimeToUnix("bad"), null);
});
