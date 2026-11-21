import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("./backtest-timeframe.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const { backtestBarEnd, backtestSwitchCount } = exports;
const H = 3600, D = 24 * H;
const utc = value => Date.parse(value + "Z") / 1000;
const bars = times => times.map(time => ({ time }));
const session = utc("2017-09-13T21:00:00");
const days = bars([session - D, session, session + D, session + 2 * D]);
// XAU/USD has no H1 bar at 21:00 UTC on these days.
const hours = bars(Array.from({ length: 72 }, (_, i) => session + (i - 1) * H)
  .filter(time => new Date(time * 1000).getUTCHours() !== 21));
const change = (source, count, fromSeconds, target, toSeconds) => {
  const open = source[count - 1].time;
  return backtestSwitchCount(target, toSeconds, {
    cursorOpen: open, cursorEnd: backtestBarEnd(open, fromSeconds, source[count]?.time),
  });
};

test("XAU/USD D1 reveals its last H1 and stepping starts the next session", () => {
  const count = change(days, 2, D, hours, H);
  assert.equal(hours[count - 1].time, utc("2017-09-14T20:00:00"));
  assert.equal(hours[count].time, utc("2017-09-14T22:00:00"));
  assert.equal(change(hours, count, H, days, D), 2); // close exactly at next daily open
  assert.equal(change(hours, count + 1, H, days, D), 3); // one hour in the next day
  const afterRoundUp = change(days, 3, D, hours, H);
  assert.equal(hours[afterRoundUp - 1].time, utc("2017-09-15T20:00:00"));
});

test("non-nested intraday periods round up, but never reveal a bar opening exactly at the boundary", () => {
  const h3 = bars([0, 3*H, 6*H, 9*H]);
  const h2 = bars([0, 2*H, 4*H, 6*H]);
  assert.equal(change(h3, 1, 3*H, h2, 2*H), 2);
  assert.equal(change(h2, 2, 2*H, h3, 3*H), 2);
  assert.equal(change(h3, 2, 3*H, h2, 2*H), 3);
});

test("weekend/holiday gaps do not extend a completed source bar to the next trading day", () => {
  const fri = utc("2017-09-15T20:00:00");
  assert.equal(backtestBarEnd(fri, H, fri + 50*H), fri + H);
  assert.equal(change(bars([fri, fri + 50*H]), 1, H, bars([fri - 23*H, fri + 49*H]), D), 1);
  assert.throws(() => change(days, 2, D, bars([session - H, session + D]), H), /没有覆盖/);
});

test("weekly boundaries respect both NY clock changes with or without a prefetched next bar", () => {
  for (const [start, end] of [["2017-03-11T22:00:00","2017-03-18T21:00:00"],
                              ["2017-11-04T21:00:00","2017-11-11T22:00:00"]]) {
    const open = utc(start), close = utc(end);
    assert.equal(backtestBarEnd(open, 7*D), close);
    assert.equal(backtestBarEnd(open, 7*D, close), close);
    assert.equal(change(bars([open]), 1, 7*D, bars([close - D, close]), D), 1);
  }
});
