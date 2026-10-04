import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const target = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(new URL("./support-resistance.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }
).outputText, { exports: target.exports, module: target });
const { detectSupportResistance: detect, detectAutomaticSupportResistance: detectAuto, needsMoreSupportResistanceHistory,
  evaluateZoneLifecycle, updateSupportResistanceSnapshot, SUPPORT_RESISTANCE_RULES: rules } = target.exports;
const detectSupportResistance = (candles, visibleCount, range = {
  from: candles[0]?.time ?? 0,
  to: candles.at(-1)?.time ?? 0,
}) => detect(candles, visibleCount, range);
const plain = (value) => JSON.parse(JSON.stringify(value));

function rangeMarket(count = 224, elevatedVolume = true) {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + 5 * Math.sin(index * Math.PI / 16);
    return {
      time: 1700000000 + index * 3600,
      open: close - 0.1, high: close + 0.4, low: close - 0.4, close,
      volume: elevatedVolume && index % 16 === 8 ? 300 : 100,
    };
  });
}

test("finds independently tested range boundaries with bounded, non-overlapping zones", () => {
  const bars = rangeMarket();
  const original = structuredClone(bars);
  const result = detectSupportResistance(bars, bars.length);
  assert.equal(result.zones.length, 2);
  const support = result.zones.find((zone) => zone.role === "support");
  const resistance = result.zones.find((zone) => zone.role === "resistance");
  assert.ok(support.lower < 94.6 && support.upper > 94.6);
  assert.ok(resistance.lower < 105.4 && resistance.upper > 105.4);
  assert.ok(support.upper < resistance.lower);
  for (const zone of result.zones) {
    assert.ok(zone.tests >= 2);
    assert.ok(zone.score >= rules.minScore && zone.score <= 100);
    assert.ok(zone.upper - zone.lower <= result.atr * 0.9 + 1e-9);
    assert.ok(Number.isFinite(zone.distanceAtr) && zone.distanceAtr >= 0);
  }
  assert.deepEqual(bars, original);
});

test("relative volume strengthens the same price evidence without replacing it", () => {
  const normal = rangeMarket(224, false);
  const elevated = rangeMarket();
  const ordinary = detectSupportResistance(normal, normal.length);
  const stronger = detectSupportResistance(elevated, elevated.length);
  assert.equal(stronger.zones.length, ordinary.zones.length);
  for (const zone of stronger.zones) {
    const baseline = ordinary.zones.find((other) => other.role === zone.role);
    assert.ok(zone.score > baseline.score);
    assert.equal(zone.tests, baseline.tests);
    assert.ok(zone.relativeVolume > baseline.relativeVolume);
  }
});

test("missing and zero volume use price evidence without infinite ratios or fabricated volume", () => {
  for (const volume of [null, 0]) {
    const bars = rangeMarket().map((bar) => ({ ...bar, volume }));
    const result = detectSupportResistance(bars, bars.length);
    assert.equal(result.zones.length, 2);
    assert.equal(result.volumeCoverage, 0);
    assert.ok(result.zones.every((zone) => zone.relativeVolume === null && Number.isFinite(zone.score)));
  }
});

test("prefetched future prices and volume cannot influence an earlier snapshot", () => {
  const history = rangeMarket();
  const future = rangeMarket(40).map((bar, index) => ({
    ...bar, time: history.at(-1).time + (index + 1) * 3600,
    open: 900, high: 1000, low: 0, close: 999, volume: 1e12,
  }));
  assert.deepEqual(
    plain(detectSupportResistance([...history, ...future], history.length)),
    plain(detectSupportResistance(history, history.length))
  );
});

