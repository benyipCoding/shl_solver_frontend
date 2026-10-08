import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const plain = (value) => JSON.parse(JSON.stringify(value));
function frames() {
  let id = 0;
  const pending = new Map();
  return {
    requestAnimationFrame: (fn) => { pending.set(++id, fn); return id; },
    cancelAnimationFrame: (key) => pending.delete(key),
    flush: () => { const jobs = [...pending.values()]; pending.clear(); jobs.forEach((fn) => fn()); },
    get size() { return pending.size; },
  };
}
function loadModule(file, globals = {}) {
  const target = { exports: {} };
  vm.runInNewContext(transpile(fs.readFileSync(new URL(file, import.meta.url), "utf8")), {
    module: target, exports: target.exports, ...globals,
  });
  return target.exports;
}
function guardHarness() {
  const raf = frames(), document = new EventTarget(), window = new EventTarget();
  let resumes = 0;
  const { bindChartPanGuard } = loadModule("./chart-pan-guard.ts", { document, window, ...raf });
  const guard = bindChartPanGuard((target) => target === document, () => resumes++);
  const pointer = (type, id = 1, pointerType = "mouse", button = 0) => {
    const event = new Event(type);
    Object.assign(event, { pointerId: id, pointerType, button });
    (type === "pointerdown" ? document : window).dispatchEvent(event);
  };
  return { raf, guard, pointer, window, get resumes() { return resumes; } };
}

test("data-window replacement and fetched history wait until the drag and library mouseup finish", async () => {
  const h = guardHarness();
  h.pointer("pointerdown");
  assert.equal(h.guard.isActive(), true);
  let applied = false;
  const history = h.guard.whenIdle().then(() => { applied = true; });
  await Promise.resolve();
  assert.equal(applied, false);
  h.pointer("pointerup");
  assert.equal(h.guard.isActive(), true);
  assert.equal(h.resumes, 0);
  h.raf.flush();
  await history;
  assert.equal(applied, true);
  assert.equal(h.guard.isActive(), false);
  assert.equal(h.resumes, 1);
  h.guard.dispose();
});

test("pinch, pointer cancellation and a new drag before the scheduled release keep the guard active", () => {
  const h = guardHarness();
  h.pointer("pointerdown", 1, "touch");
  h.pointer("pointerdown", 2, "touch");
  h.pointer("pointerup", 1, "touch");
  h.raf.flush();
  assert.equal(h.guard.isActive(), true);
  h.pointer("pointercancel", 2, "touch");
  h.pointer("pointerdown", 3);
  h.raf.flush();
  assert.equal(h.guard.isActive(), true);
  assert.equal(h.resumes, 0);
  h.pointer("pointerup", 3);
  h.raf.flush();
  assert.equal(h.resumes, 1);
  h.guard.dispose();
});

test("blur releases pending work, right click is ignored, and cleanup removes listeners and frames", async () => {
  const h = guardHarness();
  h.pointer("pointerdown", 1, "mouse", 2);
  assert.equal(h.guard.isActive(), false);
  h.pointer("pointerdown");
  h.window.dispatchEvent(new Event("blur"));
  h.raf.flush();
  assert.equal(h.guard.isActive(), false);
  assert.equal(h.resumes, 1);
  h.pointer("pointerdown");
  const pending = h.guard.whenIdle();
  h.pointer("pointerup");
  h.guard.dispose();
  await pending;
  h.raf.flush();
  h.pointer("pointerdown");
  assert.equal(h.guard.isActive(), false);
  assert.equal(h.resumes, 1);
});

// Run the real page window-shift handler against a virtual million-bar source.
const source = fs.readFileSync(new URL("./MarketMasterPage.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let shiftSource;
function visit(node) {
  if (ts.isBinaryExpression(node) && node.left.getText(ast) === "shiftChartWindowRef.current") shiftSource = node.right.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(shiftSource);
function windowHarness() {
  const raf = frames(), calls = [];
  let range = { from: 290, to: 490 }, dragging = false;
  const chart = { timeScale: () => ({ getVisibleLogicalRange: () => range }) };
  const context = {
    ...loadModule("./chart-window.ts"), ...raf,
    chartPanGuardRef: { current: { isActive: () => dragging } },
    restartingBacktestRef: { current: false }, preserveVisibleRangeRef: { current: false },
    chartViewportSyncRef: { current: false }, automaticRunRef: { current: null }, isDataLoadingRef: { current: false },
    chartWindowRef: { current: { from: 500000, to: 505000 } },
    isBacktestModeRef: { current: false }, currentIndexRef: { current: 1000000 }, fullDataRef: { current: { length: 1000000 } },
    dataSessionRef: { current: 1 }, chartRef: { current: chart }, updateAutomaticSegmentsAfterCandle() {},
    syncDisplayedData: (...args) => {
      const focus = args.at(-1).focusRange;
      calls.push(plain(focus));
      context.chartWindowRef.current = context.selectChartWindow(1000000, focus);
      range = { from: focus.from - context.chartWindowRef.current.from, to: focus.to - context.chartWindowRef.current.from };
    },
  };
  vm.createContext(context);
  vm.runInContext(transpile(`globalThis.shift = ${shiftSource};`), context);
  return { context, raf, calls, move: (next) => { range = next; context.shift(next); }, drag: (value) => { dragging = value; }, get range() { return range; } };
}

test("a long drag crossing the window edge never rebases under the pointer, then preserves its final viewport", () => {
  for (const side of ["left", "right"]) {
    const h = windowHarness();
    h.drag(true);
    for (let i = 0; i < 50; i++) {
      h.move(side === "left" ? { from: 290 - i, to: 490 - i } : { from: 4520 + i, to: 4720 + i });
      h.raf.flush();
    }
    assert.equal(h.calls.length, 0);
    assert.equal(h.context.chartWindowRef.current.from, 500000);
    const last = { from: 500000 + h.range.from, to: 500000 + h.range.to };
    h.drag(false);
    h.move(h.range);
    h.raf.flush();
    assert.deepEqual(h.calls, [last]);
    assert.equal(h.context.chartWindowRef.current.from + h.range.from, last.from);
    assert.equal(h.context.chartWindowRef.current.to - h.context.chartWindowRef.current.from, 5000);
    assert.equal(h.context.currentIndexRef.current, 1000000);
  }
});

test("queued window shifts use the latest wheel position, ignore restored transient ranges and defer for new drags", () => {
  const h = windowHarness();
  h.move({ from: 290, to: 490 });
  h.move({ from: 200, to: 400 });
  h.raf.flush();
  assert.deepEqual(h.calls, [{ from: 500200, to: 500400 }]);
  const original = h.context.chartWindowRef.current;
  h.move({ from: 290, to: 490 });
  h.move({ from: 2400, to: 2600 }); // Library completes its pending range restoration.
  h.raf.flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.context.chartWindowRef.current, original);
  h.move({ from: 290, to: 490 });
  h.drag(true);
  h.raf.flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.context.preserveVisibleRangeRef.current, false);
});

test("an old queued shift cannot reposition a different market or a replaced chart window", () => {
  for (const kind of ["session", "window", "chart"]) {
    const h = windowHarness();
    h.move({ from: 290, to: 490 });
    if (kind === "session") h.context.dataSessionRef.current++;
    if (kind === "window") h.context.chartWindowRef.current = { from: 0, to: 5000 };
    if (kind === "chart") h.context.chartRef.current = null;
    h.raf.flush();
    assert.equal(h.calls.length, 0);
    assert.equal(h.context.preserveVisibleRangeRef.current, false);
  }
});
