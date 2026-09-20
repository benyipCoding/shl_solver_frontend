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
  isReplayMode = false,
}: any) => {
  if (isMaximized) return null;

  return (
    <div
      className={`flex min-h-0 shrink-0 flex-col border-t border-gray-800 bg-gray-900 ${
        isBottomPanelOpen
          ? "h-[min(38dvh,260px)] md:h-[var(--panel-height)]"
          : "h-10"
      }`}
      style={{ "--panel-height": `${panelHeight}px` } as React.CSSProperties}
    >
      <div
        className="h-10 px-4 border-b border-gray-800 text-sm font-medium text-gray-400 bg-gray-900 flex justify-between items-center shrink-0 cursor-pointer hover:bg-gray-800/80 transition-colors"
        onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
        title={isBottomPanelOpen ? "收起交易记录" : "展开交易记录"}
      >
        <span>交易记录 (持仓与历史)</span>

        <div className="flex items-center gap-4">
          {/* <button
            onClick={(e) => {
              e.stopPropagation();
              handleAIReview();
            }}
            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded transition-colors text-xs font-bold border border-indigo-500/50"
          >
            <Activity size={14} /> 生成 AI 习惯画像
          </button> */}
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
          <div className="space-y-2 p-2 md:hidden">
            {trades.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-600">
                暂无交易数据
              </div>
            )}
            {trades.map((trade: any) => {
              const isOpen = trade.status === "Open";
              const currentPnl = isOpen
                ? trade.type === "Buy"
                  ? (currentPrice - trade.entry) * trade.units
                  : (trade.entry - currentPrice) * trade.units
                : trade.pnl;
              return (
                <article
                  key={trade.id}
                  className="rounded-lg border border-gray-800 bg-gray-900/80 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          isOpen
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {isOpen ? "持仓中" : trade.reason}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          trade.type === "Buy"
                            ? "text-emerald-500"
                            : "text-red-500"
                        }`}
                      >
                        {trade.type}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-sm font-bold ${
                        currentPnl > 0
                          ? "text-emerald-400"
                          : currentPnl < 0
                            ? "text-red-400"
                            : "text-gray-400"
                      }`}
                    >
                      {currentPnl > 0 ? "+" : ""}
                      {currentPnl.toFixed(2)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <dt className="text-gray-600">数量</dt>
                      <dd className="font-mono text-gray-300">{trade.units}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">开仓价</dt>
                      <dd className="font-mono text-gray-300">
                        {trade.entry.toFixed(priceDecimals)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">止损</dt>
                      <dd className="font-mono text-red-400/70">
                        {trade.sl !== null
                          ? trade.sl.toFixed(priceDecimals)
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">止盈</dt>
                      <dd className="font-mono text-emerald-400/70">
                        {trade.tp !== null
                          ? trade.tp.toFixed(priceDecimals)
                          : "-"}
                      </dd>
                    </div>
                  </dl>
                  {isOpen && (
                    <div className="mt-3 flex items-center justify-end gap-3 border-t border-gray-800 pt-3">
                      <button
                        onClick={() => toggleTradeVisibility(trade.id)}
                        className="flex min-h-9 items-center gap-1.5 px-2 text-xs text-gray-400 transition-colors hover:text-white"
                      >
                        {trade.visibleOnChart === false ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                        {trade.visibleOnChart === false ? "显示标线" : "隐藏标线"}
                      </button>
                      {!isReplayMode && (
                        <button
                          onClick={() => handleCloseMarket(trade.id)}
                          className="min-h-9 rounded bg-gray-700 px-4 text-xs text-white transition-colors hover:bg-gray-600"
                        >
                          市价平仓
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <table className="hidden w-full whitespace-nowrap text-left text-sm md:table">
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
                          {!isReplayMode && (
                            <button
                              onClick={() => handleCloseMarket(trade.id)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition-colors"
                            >
                              市价平仓
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-gray-600">已完结</span>
                          {/* <button
                            onClick={() => handleAIReview(trade)}
                            className="text-[10px] flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/50 px-2 py-0.5 rounded transition-colors"
                            title="使用 AI 深度分析此笔交易"
                          >
                            <Bot size={12} /> AI
                          </button> */}
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
