import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule(name) {
  const exports = {};
  const source = fs.readFileSync(
    new URL(`${name}.ts`, import.meta.url),
    "utf8",
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
      },
    }).outputText,
    { exports, fetch, require: loadModule },
  );
  return exports;
}
const {
  closeTradeUnits,
  calculateTradePnl,
  getRiskPriceError,
  suggestTradeRiskPrice,
  tradeRiskInputToPrice,
  formatTradeRiskInput,
} = loadModule("./trade-management");
const { applyReplayTradeEvents } = loadModule("./backtest-replay");
const { createBacktestPersistClient } = loadModule("./backtest-persistence");
const { TradeConnectionPrimitive } = loadModule("./trade-connection");
const trade = {
  id: "position-1",
  type: "Buy",
  entry: 100,
  entryTime: 1,
  units: 100,
  sl: 90,
  tp: 120,
  status: "Open",
  pnl: 0,
};

test("suggested risk prices follow instrument spacing and the current market on both sides", () => {
  for (const [side, kind, distance, expected] of [
    ["Buy", "sl", 2, 108],
    ["Buy", "tp", 4, 114],
    ["Sell", "sl", 2, 112],
    ["Sell", "tp", 4, 106],
  ]) {
    const price = suggestTradeRiskPrice(side, kind, 110, distance, 2);
    assert.equal(price, expected);
    assert.equal(getRiskPriceError(side, kind, price, 110), null);
  }
  assert.equal(suggestTradeRiskPrice("Buy", "sl", 1.12345, 0.01, 5), 1.11345);
  assert.equal(suggestTradeRiskPrice("Buy", "sl", 0.1, 50, 4), 0.05);
  assert.equal(suggestTradeRiskPrice("Sell", "tp", 0.1, 100, 4), 0.05);
  assert.equal(suggestTradeRiskPrice("Buy", "sl", 100, NaN, 2), 99);
  assert.equal(suggestTradeRiskPrice("Buy", "tp", 100, 0, 2), 102);
  assert.ok(Number.isNaN(suggestTradeRiskPrice("Buy", "sl", 0, 2, 2)));
});

test("price, points and USD amount convert to the expected long and short exit prices", () => {
  for (const [side, kind, input, mode, expected] of [
    ["Buy", "sl", "50", "points", 50],
    ["Sell", "sl", "50", "points", 150],
    ["Buy", "tp", "50", "points", 150],
    ["Sell", "tp", "50", "points", 50],
    ["Buy", "sl", "200", "amount", 98],
    ["Sell", "sl", "200", "amount", 102],
    ["Buy", "tp", "200", "amount", 102],
    ["Sell", "tp", "200", "amount", 98],
    ["Buy", "sl", "98.126", "price", 98.13],
  ]) {
    const position = { ...trade, type: side };
    const price = tradeRiskInputToPrice(position, kind, input, mode, 2);
    assert.equal(price, expected);
    if (mode === "amount") {
      assert.equal(
        calculateTradePnl(position, price),
        kind === "sl" ? -200 : 200,
      );
    }
  }
});

test("amount targets use remaining units after a partial close", () => {
  const { remaining } = closeTradeUnits(trade, 50, 110, 2);
  assert.equal(tradeRiskInputToPrice(remaining, "sl", "200", "amount", 2), 96);
  assert.equal(tradeRiskInputToPrice(remaining, "tp", "200", "amount", 2), 104);
  assert.equal(formatTradeRiskInput(trade, "sl", 98, "amount", 2), "200");
  assert.equal(formatTradeRiskInput(remaining, "sl", 98, "amount", 2), "100");
});

