import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Activity,
  Bot,
  Eye,
  EyeOff,
} from "lucide-react";

export const TradeHistory = ({
  isBottomPanelOpen,
  setIsBottomPanelOpen,
  trades,
  currentPrice,
  priceDecimals,
  toggleTradeVisibility,
  handleCloseMarket,
  handleAIReview,
  isMaximized,
  panelHeight,
}: any) => {
  if (isMaximized) return null;

  return (
    <div
      className="bg-gray-900 border-t border-gray-800 flex flex-col shrink-0 min-h-0"
      style={{ height: isBottomPanelOpen ? panelHeight : 40 }}
    >
      <div
        className="h-10 px-4 border-b border-gray-800 text-sm font-medium text-gray-400 bg-gray-900 flex justify-between items-center shrink-0 cursor-pointer hover:bg-gray-800/80 transition-colors"
        onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
        title={isBottomPanelOpen ? "收起交易记录" : "展开交易记录"}
      >
        <span>交易记录 (持仓与历史)</span>

        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAIReview();
            }}
            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded transition-colors text-xs font-bold border border-indigo-500/50"
          >
            <Activity size={14} /> 生成 AI 习惯画像
          </button>
          <button className="text-gray-500 hover:text-white transition-colors">
            {isBottomPanelOpen ? (
              <ChevronDown size={18} />
            ) : (
              <ChevronUp size={18} />
            )}
          </button>
        </div>
      </div>
      {isBottomPanelOpen && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-800/50 text-gray-500 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 font-normal">状态</th>
                <th className="px-4 py-2 font-normal">方向</th>
                <th className="px-4 py-2 font-normal text-right">数量</th>
                <th className="px-4 py-2 font-normal text-right">开仓价</th>
                <th className="px-4 py-2 font-normal text-right">止损 (SL)</th>
                <th className="px-4 py-2 font-normal text-right">止盈 (TP)</th>
                <th className="px-4 py-2 font-normal text-right">平仓价</th>
                <th className="px-4 py-2 font-normal text-right">
                  浮动/已结盈亏
                </th>
                <th className="px-4 py-2 font-normal text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {trades.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-gray-600">
                    暂无交易数据
                  </td>
                </tr>
              )}
              {trades.map((trade: any) => {
                const isOpen = trade.status === "Open";
                const currentPnl = isOpen
                  ? trade.type === "Buy"
                    ? (currentPrice - trade.entry) * trade.units
                    : (trade.entry - currentPrice) * trade.units
                  : trade.pnl;
                return (
                  <tr key={trade.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isOpen
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {isOpen ? "持仓中" : trade.reason}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2 font-bold ${
                        trade.type === "Buy"
                          ? "text-emerald-500"
                          : "text-red-500"
                      }`}
                    >
                      {trade.type}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {trade.units}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {trade.entry.toFixed(priceDecimals)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-red-400/70">
                      {trade.sl !== null
                        ? trade.sl.toFixed(priceDecimals)
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-400/70">
                      {trade.tp !== null
                        ? trade.tp.toFixed(priceDecimals)
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-400">
                      {isOpen ? "-" : trade.closePrice.toFixed(priceDecimals)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono font-bold ${
                        currentPnl > 0
                          ? "text-emerald-400"
                          : currentPnl < 0
                            ? "text-red-400"
                            : "text-gray-400"
                      }`}
                    >
                      {currentPnl > 0 ? "+" : ""}
                      {currentPnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isOpen ? (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => toggleTradeVisibility(trade.id)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title={
                              trade.visibleOnChart === false
                                ? "显示图表标线"
                                : "隐藏图表标线"
                            }
                          >
                            {trade.visibleOnChart === false ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleCloseMarket(trade.id)}
                            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition-colors"
                          >
                            市价平仓
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-gray-600">已完结</span>
                          <button
                            onClick={() => handleAIReview(trade)}
                            className="text-[10px] flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/50 px-2 py-0.5 rounded transition-colors"
                            title="使用 AI 深度分析此笔交易"
                          >
                            <Bot size={12} /> AI
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