test("a large-volume recent high is not usable until the right-hand confirmation bars exist", () => {
  const bars = Array.from({ length: 80 }, (_, index) => ({
    time: index + 1, open: 100, high: 100.4, low: 99.6, close: 100, volume: 100,
  }));
  bars[70] = { ...bars[70], high: 110, close: 109, volume: 500 };
  assert.equal(detectSupportResistance(bars, 73).zones.length, 0);
  const confirmed = detectSupportResistance(bars, 74);
  assert.equal(confirmed.zones.length, 1);
  assert.equal(confirmed.zones[0].role, "resistance");
  assert.equal(confirmed.zones[0].tests, 1);
  // The same isolated high without exceptional volume is not enough evidence.
  bars[70].volume = 100;
  assert.equal(detectSupportResistance(bars, 74).zones.length, 0);
});

test("sustained breakout removes the zone from fresh discovery and an existing snapshot", () => {
  const bars = rangeMarket();
  const previous = detectAuto(bars, bars.length);
  const original = previous.zones.find((zone) => zone.role === "resistance");
  for (let index = 0; index < 3; index++) {
    bars.push({ time: bars.at(-1).time + 3600, open: 111, high: 113, low: 110, close: 112, volume: 500 });
  }
  const result = detectSupportResistance(bars, bars.length);
  assert.ok(!result.zones.some((zone) => zone.lower <= 105.4 && zone.upper >= 105.4));
  const updated = detectAuto(bars, bars.length, previous);
  assert.ok(!updated.zones.some((zone) => zone.id === original.id));
  const retired = updated.retiredZones.find((zone) => zone.id === original.id);
  assert.equal(retired.invalidatedAt, bars.at(-1).time);
  assert.match(retired.statusReason, /确认突破/);
  assert.ok(updated.zones.some((zone) => zone.role === "support"));
  assert.deepEqual(plain(detectAuto(bars, bars.length, updated)), plain(updated));
});

function lifecycleFixture(role = "resistance") {
  const bars = Array.from({ length: 30 }, (_, index) => ({
    time: index + 1, open: 99, high: 99.5, low: 98.5, close: 99, volume: 100,
  }));
  const seed = {
    id: "test-zone", label: "R1", role, originRole: role, lower: 100, upper: 101,
    score: 75, startTime: 5, lastTestTime: 22, evidenceFrom: 1, formedAt: 30, detectedAt: 30,
    formationAtr: 1, tests: 2, reactionAtr: 2, relativeVolume: 1, distanceAtr: 1,
    status: "untested", statusReason: "formed", invalidatedAt: null, reasons: [],
  };
  const append = (close, volume = 100, low = close - 0.1, high = close + 0.1) => {
    bars.push({ time: bars.at(-1).time + 1, open: close, high, low, close, volume });
  };
  const evaluate = () => evaluateZoneLifecycle(seed, role === "resistance" ? bars : bars.map((bar) => ({
    ...bar, open: 201 - bar.open, high: 201 - bar.low, low: 201 - bar.high, close: 201 - bar.close,
  })));
  return { bars, seed, append, evaluate };
}

test("one or two closes, including extreme volume, cannot confirm a breakout on either side", () => {
  for (const role of ["support", "resistance"]) {
    const fixture = lifecycleFixture(role);
    fixture.append(104, 100000);
    assert.equal(fixture.evaluate().status, "piercing");
    fixture.append(104, 100000);
    assert.equal(fixture.evaluate().status, "piercing");
    assert.equal(fixture.evaluate().role, role);
  }
});

test("a brief false break restores the area and shallow edge consolidation does not erase it", () => {
  const fixture = lifecycleFixture();
  fixture.append(102, 1000);
  fixture.append(99.5);
  assert.equal(fixture.evaluate().status, "false_break");
  assert.equal(fixture.evaluate().invalidatedAt, null);
  for (let index = 0; index < 60; index++) fixture.append(index % 2 ? 100.9 : 101.1);
  assert.notEqual(fixture.evaluate().status, "invalidated");
});

