import React, { useMemo, useState } from "react";
import type { TradePosition } from "./trade-management";
import { automaticLockedProfit } from "./automatic-pen-risk";
import { DEFAULT_TRADE_HISTORY_FILTERS, filterTradeHistory, sortTradeHistory, tradeHistoryBalance, tradeHistoryPnl, type TradeHistoryFilters, type TradeHistorySort } from "./trade-history";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";

type TradeHistoryProps = {
  isBottomPanelOpen: boolean;
  setIsBottomPanelOpen: (open: boolean) => void;
  trades: TradePosition[];
  currentPrice: number;
  priceDecimals: number;
  toggleTradeVisibility: (tradeId: unknown) => void;
  handleCloseMarket: (tradeId: unknown) => void;
  onManageTrade?: (tradeId: unknown) => void;
  onLocateTrade?: (tradeId: unknown, endpoint?: "entry" | "exit") => void;
  focusedTradeId?: string | number | null;
  handleAIReview?: (trade?: unknown) => void;
  isMaximized: boolean;
  panelHeight: number;
  isReplayMode?: boolean;
};

function AutomaticTradeBadge({ trade }: { trade: TradePosition }) {
  if (!trade.automaticPen) return null;
  const profit = automaticLockedProfit(trade);
  const label = trade.status !== "Open" ? "自动" : profit > 0 ? `保底 $${profit.toFixed(2)}` : "自动 · 未保底";
  return (
    <span className="ml-1 inline-block text-xs text-emerald-400" title="按当前止损价和剩余数量估算；实际成交可能受跳空或滑点影响。">
      {label}{trade.automaticPen.fundedChildId ? " · 已资助加仓" : ""}
    </span>
  );
}