test("unit conversions preserve profitable trailing stops and small FX amounts", () => {
  for (const [position, price, decimals] of [
    [trade, 105, 2],
    [{ ...trade, type: "Sell" }, 95, 2],
    [{ ...trade, entry: 1.12345, units: 1 }, 1.12245, 5],
  ]) {
    for (const mode of ["price", "points", "amount"]) {
      const input = formatTradeRiskInput(position, "sl", price, mode, decimals);
      assert.equal(
        tradeRiskInputToPrice(position, "sl", input, mode, decimals),
        price,
      );
    }
  }
  assert.equal(formatTradeRiskInput(trade, "sl", 105, "points", 2), "-5");
  assert.equal(formatTradeRiskInput(trade, "sl", 105, "amount", 2), "-500");
  assert.equal(
    formatTradeRiskInput(
      { ...trade, entry: 1.12345, units: 1 },
      "sl",
      1.12245,
      "amount",
      5,
    ),
    "0.001",
  );
});

test("invalid and empty risk inputs cannot silently become an entry-price stop", () => {
  for (const mode of ["price", "points", "amount"]) {
    for (const input of ["", " ", "not-a-number", "Infinity"]) {
      assert.ok(
        Number.isNaN(tradeRiskInputToPrice(trade, "sl", input, mode, 2)),
      );
    }
  }
  assert.ok(
    Number.isNaN(
      tradeRiskInputToPrice({ ...trade, units: 0 }, "sl", "200", "amount", 2),
    ),
  );
  assert.equal(formatTradeRiskInput(trade, "sl", NaN, "amount", 2), "");
});

test("partial fills preserve the remaining order and realize only the closed quantity", () => {
  const first = closeTradeUnits(trade, 50, 110, 2);
  assert.equal(first.closed.pnl, 500);
  assert.equal(first.closed.units, 50);
  assert.equal(first.remaining.id, trade.id);
  assert.equal(first.remaining.units, 50);
  assert.equal(first.remaining.sl, 90);
  assert.equal(first.remaining.tp, 120);
  const second = closeTradeUnits(first.remaining, 20, 95, 3);
  const final = closeTradeUnits(second.remaining, 30, 120, 4, "TP Hit");
  assert.equal(final.remaining, null);
  assert.equal(final.closed.reason, "TP Hit");
  assert.equal(first.closed.pnl + second.closed.pnl + final.closed.pnl, 1000);
  assert.equal(
    new Set([first.closed.id, second.closed.id, final.closed.id]).size,
    3,
  );
  assert.equal(trade.units, 100);
});

test("short positions, invalid quantities and already closed positions", () => {
  const short = { ...trade, type: "Sell" };
  assert.equal(closeTradeUnits(short, 25, 90, 2).closed.pnl, 250);
  for (const units of [0, -1, 101, 0.5, NaN, Infinity]) {
    assert.throws(() => closeTradeUnits(trade, units, 110, 2), /平仓数量/);
  }
  assert.throws(() =>
    closeTradeUnits({ ...trade, status: "Closed" }, 1, 110, 2),
  );
});

test("risk validation supports removal and profitable trailing stops on both sides", () => {
  assert.equal(getRiskPriceError("Buy", "sl", null, 110), null);
  assert.equal(getRiskPriceError("Buy", "sl", 105, 110), null);
  assert.equal(getRiskPriceError("Sell", "sl", 95, 90), null);
  assert.equal(getRiskPriceError("Buy", "tp", 120, 110), null);
  assert.equal(getRiskPriceError("Sell", "tp", 80, 90), null);
  for (const [side, kind, price] of [
    ["Buy", "sl", 111],
    ["Sell", "sl", 109],
    ["Buy", "tp", 109],
    ["Sell", "tp", 111],
  ]) {
    assert.ok(getRiskPriceError(side, kind, price, 110));
  }
  assert.ok(getRiskPriceError("Buy", "sl", NaN, 110));
  assert.ok(getRiskPriceError("Buy", "sl", 110, 110));
  assert.equal(
    calculateTradePnl(trade, 120) - calculateTradePnl(trade, 110),
    1000,
  );
  assert.equal(
    calculateTradePnl(trade, 120) - calculateTradePnl(trade, 115),
    500,
  );
});

