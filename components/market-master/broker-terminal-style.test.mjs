import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const historyTerminal = fs.readFileSync(
  new URL("./TradeTerminal.tsx", import.meta.url),
  "utf8",
);
const brokerTerminal = fs.readFileSync(
  new URL("./BrokerTradeTerminal.tsx", import.meta.url),
  "utf8",
);

test("broker terminal keeps the history terminal responsive shell", () => {
  const sharedCollapsedShell =
    "absolute bottom-3 right-3 z-20 cursor-pointer rounded-full border border-slate-500 bg-gray-800 p-3 text-gray-300 shadow-xl transition-colors hover:bg-gray-700 hover:text-white md:bottom-auto md:right-0 md:top-1/2 md:-translate-y-1/2 md:rounded-l-lg md:rounded-r-none md:border-r-0 md:px-2 md:py-4";
  assert.ok(historyTerminal.includes(sharedCollapsedShell));
  assert.ok(brokerTerminal.includes(sharedCollapsedShell));

  for (const marker of [
    'aria-label="展开交易终端"',
    'aria-label="关闭交易终端"',
    'aria-label="收起交易终端"',
    "max-h-[min(76dvh,600px)]",
    "rounded-t-2xl",
    "max-md:!w-full",
    "md:rounded-none",
    "pb-[max(1rem,env(safe-area-inset-bottom))]",
  ]) {
    assert.ok(historyTerminal.includes(marker), `history terminal missing ${marker}`);
    assert.ok(brokerTerminal.includes(marker), `broker terminal missing ${marker}`);
  }
});

test("broker-specific controls use the established terminal hierarchy", () => {
  for (const marker of [
    "交易终端",
    "FXCM Demo",
    "做空 (Sell)",
    "做多 (Buy)",
    "全部平仓",
    "rounded-xl border border-gray-800 bg-gray-950/40 p-3",
  ]) {
    assert.ok(brokerTerminal.includes(marker), `broker terminal missing ${marker}`);
  }
});