test("breakout acceptance needs distance and either sustained volume or additional closes", () => {
  for (const role of ["support", "resistance"]) {
    const volume = lifecycleFixture(role);
    for (let index = 0; index < 3; index++) volume.append(102, 200);
    assert.equal(volume.evaluate().status, "invalidated");
    assert.equal(volume.evaluate().invalidatedAt, 33);
    const absent = lifecycleFixture(role);
    for (let index = 0; index < 4; index++) absent.append(102, null);
    assert.equal(absent.evaluate().status, "piercing");
    absent.append(102, null);
    assert.equal(absent.evaluate().status, "invalidated");
    assert.equal(absent.evaluate().invalidatedAt, 35);
  }
  const outlier = lifecycleFixture();
  outlier.append(102, 1e12);
  outlier.append(102);
  outlier.append(102);
  assert.equal(outlier.evaluate().status, "piercing");
  const shallow = lifecycleFixture();
  for (let index = 0; index < 6; index++) shallow.append(101.4, 1000);
  assert.equal(shallow.evaluate().status, "piercing");
});

test("a later retest and rejection cannot revive or reverse a retired zone, symmetrically", () => {
  for (const role of ["support", "resistance"]) {
    const fixture = lifecycleFixture(role);
    for (let index = 0; index < 3; index++) fixture.append(102, 200);
    assert.equal(fixture.evaluate().status, "invalidated");
    const invalidatedAt = fixture.evaluate().invalidatedAt;
    fixture.append(103);
    assert.equal(fixture.evaluate().status, "invalidated");
    assert.equal(fixture.evaluate().role, role);
    fixture.append(101.5, 100, 100.8, 101.7);
    assert.equal(fixture.evaluate().status, "invalidated");
    fixture.append(102);
    assert.equal(fixture.evaluate().status, "invalidated");
    assert.equal(fixture.evaluate().invalidatedAt, invalidatedAt);
    assert.equal(fixture.evaluate().role, role);
    assert.equal(fixture.evaluate().id, fixture.seed.id);
    assert.equal(fixture.evaluate().lower, 100);
    assert.equal(fixture.evaluate().upper, 101);
  }
});

test("an accepted breakout remains retired even when price later returns to the old side", () => {
  const fixture = lifecycleFixture();
  for (let index = 0; index < 3; index++) fixture.append(102, 200);
  fixture.append(99.5);
  assert.equal(fixture.evaluate().status, "invalidated");
  fixture.append(99.5);
  assert.equal(fixture.evaluate().status, "invalidated");
  assert.equal(fixture.evaluate().role, "resistance");
  assert.equal(fixture.evaluate().invalidatedAt, 33);
});

test("persistent two-sided acceptance with weak departures can also retire a structure", () => {
  const fixture = lifecycleFixture();
  for (let index = 0; index < 23; index++) fixture.append(index % 4 < 2 ? 101.6 : 99.4);
  assert.notEqual(fixture.evaluate().status, "invalidated");
  fixture.append(99.4);
  assert.equal(fixture.evaluate().status, "invalidated");
  assert.equal(fixture.evaluate().invalidatedAt, 54);
  const isolated = lifecycleFixture();
  for (let index = 0; index < 50; index++) isolated.append(index % 2 ? 101.6 : 99.4);
  assert.notEqual(isolated.evaluate().status, "invalidated");
  const strong = lifecycleFixture();
  for (let index = 0; index < 40; index++) strong.append(index % 4 < 2 ? 104 : 97);
  assert.notEqual(strong.evaluate().status, "invalidated");
});

test("a confirmed breakout retires immediately without waiting for a retest or a long departure", () => {
  const fixture = lifecycleFixture();
  for (let index = 0; index < 150; index++) fixture.append(104, 200);
  assert.equal(fixture.evaluate().status, "invalidated");
  assert.equal(fixture.evaluate().invalidatedAt, 33);
});

