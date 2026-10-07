// 分笔动能暂时停用，保留原实现供日后恢复；恢复步骤见 components/market-master/pen-momentum.md。
// import assert from "node:assert/strict";
// import fs from "node:fs";
// import test from "node:test";
// import vm from "node:vm";
// import ts from "typescript";

// function load(relativePath, dependencies = {}, globals = {}) {
//   const target = { exports: {} };
//   const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
//   vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
//     { exports: target.exports, module: target, require: (name) => {
//       assert.ok(name in dependencies, `unexpected dependency ${name}`);
//       return dependencies[name];
//     }, ...globals });
//   return target.exports;
// }
// const pensModule = load("./automatic-pens.ts");
// const momentumModule = load("./pen-momentum.ts", { "./automatic-pens": pensModule });
// const { calculatePenMomentum, findPreviousMatchingPen } = momentumModule;
// const config = { enabled: true, atrPeriod: 14, weakThreshold: 0.5, includeDeveloping: true };
// const plain = (value) => JSON.parse(JSON.stringify(value));
// const candles = Array.from({ length: 100 }, (_, i) => ({ time: i + 1, open: 100, close: 100, high: 101, low: 99 }));
// const pen = (start, end, index = 0) => ({
//   startPoint: { price: start, index: 14 + index * 5, time: 15 + index * 5 },
//   endPoint: { price: end, index: 19 + index * 5, time: 20 + index * 5 },
//   trend: end > start ? 1 : -1,
// });
// const upPens = [pen(90, 100), pen(100, 95, 1), pen(95, 100.5, 2)];

// test("up/down/up requires strictly higher starts AND ends", () => {
//   assert.equal(findPreviousMatchingPen(upPens, 2), 0);
//   for (const current of [pen(90, 101, 2), pen(95, 100, 2), pen(89, 101, 2), pen(95, 99, 2)]) {
//     assert.equal(findPreviousMatchingPen([...upPens.slice(0, 2), current], 2), null);
//   }
// });

// test("pairs across more than three pens and broken intermediate structure", () => {
//   const pens = [pen(90, 100), pen(100, 85, 1), pen(85, 103, 2), pen(103, 95, 3), pen(95, 101, 4)];
//   assert.equal(findPreviousMatchingPen(pens, 4), 0);
//   const pair = calculatePenMomentum(candles, config, pens).up;
//   assert.equal(pair.interveningPens, 3);
// });

// test("selects the nearest qualifying pen, not an arbitrary old anchor", () => {
//   const pens = [pen(90, 100), pen(100, 92, 1), pen(92, 101, 2), pen(101, 95, 3), pen(95, 102, 4)];
//   assert.equal(findPreviousMatchingPen(pens, 4), 2);
// });

// test("downward pairing and progress are the exact directional mirror", () => {
//   const mirrored = upPens.map((p) => ({
//     ...p, trend: -p.trend,
//     startPoint: { ...p.startPoint, price: 200 - p.startPoint.price },
//     endPoint: { ...p.endPoint, price: 200 - p.endPoint.price },
//   }));
//   const up = calculatePenMomentum(candles, config, upPens).up;
//   const down = calculatePenMomentum(candles, config, mirrored).down;
//   assert.equal(down.previousIndex, up.previousIndex);
//   assert.equal(down.advance, up.advance);
//   assert.equal(down.score, up.score);
//   assert.equal(down.weak, up.weak);
// });

// test("uses ATR-normalized endpoint advance; equality at the threshold is not weak", () => {
//   const result = calculatePenMomentum(candles, config, upPens).up;
//   assert.equal(result.advance, 0.5);
//   assert.equal(result.referenceAtr, 2);
//   assert.equal(result.score, 0.25);
//   assert.equal(result.weak, true);
//   const equal = calculatePenMomentum(candles, config, [...upPens.slice(0, 2), pen(95, 101, 2)]).up;
//   assert.equal(equal.score, 0.5);
//   assert.equal(equal.weak, false);
// });

// test("reference ATR is frozen at the prior endpoint and includes gaps", () => {
//   const altered = candles.map((bar, index) => index > 19 ? { ...bar, high: 10000, low: 1 } : bar);
//   assert.equal(calculatePenMomentum(altered, config, upPens).up.referenceAtr, 2);
//   const gapped = candles.map((bar, index) => index === 19 ? { ...bar, open: 110, close: 110, high: 111, low: 109 } : bar);
//   assert.equal(calculatePenMomentum(gapped, config, upPens).up.referenceAtr, (13 * 2 + 11) / 14);
// });

// test("insufficient or zero ATR produces an unknown result, never an invented strength", () => {
//   const earlyPens = upPens.map((p) => ({ ...p, startPoint: { ...p.startPoint, index: p.startPoint.index - 14 }, endPoint: { ...p.endPoint, index: p.endPoint.index - 14 } }));
//   assert.equal(calculatePenMomentum(candles, config, earlyPens).up.score, null);
//   const flat = candles.map((bar) => ({ ...bar, high: 100, low: 100 }));
//   const pair = calculatePenMomentum(flat, config, upPens).up;
//   assert.equal(pair.score, null);
//   assert.equal(pair.weak, null);
// });

