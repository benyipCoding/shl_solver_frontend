import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const componentDir = path.dirname(fileURLToPath(import.meta.url));

function loadPureModule(filename, dependencies = {}) {
  const target = { exports: {} };
  const source = fs.readFileSync(path.join(componentDir, filename), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports: target.exports,
    module: target,
    require: (name) => dependencies[name],
  });
  return target.exports;
}

const pensModule = loadPureModule("automatic-pens.ts");
const { generateAutomaticSegments } = loadPureModule("automatic-segments.ts", {
  "./automatic-pens": pensModule,
});

function makePens(prices) {
  return prices.slice(1).map((price, index) => ({
    startPoint: { time: index * 2 + 1, price: prices[index], index: index * 2 + 1 },
    endPoint: { time: index * 2 + 2, price, index: index * 2 + 2 },
    trend: index % 2 === 0 ? pensModule.AutomaticPenTrend.Up : pensModule.AutomaticPenTrend.Down,
  }));
}

function endpoints(segments) {
  return segments.map(({ startPoint, endPoint, trend }) => ({
    start: [startPoint.time, startPoint.price],
    end: [endPoint.time, endPoint.price],
    trend,
  }));
}

test("requires a confirmed same-trend pen at least four positions later", () => {
  const pens = makePens([100, 110, 103, 112, 105, 115]);
  assert.equal(generateAutomaticSegments(pens.slice(0, 4)).length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(endpoints(generateAutomaticSegments(pens)))), [
    { start: [1, 100], end: [10, 115], trend: 1 },
  ]);
});

test("connects opposite segments without changing the source pens", () => {
  const pens = makePens([100, 110, 103, 112, 105, 115, 101, 109, 99, 106, 95]);
  const original = JSON.stringify(pens);
  assert.deepEqual(JSON.parse(JSON.stringify(endpoints(generateAutomaticSegments(pens)))), [
    { start: [1, 100], end: [11, 115], trend: 1 },
    { start: [11, 115], end: [20, 95], trend: -1 },
  ]);
  assert.equal(JSON.stringify(pens), original);
});