test("remarking after one breakout keeps original identities, boundaries and scores as the viewport moves", () => {
  const bars = rangeMarket();
  const previous = detectSupportResistance(bars, bars.length);
  const original = plain(previous);
  bars.push({ time: bars.at(-1).time + 3600, open: 111, high: 113, low: 110, close: 112, volume: 500 });
  const viewport = { from: bars[200].time, to: bars.at(-1).time };
  const next = detect(bars, bars.length, viewport, previous);
  for (const old of previous.zones) {
    const retained = next.zones.find((zone) => zone.id === old.id);
    assert.ok(retained);
    for (const key of ["lower", "upper", "score", "startTime"]) assert.equal(retained[key], old[key]);
  }
  assert.equal(next.zones.find((zone) => zone.role === "resistance").status, "piercing");
  assert.deepEqual(plain(previous), original);
  assert.deepEqual(plain(detect(bars, bars.length, viewport, next)), plain(next));
});

test("playback and button updates agree, cannot read unrevealed data, and do not revive retired evidence", () => {
  const fixture = lifecycleFixture();
  const previous = { ...detectSupportResistance(fixture.bars, fixture.bars.length),
    zones: [fixture.seed], trackedZones: [fixture.seed] };
  for (let index = 0; index < 24; index++) fixture.append(index % 4 < 2 ? 101.6 : 99.4);
  const future = fixture.bars.map((bar, index) => ({ ...bar, time: 55 + index, close: 999, volume: 1e12 }));
  const completed = updateSupportResistanceSnapshot(previous, fixture.bars, 54, 54);
  assert.equal(completed.zones.length, 0);
  assert.equal(completed.retiredZones.length, 1);
  assert.deepEqual(plain(updateSupportResistanceSnapshot(previous, [...fixture.bars, ...future], 54, 1000)), plain(completed));
  let incremental = previous;
  for (let end = 31; end <= 54; end++) incremental = updateSupportResistanceSnapshot(incremental, fixture.bars, end, end);
  assert.deepEqual(plain(incremental), plain(completed));
  const remarked = detect(fixture.bars, fixture.bars.length, { from: 1, to: 54 }, completed);
  assert.ok(!remarked.zones.some((zone) => zone.id === fixture.seed.id));
  assert.equal(remarked.retiredZones.length, 1);
  const past = updateSupportResistanceSnapshot(completed, fixture.bars, 54, 35);
  assert.equal(past.zones.length, 1);
  assert.equal(past.retiredZones.length, 0);
  assert.equal(updateSupportResistanceSnapshot(completed, fixture.bars, 54, 29).zones.length, 0);
});

test("retirement of a detected structure excludes its old pivots from rediscovery", () => {
  const bars = rangeMarket();
  const previous = detectSupportResistance(bars, bars.length);
  const original = previous.zones.find((zone) => zone.role === "resistance");
  for (let index = 0; index < 40; index++) {
    const close = index % 4 < 2 ? original.upper + 0.6 * original.formationAtr : original.lower - 0.6 * original.formationAtr;
    bars.push({ time: bars.at(-1).time + 3600, open: close, high: close + 0.01, low: close - 0.01, close, volume: 100 });
  }
  const advanced = updateSupportResistanceSnapshot(previous, bars, bars.length, bars.at(-1).time);
  assert.ok(advanced.retiredZones.some((zone) => zone.id === original.id));
  const remarked = detect(bars, bars.length, { from: bars[0].time, to: bars.at(-1).time }, advanced);
  assert.ok(!remarked.zones.some((zone) => zone.startTime <= original.lastTestTime && zone.lower <= original.upper && zone.upper >= original.lower));
});

test("historical discovery cannot carry future lifecycle decisions back into an older viewport", () => {
  const bars = rangeMarket(500);
  const later = detectSupportResistance(bars, bars.length);
  const viewport = { from: bars[0].time, to: bars[223].time };
  const standalone = detect(bars, bars.length, viewport);
  const past = detect(bars, bars.length, viewport, later);
  assert.deepEqual(plain(past.zones), plain(standalone.zones));
  const forward = updateSupportResistanceSnapshot(past, bars, bars.length, bars.at(-1).time);
  for (let index = 1; index < forward.zones.length; index++) {
    assert.ok(forward.zones[index - 1].upper < forward.zones[index].lower);
  }
});

