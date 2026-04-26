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
  isMaximized,
}: any) => {
  if (!isRightPanelOpen && !isMaximized) {
    return (
      <button
        onClick={() => setIsRightPanelOpen(true)}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 border-r-0 rounded-l-lg py-4 px-1 text-gray-400 hover:text-white hover:bg-gray-700 shadow-xl z-20"
        title="展开交易终端"
      >
        <PanelRightOpen size={18} />
      </button>
    );
  }

  if (isRightPanelOpen && !isMaximized) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 z-10">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            交易终端
          </h2>
          <button
            onClick={() => setIsRightPanelOpen(false)}
            className="text-gray-500 hover:text-white transition-colors"
            title="收起侧边栏"
          >
            <PanelRightClose size={18} />
          </button>
        </div>

        <div className="p-4 flex flex-col flex-1">
          <div className="text-center mb-6">
            <div className="text-xs text-gray-500 mb-1">
              当前市价 ({symbol})
            </div>
            <div className="text-3xl font-mono font-bold text-white tracking-tight">
              {currentPrice.toFixed(priceDecimals)}
            </div>
          </div>

          <div className="space-y-4 mb-6">
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
                  默认止损 (点)
                </label>
                <input
                  type="number"
                  step={symbol === "XAU/USD" ? "1" : "0.0001"}
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
                  默认止盈 (点)
                </label>
                <input
                  type="number"
                  step={symbol === "XAU/USD" ? "1" : "0.0001"}
                  value={tpDistance}
                  disabled={!tpEnabled}
                  onChange={(e) => setTpDistance(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none focus:border-emerald-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center mt-2">
              提示：建仓后可直接在图表上拖拽止损止盈线
            </div>
          </div>

          <div className="flex gap-3 mt-auto mb-4">
            <button
              onClick={() => handlePlaceOrder("Sell")}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-red-900/20"
            >
              做空 (Sell)
            </button>
            <button
              onClick={() => handlePlaceOrder("Buy")}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
            >
              做多 (Buy)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
