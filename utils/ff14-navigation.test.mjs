import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(new URL("./ff14-navigation.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText, { exports, URL, URLSearchParams });
const { parseFflogsReport, getFflogsReportUrl, readFF14Navigation, buildFF14NavigationUrl } = exports;
const origin = "https://example.com";
const read = path => readFF14Navigation(new URL(path, origin).searchParams);
const navigate = (path, patch) => buildFF14NavigationUrl(new URL(path, origin).href, patch);

test("both query and legacy fragment FFLogs links identify the same report", () => {
  for (const input of [
    " https://www.fflogs.com/reports/AbC123?fight=7&type=damage-done ",
    "https://cn.fflogs.com/reports/AbC123/#fight=7&type=damage-done",
  ]) {
    assert.equal(getFflogsReportUrl(parseFflogsReport(input)), "https://www.fflogs.com/reports/AbC123?fight=7");
  }
  assert.equal(parseFflogsReport("https://fflogs.com/reports/AbC123?fight=last").fightId, "last");
});

test("malformed and unrelated report URLs cannot become API requests", () => {
  for (const input of ["", "garbage", "https://fflogs.com.evil.test/reports/AbC123?fight=7", "ftp://fflogs.com/reports/AbC123?fight=7", "https://fflogs.com/reports/AbC123", "https://fflogs.com/reports/AbC123?fight=-1", "https://fflogs.com/reports/AbC123?fight=all", "https://fflogs.com/reports/AbC123/other?fight=7"]) {
    assert.equal(parseFflogsReport(input), null, input);
  }
});

test("shared player detail restores the full view in a fresh URL reader", () => {
  let path = navigate("/ff14", { report: { reportId: "AbC123", fightId: "7" } });
  path = navigate(path, { playerId: "42" });
  path = navigate(path, { compareActorId: "Ref456:8", zoomIndex: 4, locale: "en", showSummaryValues: true });
  const state = read(path);
  assert.equal(state.report.reportId, "AbC123");
  assert.equal(state.report.fightId, "7");
  assert.equal(state.playerId, "42");
  assert.equal(state.compareActorId, "Ref456:8");
  assert.equal(state.zoomIndex, 4);
  assert.equal(state.locale, "en");
  assert.equal(state.showSummaryValues, true);
  assert.equal(navigate(path, {}), path, "repeated actions do not create another URL");
});

test("switching reports, fights or players clears dependent selections", () => {
  const original = "/ff14?report=AbC123&fight=7&player=42&compare=Ref456%3A8&zoom=2&lang=en&values=1";
  for (const patch of [{ report: { reportId: "Other", fightId: "7" } }, { report: { reportId: "AbC123", fightId: "8" } }, { report: null }]) {
    const state = read(navigate(original, patch));
    assert.equal(state.playerId, "");
    assert.equal(state.compareActorId, "");
    assert.equal(state.zoomIndex, 7);
    assert.equal(state.locale, "en");
    assert.equal(state.showSummaryValues, true);
  }
  assert.equal(read(navigate(original, { playerId: "43" })).compareActorId, "");
});

test("returning to summary clears detail and allows history to restore the exact prior view", () => {
  const detail = "/ff14?report=AbC123&fight=7&player=42&compare=Ref456%3A8&zoom=2";
  const summary = navigate(detail, { playerId: "" });
  assert.equal(summary, "/ff14?report=AbC123&fight=7");
  assert.equal(read(detail).compareActorId, "Ref456:8");
  assert.equal(read(summary).playerId, "");
});

test("unrelated URL state survives updates and default values are omitted", () => {
  assert.equal(navigate("/ff14?campaign=friend&lang=en#analysis", { locale: "zh" }), "/ff14?campaign=friend#analysis");
  assert.equal(navigate("/ff14?report=AbC123&fight=7&player=42&zoom=2", { zoomIndex: 7 }), "/ff14?report=AbC123&fight=7&player=42");
});

test("invalid URL parameters safely fall back without selecting the wrong player", () => {
  for (const zoom of ["-1", "9", "1.5", "Infinity", "hello", ""]) {
    assert.equal(read(`/ff14?report=AbC123&fight=7&player=42&zoom=${zoom}`).zoomIndex, 7);
  }
  assert.equal(read("/ff14?report=../etc&fight=7&player=42").report, null);
  assert.equal(read("/ff14?report=AbC123&fight=bad&player=42").playerId, "");
  assert.equal(read("/ff14?report=AbC123&fight=7&player=bad").playerId, "");
  assert.equal(read("/ff14?compare=Ref456%3A8&zoom=0").compareActorId, "");
  assert.equal(read("/ff14?lang=unknown").locale, "zh");
  assert.equal(read("/ff14?report=AbC123&fight=7&player=42&zoom=0").zoomIndex, 0);
});