test("replay restores partial fills, risk removal, remaining stop loss and balances", () => {
  const base = { client_trade_id: trade.id, bar_time: 1, sequence_no: 1 };
  const first = applyReplayTradeEvents(
    [],
    [
      { ...base, event_type: "OPEN", side: "BUY", price: 100, units: 100 },
      { ...base, event_type: "MODIFY_SL", price: 90 },
      { ...base, event_type: "MODIFY_TP", price: 120 },
      { ...base, event_type: "CLOSE", price: 110, units: 50, bar_time: 2 },
      { ...base, event_type: "MODIFY_TP", price: null },
    ],
  );
  assert.equal(first.balanceChange, 500);
  const open = first.trades.find((t) => t.status === "Open");
  assert.equal(open.units, 50);
  assert.equal(open.sl, 90);
  assert.equal(open.tp, null);
  const end = applyReplayTradeEvents(first.trades, [
    {
      ...base,
      event_type: "CLOSE",
      price: 90,
      units: 50,
      bar_time: 3,
      close_reason: "SL_HIT",
    },
  ]);
  assert.equal(first.balanceChange + end.balanceChange, 0);
  assert.equal(end.trades.filter((t) => t.status === "Open").length, 0);
  assert.equal(
    end.trades.reduce((sum, t) => sum + t.units, 0),
    100,
  );
  const legacy = applyReplayTradeEvents(
    [trade],
    [{ ...base, event_type: "CLOSE", price: 101 }],
  );
  assert.equal(legacy.balanceChange, 100);
});

test("persistence sends partial quantity, stable event ID and explicit null risk in order", async () => {
  const requests = [];
  let finish;
  const completed = new Promise((resolve) => {
    finish = resolve;
  });
  const client = createBacktestPersistClient();
  client.configure({
    enabled: true,
    fetchFn: async (url, init) => {
      requests.push({ url, ...JSON.parse(init.body) });
      if (url.endsWith("/complete")) finish();
      return new Response(
        JSON.stringify({ data: { public_id: "test-session" } }),
      );
    },
  });
  client.startSession({});
  client.recordOpen({
    client_trade_id: "one",
    units: 100,
    price: 100,
    bar_time: 1,
  });
  client.recordClose({
    client_trade_id: "one",
    client_event_id: "close:one:close:1",
    units: 50,
    price: 110,
    bar_time: 2,
  });
  client.recordModify({
    client_trade_id: "one",
    kind: "sl",
    price: null,
    bar_time: 2,
  });
  client.completeSession({});
  await completed;
  assert.equal(requests[1].event_type, "OPEN");
  assert.equal(requests[2].units, 50);
  assert.equal(requests[2].client_event_id, "close:one:close:1");
  assert.equal(requests[3].event_type, "MODIFY_SL");
  assert.equal(requests[3].price, null);
});

test("hover connection uses actual entry/exit prices, supports same-bar fills and clears", () => {
  const primitive = new TradeConnectionPrimitive();
  const path = [];
  let updates = 0;
  primitive.attached({
    chart: { timeScale: () => ({ timeToCoordinate: (time) => time * 10 }) },
    series: { priceToCoordinate: (price) => 500 - price },
    requestUpdate: () => {
      updates += 1;
    },
  });
  const ctx = {
    save() {},
    restore() {},
    setLineDash() {},
    beginPath() {},
    stroke() {},
    arc() {},
    fill() {},
    moveTo: (x, y) => path.push([x, y]),
    lineTo: (x, y) => path.push([x, y]),
  };
  const draw = () =>
    primitive
      .paneViews()[0]
      .renderer()
      .draw({ useMediaCoordinateSpace: (fn) => fn({ context: ctx }) });
  primitive.setTrade({
    ...trade,
    status: "Closed",
    closeTime: 1,
    closePrice: 110,
    pnl: 1000,
  });
  draw();
  assert.deepEqual(path, [
    [10, 400],
    [10, 390],
  ]);
  primitive.setTrade(null);
  path.length = 0;
  draw();
  assert.equal(path.length, 0);
  assert.equal(updates, 2);
  primitive.detached();
  assert.doesNotThrow(draw);
});
