import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const componentDir = path.dirname(fileURLToPath(import.meta.url));

function loadChartUtils() {
  const target = { exports: {} };
  const source = fs.readFileSync(path.join(componentDir, "chart-utils.ts"), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports: target.exports,
    module: target,
    require: (name) => {
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return target.exports;
}

const { calculateBollingerBands } = loadChartUtils();

test("calculates a 20-period SMA with two population standard deviations", () => {
  const data = Array.from({ length: 21 }, (_, index) => ({
    time: index + 1,
    close: index + 1,
  }));
  const bands = calculateBollingerBands(data, 20, 2);

  assert.equal(bands[18].middle, null);
  assert.equal(bands[19].middle, 10.5);
  assert.ok(Math.abs(bands[19].upper - 22.032562594670797) < 1e-12);
  assert.ok(Math.abs(bands[19].lower - -1.0325625946707966) < 1e-12);
  assert.equal(bands[20].middle, 11.5);
});

test("applies a configurable standard-deviation multiplier", () => {
  const data = [1, 2, 3].map((close, index) => ({
    time: index + 1,
    close,
  }));
  const [first, second, third] = calculateBollingerBands(data, 3, 1);

  assert.equal(first.middle, null);
  assert.equal(second.middle, null);
  assert.equal(third.middle, 2);
  assert.ok(Math.abs(third.upper - (2 + Math.sqrt(2 / 3))) < 1e-12);
  assert.ok(Math.abs(third.lower - (2 - Math.sqrt(2 / 3))) < 1e-12);
});
