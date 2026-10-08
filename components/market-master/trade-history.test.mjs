import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function load(name) {
  const target = { exports: {} };
  vm.runInNewContext(transpile(fs.readFileSync(new URL(`${name}.ts`, import.meta.url), "utf8")), {
    module: target, exports: target.exports, require: load,
  });
  return target.exports;
}
const history = load("./trade-history");
const windowing = load("./chart-window");
const base = { id: "long", type: "Buy", entry: 100, entryTime: 101, units: 10, sl: 90, tp: 130, status: "Open", pnl: 0 };

test("filters combine status, side and actual displayed P&L without altering the positions", () => {
  const trades = [base, { ...base, id: "short", type: "Sell" },
    { ...base, id: "loss", status: "Closed", pnl: -30 },
    { ...base, id: "win", type: "Sell", status: "Closed", pnl: 20 },
    { ...base, id: "flat", status: "Closed", pnl: 0 }];
  const snapshot = JSON.stringify(trades);
  const ids = (filters, price = 95) => Array.from(history.filterTradeHistory(trades, { ...history.DEFAULT_TRADE_HISTORY_FILTERS, ...filters }, price), (t) => t.id);
  assert.deepEqual(ids({ pnl: "loss" }), ["long", "loss"]);
  assert.deepEqual(ids({ pnl: "loss", status: "Closed" }), ["loss"]);
  assert.deepEqual(ids({ pnl: "profit", side: "Sell" }), ["short", "win"]);
  assert.deepEqual(ids({ pnl: "loss" }, 105), ["short", "loss"]);
  assert.deepEqual(ids({ pnl: "flat" }), ["flat"]);
  assert.deepEqual(ids({ pnl: "loss", side: "Sell", status: "Closed" }), []);
  assert.equal(JSON.stringify(trades), snapshot);
});

test("P&L sorts the whole filtered list before pagination, follows floating values and keeps ties stable", () => {
  const trades = Array.from({ length: 120 }, (_, i) => ({ ...base, id: `closed-${i}`, status: "Closed", pnl: i - 60, balanceAfter: 10000 + i }));
  trades.unshift({ ...base, id: "open" });
  trades.push({ ...base, id: "same-profit", status: "Closed", pnl: 59 });
  const before = JSON.stringify(trades);
  const ids = (rows) => Array.from(rows, (trade) => trade.id);
  assert.deepEqual(ids(history.sortTradeHistory(trades, { key: "pnl", direction: "desc" }, 110).slice(0, 3)), ["open", "closed-119", "same-profit"]);
  assert.equal(history.sortTradeHistory(trades, { key: "pnl", direction: "asc" }, 90)[0].id, "open");
  const losses = history.filterTradeHistory(trades, { ...history.DEFAULT_TRADE_HISTORY_FILTERS, pnl: "loss", status: "Closed" }, 110);
  const sorted = history.sortTradeHistory(losses, { key: "pnl", direction: "asc" }, 110);
  assert.equal(sorted[0].pnl, -60);
  assert.equal(sorted.slice(50)[0].pnl, -10);
  assert.equal(history.sortTradeHistory(trades, null, 110), trades);
  assert.equal(JSON.stringify(trades), before);
});

test("balance sorting uses immutable settlement values, includes zero and keeps unsettled records last", () => {
  const trades = [{ ...base, id: "a", status: "Closed", balanceAfter: 15000 },
    { ...base, id: "open", balanceAfter: 99999 }, // An open position has no settled balance.
    { ...base, id: "zero", status: "Closed", balanceAfter: 0 },
    { ...base, id: "old", status: "Closed" },
    { ...base, id: "b", status: "Closed", balanceAfter: 9000 }];
  const ids = (direction) => Array.from(history.sortTradeHistory(trades, { key: "balance", direction }, 100000), (trade) => trade.id);
  assert.deepEqual(ids("desc"), ["a", "b", "zero", "open", "old"]);
  assert.deepEqual(ids("asc"), ["zero", "b", "a", "open", "old"]);
  const filtered = history.filterTradeHistory(trades, { ...history.DEFAULT_TRADE_HISTORY_FILTERS, status: "Closed" }, 10);
  assert.equal(history.sortTradeHistory(filtered, { key: "balance", direction: "asc" }, 10)[1].balanceAfter, 9000);
});