export const TradeHistory = ({
  isBottomPanelOpen,
  setIsBottomPanelOpen,
  trades,
  currentPrice,
  priceDecimals,
  toggleTradeVisibility,
  handleCloseMarket,
  onManageTrade,
  onLocateTrade,
  focusedTradeId = null,
  isMaximized,
  panelHeight,
  isReplayMode = false,
}: TradeHistoryProps) => {
  const [filters, setFilters] = useState<TradeHistoryFilters>({ ...DEFAULT_TRADE_HISTORY_FILTERS });
  const [sort, setSort] = useState<TradeHistorySort>(null);
  const filteredTrades = useMemo(() => filterTradeHistory(trades, filters, currentPrice), [trades, filters, currentPrice]);
  const sortedTrades = useMemo(() => sortTradeHistory(filteredTrades, sort, currentPrice), [filteredTrades, sort, currentPrice]);
  const hasFilters = Object.values(filters).some((value) => value !== "all");
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filteredTrades.length / 50));
  const activePage = Math.min(page, pageCount - 1);
  const pageTrades = sortedTrades.slice(activePage * 50, (activePage + 1) * 50);
  const sortButton = (key: NonNullable<TradeHistorySort>["key"], label: string) => {
    const direction = sort?.key === key ? sort.direction : null;
    const Icon = direction === "desc" ? ArrowDown : direction === "asc" ? ArrowUp : ArrowUpDown;
    return <button type="button" aria-label={`按${key === "pnl" ? "盈亏" : "余额"}排序`}
      title={`${key === "balance" ? "每次成交结算后的账户余额，持仓尚未结算。" : "持仓使用浮动盈亏，已平仓使用已结盈亏。"}点击切换：从大到小 → 从小到大 → 默认顺序`}
      onClick={() => { setSort(direction === "asc" ? null : { key, direction: direction === "desc" ? "asc" : "desc" }); setPage(0); }}
      className={`inline-flex items-center gap-1 rounded px-1 py-1 hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-blue-500 ${direction ? "text-blue-300" : "text-gray-400"}`}>
      {label}<Icon size={14} aria-hidden="true" />
    </button>;
  };
  const balanceLabel = (trade: TradePosition) => tradeHistoryBalance(trade)?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—";
  const filterSelect = (key: keyof TradeHistoryFilters, label: string, options: [string, string][]) => (
    <select aria-label={label} value={filters[key]}
      onChange={(event) => { setFilters({ ...filters, [key]: event.target.value }); setPage(0); }}
      title={key === "pnl" ? "持仓按浮动盈亏筛选，已平仓按已结盈亏筛选" : label}
      className={`max-w-full cursor-pointer rounded border px-1.5 py-1 text-xs outline-none focus:border-blue-500 ${filters[key] !== "all" ? "border-blue-500/50 bg-blue-950 text-blue-200" : "border-gray-700 bg-gray-900 text-gray-300"}`}>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  );
  const statusFilter = () => filterSelect("status", "筛选交易状态", [["all", "全部状态"], ["Open", "持仓中"], ["Closed", "已平仓"]]);
  const sideFilter = () => filterSelect("side", "筛选交易方向", [["all", "全部方向"], ["Buy", "做多"], ["Sell", "做空"]]);
  const pnlFilter = () => filterSelect("pnl", "筛选交易盈亏", [["all", "全部盈亏"], ["loss", "仅亏损"], ["profit", "仅盈利"], ["flat", "持平"]]);
  if (isMaximized) return null;

  const rowInteractions = (trade: Pick<TradePosition, "status" | "id">) => {
    if (!onLocateTrade) return {};
    return {
      tabIndex: 0,
      title: trade.status === "Open" ? "点击定位开仓位置" : "点击定位开仓至平仓区间",
      "aria-current": focusedTradeId === trade.id ? "true" as const : undefined,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        if (
          (event.target as Element).closest("button, a, input, select, textarea")
        ) return;
        onLocateTrade(trade.id);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onLocateTrade(trade.id);
        }
      },
    };
  };

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
        <span>交易记录 <span className="ml-1 text-xs text-gray-500">{filteredTrades.length} / {trades.length}</span><span className="ml-3 hidden text-xs text-gray-500 lg:inline">点击订单定位图表</span></span>

        <div className="flex items-center gap-4">
          {hasFilters && <button type="button" onClick={(event) => { event.stopPropagation(); setFilters({ ...DEFAULT_TRADE_HISTORY_FILTERS }); setPage(0); }} className="text-xs text-blue-400 hover:text-blue-300">清除筛选</button>}
          {/* <button
            onClick={(e) => {
              e.stopPropagation();
              handleAIReview();
            }}
            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded transition-colors text-xs font-bold border border-indigo-500/50"
          >
            <Activity size={14} /> 生成 AI 习惯画像
          </button> */}
          <button aria-label={isBottomPanelOpen ? "收起交易记录" : "展开交易记录"} className="text-gray-500 hover:text-white transition-colors">
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
          <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900 p-2 md:hidden">
            <div className="flex flex-wrap gap-2">{statusFilter()}{sideFilter()}{pnlFilter()}</div>
            <div className="mt-1 flex gap-3 text-xs">{sortButton("pnl", "盈亏")}{sortButton("balance", "余额")}</div>
          </div>
          <div className="space-y-2 p-2 md:hidden">
            {filteredTrades.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-600">
                {trades.length ? "没有符合筛选条件的订单" : "暂无交易数据"}
              </div>
            )}
            {pageTrades.map((trade) => {
              const isOpen = trade.status === "Open";
              const currentPnl = tradeHistoryPnl(trade, currentPrice);
              return (
                <article
                  key={trade.id}
                  {...rowInteractions(trade)}
                  className={`rounded-lg border p-3 ${focusedTradeId === trade.id ? "border-blue-500/60 bg-blue-500/10" : "border-gray-800 bg-gray-900/80"} ${onLocateTrade ? "cursor-pointer hover:bg-gray-800/50 focus-visible:outline-2 focus-visible:outline-blue-500" : ""}`}
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
                      <AutomaticTradeBadge trade={trade} />
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
                    <div className="col-span-2">
                      <dt className="text-gray-600">余额（结算后）</dt>
                      <dd className="font-mono text-gray-300">{balanceLabel(trade)}</dd>
                    </div>
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
                  {!isOpen && <button type="button" onClick={() => onLocateTrade?.(trade.id, "exit")} className="mt-2 text-xs text-blue-400 hover:text-blue-300">定位平仓 · {trade.closePrice?.toFixed(priceDecimals)}</button>}
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
                        {trade.visibleOnChart === false
                          ? "显示标线"
                          : "隐藏标线"}
                      </button>
                      {!isReplayMode && (
                        <button onClick={() => onManageTrade?.(trade.id)} className="min-h-9 rounded border border-gray-700 px-3 text-xs text-gray-300 hover:bg-gray-800">管理</button>
                      )}
                      {!isReplayMode && (
                        <button
                          onClick={() => handleCloseMarket(trade.id)}
                          className="min-h-9 rounded bg-gray-700 px-4 text-xs text-white transition-colors hover:bg-gray-600"
                        >
                          平仓
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <table className="hidden w-full whitespace-nowrap text-left text-sm md:table">
            <thead className="bg-gray-900 text-gray-500 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 font-normal">{statusFilter()}</th>
                <th className="px-4 py-2 font-normal">{sideFilter()}</th>
                <th className="px-4 py-2 font-normal text-right">数量</th>
                <th className="px-4 py-2 font-normal text-right">开仓价</th>
                <th className="px-4 py-2 font-normal text-right">止损 (SL)</th>
                <th className="px-4 py-2 font-normal text-right">止盈 (TP)</th>
                <th className="px-4 py-2 font-normal text-right">平仓价</th>
                <th className="px-4 py-2 font-normal text-right" aria-sort={sort?.key === "pnl" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
                  <span className="mr-2">{sortButton("pnl", "浮动/已结盈亏")}</span>{pnlFilter()}
                </th>
                <th className="px-4 py-2 font-normal text-right" aria-sort={sort?.key === "balance" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>{sortButton("balance", "余额")}</th>
                <th className="px-4 py-2 font-normal text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredTrades.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-gray-600">
                    {trades.length ? "没有符合筛选条件的订单" : "暂无交易数据"}
                  </td>
                </tr>
              )}
              {pageTrades.map((trade) => {
                const isOpen = trade.status === "Open";
                const currentPnl = tradeHistoryPnl(trade, currentPrice);
                return (
                  <tr
                    key={trade.id}
                    {...rowInteractions(trade)}
                    className={`${focusedTradeId === trade.id ? "bg-blue-500/10 ring-1 ring-inset ring-blue-500/40" : "hover:bg-gray-800/30"} ${onLocateTrade ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500" : ""}`}
                  >
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
                      <AutomaticTradeBadge trade={trade} />
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
                      {isOpen ? "-" : <button type="button" onClick={() => onLocateTrade?.(trade.id, "exit")} title="定位平仓位置" className="text-blue-300 underline decoration-dotted underline-offset-4 hover:text-blue-200">{trade.closePrice?.toFixed(priceDecimals) ?? "-"}</button>}
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
                    <td className="px-4 py-2 text-right font-mono text-gray-300" title={isOpen ? "持仓尚未结算" : "本次成交结算后的账户余额"}>{balanceLabel(trade)}</td>
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
                            <button onClick={() => onManageTrade?.(trade.id)} className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">管理</button>
                          )}
                          {!isReplayMode && (
                            <button
                              onClick={() => handleCloseMarket(trade.id)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition-colors"
                            >
                              平仓
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
      {isBottomPanelOpen && pageCount > 1 && <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-800 px-3 py-1.5 text-xs text-gray-400">
        <span>每页 50 条 · {activePage + 1} / {pageCount}</span>
        <button type="button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)} className="rounded border border-gray-700 px-2 py-1 disabled:opacity-30">上一页</button>
        <button type="button" disabled={activePage + 1 >= pageCount} onClick={() => setPage(activePage + 1)} className="rounded border border-gray-700 px-2 py-1 disabled:opacity-30">下一页</button>
      </div>}
    </div>
  );
};