test("one close above resistance remains a pending breakout instead of silently flipping roles", () => {
  const bars = rangeMarket();
  bars.push({ time: bars.at(-1).time + 3600, open: 111, high: 113, low: 110, close: 112, volume: 500 });
  const result = detectSupportResistance(bars, bars.length);
  const zone = result.zones.find((zone) => zone.lower <= 105.4 && zone.upper >= 105.4);
  assert.equal(zone?.role, "resistance");
  assert.equal(zone?.status, "piercing");
});

test("a flat-topped run does not count as several independent tests", () => {
  const bars = rangeMarket(224, false);
  const plateau = bars.map((bar, index) => ({
    ...bar, high: index % 32 >= 8 && index % 32 <= 10 ? 105.4 : bar.high,
  }));
  const baseline = detectSupportResistance(bars, bars.length).zones.find((zone) => zone.role === "resistance");
  const result = detectSupportResistance(plateau, plateau.length).zones.find((zone) => zone.role === "resistance");
  assert.ok(result);
  assert.equal(result.tests, baseline.tests);
});

test("a flat high-volume market is not turned into artificial support/resistance", () => {
  const bars = rangeMarket().map((bar) => ({ ...bar, open: 100, high: 100, low: 100, close: 100, volume: 1000000 }));
  assert.equal(detectSupportResistance(bars, bars.length).zones.length, 0);
});

test("price and volume units do not change the evidence ranking", () => {
  const bars = rangeMarket();
  const scaled = bars.map((bar) => ({ ...bar, open: bar.open * 10, high: bar.high * 10, low: bar.low * 10, close: bar.close * 10, volume: bar.volume * 1000 }));
  const summarize = (result) => result.zones.map(({ role, score, tests, relativeVolume }) => ({ role, score, tests, relativeVolume }));
  assert.deepEqual(plain(summarize(detectSupportResistance(bars, bars.length))), plain(summarize(detectSupportResistance(scaled, scaled.length))));
});

test("all visible bars participate without the former 60–600 bar limits", () => {
  const bars = rangeMarket(800);
  const result = detectSupportResistance(bars, bars.length);
  assert.equal(result.barsAnalyzed, 800);
  assert.equal(result.rangeStart, bars[0].time);
  assert.ok(result.zones.some((zone) => zone.startTime < bars[200].time));
  const short = rangeMarket(56);
  assert.ok(detectSupportResistance(short, short.length).zones.length > 0);
  assert.equal(detectSupportResistance(bars, 0).zones.length, 0);
  assert.equal(detectSupportResistance(bars, NaN).zones.length, 0);
  assert.equal(detectSupportResistance(bars, rules.minBars - 1).zones.length, 0);
});

test("panning to historical candles excludes both older and newer off-screen evidence", () => {
  const bars = rangeMarket(800);
  const viewport = { from: bars[200].time, to: bars[423].time };
  const expected = detectSupportResistance(bars.slice(200, 424), 224);
  const result = detectSupportResistance(bars, bars.length, viewport);
  assert.deepEqual(plain(result), plain(expected));
  assert.equal(result.referencePrice, bars[423].close);
  const changed = bars.map((bar, index) => index >= 200 && index <= 423 ? bar : {
    ...bar, open: 900, high: 1000, low: 0, close: 999, volume: 1e12,
  });
  assert.deepEqual(plain(detectSupportResistance(changed, changed.length, viewport)), plain(expected));
});

test("visible time bounds and replay cutoff are intersected before analysis", () => {
  const bars = rangeMarket(800);
  const viewport = { from: bars[100].time + 0.5, to: bars[300].time - 0.5 };
  const result = detectSupportResistance(bars, bars.length, viewport);
  assert.equal(result.barsAnalyzed, 199);
  assert.equal(result.rangeStart, bars[101].time);
  assert.equal(result.asOf, bars[299].time);
  const replay = detectSupportResistance(bars, 224, viewport);
  assert.deepEqual(plain(replay), plain(detectSupportResistance(bars.slice(101, 224), 123)));
  assert.equal(detectSupportResistance(bars, bars.length, null).barsAnalyzed, 0);
  assert.equal(detectSupportResistance(bars, bars.length, { from: Infinity, to: Infinity }).barsAnalyzed, 0);
  assert.equal(detectSupportResistance(bars, bars.length, { from: bars.at(-1).time + 1, to: bars.at(-1).time + 100 }).barsAnalyzed, 0);
});