// test("the final pen is provisional until a following reversal pen exists", () => {
//   assert.equal(calculatePenMomentum(candles, config, upPens).up.developing, true);
//   assert.equal(calculatePenMomentum(candles, { ...config, includeDeveloping: false }, upPens).up, null);
//   const extended = [...upPens, pen(100.5, 96, 3)];
//   assert.equal(calculatePenMomentum(candles, config, extended).up.developing, false);
//   assert.equal(calculatePenMomentum(candles, { ...config, includeDeveloping: false }, extended).up.currentIndex, 2);
// });

// test("an unmatched newest pen does not display stale momentum from an older pair", () => {
//   const broken = [...upPens, pen(100.5, 80, 3), pen(80, 89, 4)];
//   assert.equal(calculatePenMomentum(candles, config, broken).up, null);
// });

// test("scaled instruments retain the same score and data is not mutated", () => {
//   const original = plain(upPens);
//   const scaledCandles = candles.map((bar) => ({ ...bar, open: bar.open * 10, close: bar.close * 10, high: bar.high * 10, low: bar.low * 10 }));
//   const scaledPens = upPens.map((p) => ({ ...p, startPoint: { ...p.startPoint, price: p.startPoint.price * 10 }, endPoint: { ...p.endPoint, price: p.endPoint.price * 10 } }));
//   assert.equal(calculatePenMomentum(scaledCandles, config, scaledPens).up.score, calculatePenMomentum(candles, config, upPens).up.score);
//   assert.deepEqual(plain(upPens), original);
// });

// test("empty and short histories return no pair", () => {
//   for (const data of [[], candles.slice(0, 1)]) {
//     const result = calculatePenMomentum(data, config);
//     assert.equal(result.up, null);
//     assert.equal(result.down, null);
//   }
// });

// test("momentum uses legacy small-amplitude pens while retaining its own ATR normalization", () => {
//   const prices = [...Array(14).fill(100), 100.01, 100.02, 100.03, 100.04,
//     100.03, 100.02, 100.01, 100.005, 100.015, 100.025, 100.035, 100.045];
//   const data = prices.map((price, index) => ({ time: index + 1, open: price, close: price, high: price + 1, low: price - 1 }));
//   const result = calculatePenMomentum(data, config);
//   assert.equal(result.penCount, 3);
//   assert.equal(result.up.previousIndex, 0);
//   assert.equal(result.up.currentIndex, 2);
//   assert.equal(result.up.referenceAtr, 2);
//   assert.ok(Math.abs(result.up.advance - 0.005) < 1e-10);
//   assert.equal(result.up.weak, true);
//   assert.equal(result.up.developing, true);
// });

// test("chart subscription reads only revealed candles, updates on rewind, and detaches cleanly", () => {
//   const effects = [];
//   const results = [];
//   const frames = new Map();
//   let nextFrame = 0;
//   let revealed = candles.slice(0, 30);
//   let listener = null;
//   let attached = null;
//   const series = {
//     data: () => revealed,
//     attachPrimitive: (p) => { attached = p; p.isAttached = true; },
//     detachPrimitive: (p) => { assert.equal(p, attached); p.isAttached = false; attached = null; },
//     subscribeDataChanged: (fn) => { listener = fn; },
//     unsubscribeDataChanged: (fn) => { assert.equal(fn, listener); listener = null; },
//   };
//   const { usePenMomentum: runHook } = load("../../hooks/usePenMomentum.ts", {
//     react: {
//       useRef: (current) => ({ current }), useState: (initial) => [initial, (result) => results.push(result)],
//       useEffect: (fn) => effects.push(fn),
//     },
//     "@/components/market-master/pen-momentum": momentumModule,
//     "@/components/market-master/pen-momentum-primitive": { PenMomentumPrimitive: class { isAttached = false; setPair() {} } },
//   }, {
//     requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
//     cancelAnimationFrame: (id) => frames.delete(id),
//   });
//   runHook({ seriesRef: { current: series }, config, ready: true, marketKey: "test" });
//   const cleanup = effects[0]();
//   const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((fn) => fn()); };
//   flush();
//   assert.equal(results.at(-1).snapshot.asOf, 30);
//   revealed = candles.slice(0, 40); listener(); flush();
//   assert.equal(results.at(-1).snapshot.asOf, 40);
//   revealed = candles.slice(0, 10); listener(); flush();
//   assert.equal(results.at(-1).snapshot.asOf, 10);
//   listener(); cleanup(); flush();
//   assert.equal(listener, null);
//   assert.equal(attached, null);
//   assert.equal(results.at(-1).snapshot.asOf, 10);
// });
