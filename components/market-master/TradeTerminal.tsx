import React from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

export const TradeTerminal = ({
  isRightPanelOpen,
  setIsRightPanelOpen,
  symbol,
  currentPrice,
  orderUnits,
  setOrderUnits,
  slEnabled,
  setSlEnabled,
  slDistance,
  setSlDistance,
  tpEnabled,
  setTpEnabled,
  tpDistance,
  setTpDistance,
  handlePlaceOrder,
  priceDecimals,
  riskInputStep,
  isMaximized,
  panelWidth,
  canPlaceOrder = false,
}: any) => {
  if (!isRightPanelOpen && !isMaximized) {
    return (
      <button
        onClick={() => setIsRightPanelOpen(true)}
        className="absolute bottom-3 right-3 z-20 cursor-pointer rounded-full border border-slate-500 bg-gray-800 p-3 text-gray-300 shadow-xl transition-colors hover:bg-gray-700 hover:text-white md:bottom-auto md:right-0 md:top-1/2 md:-translate-y-1/2 md:rounded-l-lg md:rounded-r-none md:border-r-0 md:px-2 md:py-4"
        title="展开交易终端"
        aria-label="展开交易终端"
      >
        <PanelRightOpen size={22} />
      </button>
    );
  }

  if (isRightPanelOpen && !isMaximized) {
    return (
      <>
        <button
          type="button"
          className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsRightPanelOpen(false)}
          aria-label="关闭交易终端"
        />
        <div
          className="absolute inset-x-0 bottom-0 z-30 flex max-h-[min(76dvh,600px)] min-h-0 shrink-0 flex-col overflow-hidden rounded-t-2xl border-t border-gray-700 bg-gray-900 shadow-2xl max-md:!w-full md:static md:max-h-none md:rounded-none md:border-l md:border-t-0 md:border-gray-800 md:shadow-none"
          style={{ width: panelWidth }}
        >
        <div className="flex items-center justify-between border-b border-gray-800 p-3 md:p-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            交易终端
          </h2>
          <button
            onClick={() => setIsRightPanelOpen(false)}
            className="text-gray-500 hover:text-white transition-colors cursor-pointer"
            title="收起侧边栏"
            aria-label="收起交易终端"
          >
            <PanelRightClose size={22} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-4">
          <div className="mb-3 text-center md:mb-6">
            <div className="text-xs text-gray-500 mb-1">
              当前市价 ({symbol})
            </div>
            <div className="font-mono text-2xl font-bold tracking-tight text-white md:text-3xl">
              {currentPrice.toFixed(priceDecimals)}
            </div>
          </div>

          <div className="mb-4 space-y-3 md:mb-6 md:space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                交易数量 (Units)
              </label>
              <input
                type="number"
                value={orderUnits}
                onChange={(e) =>
                  setOrderUnits(Math.max(1, Number(e.target.value)))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slEnabled}
                    onChange={(e) => setSlEnabled(e.target.checked)}
                  />{" "}
                  止损 (点)
                </label>
                <input
                  type="number"
                  step={riskInputStep}
                  value={slDistance}
                  disabled={!slEnabled}
                  onChange={(e) => setSlDistance(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none focus:border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tpEnabled}
                    onChange={(e) => setTpEnabled(e.target.checked)}
                  />{" "}
                  止盈 (点)
                </label>
                <input
                  type="number"
                  step={riskInputStep}
                  value={tpDistance}
                  disabled={!tpEnabled}
                  onChange={(e) => setTpDistance(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none focus:border-emerald-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center mt-2">
              {canPlaceOrder
                ? "提示：建仓后可直接在图表上拖拽止损止盈线"
                : "提示：请先开启逐K回测后再下单（做多/做空）"}
            </div>
          </div>

          <div className="mt-auto flex gap-3 md:mb-4">
            <button
              onClick={() => handlePlaceOrder("Sell")}
              disabled={!canPlaceOrder}
              title={
                canPlaceOrder
                  ? "做空"
                  : "仅在逐K回测模式下可下单，请先开启逐K回测"
              }
              className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-red-900/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-600 disabled:active:scale-100"
            >
              做空 (Sell)
            </button>
            <button
              onClick={() => handlePlaceOrder("Buy")}
              disabled={!canPlaceOrder}
              title={
                canPlaceOrder
                  ? "做多"
                  : "仅在逐K回测模式下可下单，请先开启逐K回测"
              }
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:active:scale-100"
            >
              做多 (Buy)
            </button>
          </div>
        </div>
        </div>
      </>
    );
  }

  return null;
};