test("strong visible support is not discarded just because the right-edge price is far away", () => {
  const bars = rangeMarket();
  for (let index = 0; index < 60; index++) {
    const close = 110 + index * 0.2;
    bars.push({ time: bars.at(-1).time + 3600, open: close - 0.1, high: close + 0.4, low: close - 0.4, close, volume: 100 });
  }
  const result = detectSupportResistance(bars, bars.length);
  const support = result.zones.find((zone) => zone.role === "support" && zone.lower <= 94.6 && zone.upper >= 94.6);
  assert.ok(support);
  assert.ok(support.distanceAtr > 8);
});

test("automatic discovery analyzes revealed history independently of a narrow chart viewport", () => {
  const bars = rangeMarket(800);
  const automatic = detectAuto(bars, 224);
  assert.equal(automatic.mode, "automatic");
  assert.equal(automatic.barsAnalyzed, 224);
  assert.equal(automatic.asOf, bars[223].time);
  assert.equal(automatic.rangeStart, bars[0].time);
  assert.equal(automatic.zones.length, 2);
  const narrow = detect(bars, 224, { from: bars[220].time, to: bars[223].time });
  assert.equal(narrow.zones.length, 0);
  const changedFuture = bars.map((bar, index) => index < 224 ? bar : { ...bar, close: 999, high: 1000, low: 0, volume: 1e12 });
  assert.deepEqual(plain(detectAuto(changedFuture, 224)), plain(automatic));
});

test("automatic tracking keeps unshown historical candidates and draws the next support after a break", () => {
  const bars = [80, 90, 100].flatMap((center, group) => rangeMarket().map((bar, index) => ({
    ...bar, time: 1700000000 + (group * 224 + index) * 3600,
    open: bar.open + center - 100, high: bar.high + center - 100,
    low: bar.low + center - 100, close: bar.close + center - 100,
  })));
  const initial = detectAuto(bars, bars.length);
  const lowSupport = initial.candidateZones.find((zone) => zone.role === "support" && zone.lower < 74.6 && zone.upper > 74.6);
  assert.ok(lowSupport);
  assert.ok(!initial.zones.some((zone) => zone.id === lowSupport.id));
  for (let index = 0; index < 3; index++) bars.push({
    time: bars.at(-1).time + 3600, open: 82, high: 82.5, low: 81.5, close: 82, volume: 300,
  });
  const next = detectAuto(bars, bars.length, initial);
  const discovered = next.zones.find((zone) => zone.id === lowSupport.id);
  assert.ok(discovered, "the next support is drawn from the saved pool");
  assert.equal(discovered.lower, lowSupport.lower);
  assert.equal(discovered.upper, lowSupport.upper);
  const retiredIds = new Set(next.retiredZones.map((zone) => zone.id));
  assert.ok(initial.zones.some((zone) => retiredIds.has(zone.id)), "broken zones retire while the next support is added");
  for (const old of initial.zones) {
    assert.equal(next.zones.some((zone) => zone.id === old.id), !retiredIds.has(old.id), "only still-valid previous rectangles remain");
  }
  assert.deepEqual(plain(detectAuto(bars, bars.length, next)), plain(next));
});