test("focus fits a complete trade with context, while open and same-candle trades remain readable", () => {
  const candles = Array.from({ length: 1000 }, (_, i) => ({ time: i + 1 }));
  const trade = { ...base, status: "Closed", closeTime: 401 };
  const range = history.tradeFocusRange(trade, candles, 700);
  assert.ok(range.from < 100 && range.to > 400 && range.to < 700);
  const openRange = history.tradeFocusRange(base, candles, 700);
  assert.ok(openRange.from <= 100 && openRange.to >= 100 && openRange.to - openRange.from >= 79);
  const fillRange = history.tradeFocusRange({ ...trade, closeTime: 101 }, candles, 700);
  assert.ok(fillRange.to - fillRange.from >= 79);
  const last = history.tradeFocusRange({ ...base, entryTime: 700 }, candles, 700);
  assert.equal(last.to, 699);
  assert.equal(history.tradeFocusRange(trade, candles, 400), null); // close candle is still in the future
  assert.equal(history.tradeFocusRange(base, candles.slice(200), 800), null); // missing entry
  assert.equal(history.tradeFocusRange(base, [], 0), null);
});

const page = ts.createSourceFile("page.tsx", fs.readFileSync(new URL("./MarketMasterPage.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let locate, candleLookup;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(page) === "handleLocateTrade") locate = node.initializer.arguments[0].getText(page);
  if (ts.isVariableDeclaration(node) && node.name.getText(page) === "findCandleByTime") candleLookup = node.initializer.getText(page);
  ts.forEachChild(node, visit);
}
visit(page);

test("old-order marker lookup on million-bar history uses logarithmic candle reads", () => {
  let reads = 0;
  const candles = new Proxy({ length: 1000000 }, { get(target, key) {
    if (key === "length") return target.length;
    reads++;
    return { time: Number(key) + 1, low: 100, high: 110 };
  } });
  const context = vm.createContext({ ...windowing });
  vm.runInContext(transpile(`globalThis.lookup = ${candleLookup}`), context);
  assert.equal(context.lookup(candles, 1).time, 1);
  assert.ok(reads <= 22);
});

test("actual row navigation updates all viewports and highlights the order without advancing or settling trades", () => {
  const calls = [], errors = [], callbacks = [];
  const chart = (name) => ({ timeScale: () => ({ setVisibleLogicalRange: (range) => calls.push([name, range]) }),
    priceScale: () => ({ applyOptions: () => {} }) });
  const position = { ...base, status: "Closed", closeTime: 201, closePrice: 90, pnl: -100 };
  const context = {
    ...history, ...windowing, chartRef: { current: chart("main") }, subChartRef: { current: chart("macd") }, volumeChartRef: { current: chart("volume") },
    updateAutomaticSegmentsAfterCandle() {}, syncDisplayedData: (_data, _cursor, _backtest, _fit, { focusRange }) => {
      for (const name of ["main", "macd", "volume"]) calls.push([name, focusRange]);
    },
    fullDataRef: { current: Array.from({ length: 1000 }, (_, i) => ({ time: i + 1 })) },
    isDataLoadingRef: { current: false }, automaticRunRef: { current: null }, isBacktestModeRef: { current: true },
    currentIndexRef: { current: 700 }, tradesRef: { current: [position] }, focusedTradeIdRef: { current: null },
    preserveVisibleRangeRef: { current: false }, setIsPlaying: (value) => assert.equal(value, false),
    setFocusedTradeId: (id) => calls.push(["selected", id]), setIsRightPriceAutoScaleEnabled() {},
    tradeConnectionRef: { current: { setTrade: (trade) => calls.push(["highlight", trade.id]) } },
    toast: { error: (message) => errors.push(message) }, requestAnimationFrame: (callback) => callbacks.push(callback),
  };
  vm.createContext(context);
  vm.runInContext(transpile(`globalThis.locate = ${locate}`), context);
  const snapshot = JSON.stringify(position);
  context.locate("long");
  const ranges = calls.filter(([name]) => ["main", "macd", "volume"].includes(name));
  assert.equal(ranges.length, 3);
  assert.equal(JSON.stringify(ranges[0][1]), JSON.stringify(ranges[1][1]));
  assert.equal(JSON.stringify(ranges[0][1]), JSON.stringify(ranges[2][1]));
  assert.equal(context.currentIndexRef.current, 700);
  assert.equal(JSON.stringify(position), snapshot);
  assert.equal(context.focusedTradeIdRef.current, "long");
  assert.ok(calls.some(([name, id]) => name === "highlight" && id === "long"));
  assert.equal(context.preserveVisibleRangeRef.current, true);
  callbacks.forEach((callback) => callback());
  assert.equal(context.preserveVisibleRangeRef.current, false);
  context.currentIndexRef.current = 150;
  const count = calls.length;
  context.locate("long");
  assert.equal(calls.length, count);
  assert.equal(errors.length, 1);
  context.automaticRunRef.current = { suppress: true };
  context.locate("long");
  assert.equal(calls.length, count);
});