test("automatic tracking discovers new formations without another button click", () => {
  const bars = rangeMarket(80).map((bar) => ({ ...bar, open: 100, high: 100.4, low: 99.6, close: 100, volume: 100 }));
  let snapshot = detectAuto(bars, bars.length);
  assert.equal(snapshot.zones.length, 0);
  const newStructure = rangeMarket(80).map((bar, index) => ({ ...bar, time: bars.at(-1).time + (index + 1) * 3600 }));
  for (const bar of newStructure) {
    bars.push(bar);
    snapshot = detectAuto(bars, bars.length, snapshot);
  }
  assert.ok(snapshot.zones.some((zone) => zone.role === "support"));
  assert.ok(snapshot.zones.some((zone) => zone.role === "resistance"));
});

test("confirmed-break retirement agrees between stepwise and batch updates and excludes future closes", () => {
  const fixture = lifecycleFixture();
  const previous = { ...detectAuto(fixture.bars, fixture.bars.length),
    zones: [fixture.seed], trackedZones: [fixture.seed], candidateZones: [fixture.seed] };
  for (let index = 0; index < 3; index++) fixture.append(102, 200);
  fixture.append(99.5);
  fixture.append(99.5);
  const beforeConfirmation = updateSupportResistanceSnapshot(previous, fixture.bars, 32, 1000);
  assert.equal(beforeConfirmation.zones[0].status, "piercing");
  assert.equal(beforeConfirmation.retiredZones.length, 0);
  const completed = updateSupportResistanceSnapshot(previous, fixture.bars, 35, 35);
  assert.equal(completed.zones.length, 0);
  assert.equal(completed.retiredZones[0].invalidatedAt, 33);
  let incremental = previous;
  for (let end = 31; end <= 35; end++) incremental = updateSupportResistanceSnapshot(incremental, fixture.bars, end, end);
  assert.deepEqual(plain(incremental), plain(completed));
  const revisited = updateSupportResistanceSnapshot(completed, fixture.bars, 35, 32);
  assert.equal(revisited.zones[0].status, "piercing");
  assert.equal(revisited.retiredZones.length, 0);
});

test("a broken price area needs fresh post-retirement formations before it can be drawn again", () => {
  const bars = rangeMarket();
  const initial = detectAuto(bars, bars.length);
  const original = initial.zones.find((zone) => zone.role === "resistance");
  for (let index = 0; index < 3; index++) bars.push({
    time: bars.at(-1).time + 3600, open: 112, high: 113, low: 111, close: 112, volume: 500,
  });
  const retiredAt = bars.at(-1).time;
  const retired = detectAuto(bars, bars.length, initial);
  assert.ok(retired.retiredZones.some((zone) => zone.id === original.id));
  for (let index = 0; index < 2; index++) bars.push({
    time: bars.at(-1).time + 3600, open: 100, high: 101, low: 99, close: 100, volume: 100,
  });
  const returned = detectAuto(bars, bars.length, retired);
  assert.ok(!returned.zones.some((zone) => zone.lower <= original.upper && zone.upper >= original.lower));
  const start = bars.at(-1).time;
  bars.push(...rangeMarket(96).map((bar, index) => ({ ...bar, time: start + (index + 1) * 3600 })));
  const reformed = detectAuto(bars, bars.length, returned);
  const replacement = reformed.zones.find((zone) => zone.role === "resistance" && zone.lower <= 105.4 && zone.upper >= 105.4);
  assert.ok(replacement);
  assert.notEqual(replacement.id, original.id);
  assert.ok(replacement.startTime > retiredAt, "old pivots cannot count toward the new structure");
  assert.ok(replacement.tests >= 2);
  assert.ok(reformed.retiredZones.some((zone) => zone.id === original.id));
});

test("history loading is a minimum context target, never a rolling analysis cap", () => {
  const bars = rangeMarket(5500);
  const snapshot = detectAuto(bars, bars.length);
  assert.equal(snapshot.barsAnalyzed, 5500);
  assert.equal(needsMoreSupportResistanceHistory(snapshot), false);
  assert.equal(needsMoreSupportResistanceHistory(detectAuto(bars, 100)), true);
  assert.equal(needsMoreSupportResistanceHistory({ ...snapshot, candidateZones: [] }), true);
});
