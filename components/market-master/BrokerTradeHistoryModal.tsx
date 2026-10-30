import { useEffect } from "react";
import { History, Loader2, RefreshCw, X } from "lucide-react";
import type { BrokerTrading } from "@/hooks/useBrokerTrading";
import type { BrokerPosition } from "./broker-trading";
import { brokerMoney } from "./broker-trading";

const formatTime = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Date(value * 1000).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

const price = (value: number | null | undefined) =>
  value == null ? "—" : value.toFixed(5);

function HistoryRow({
  item,
  currency,
}: {
  item: BrokerPosition;
  currency: string | null | undefined;
}) {
  const positive = (item.net_pl ?? 0) >= 0;
  return (
    <tr className="border-b border-gray-800/70 last:border-0">
      <td className="px-3 py-2.5 text-gray-300">{item.symbol}</td>
      <td className={`px-3 py-2.5 font-semibold ${item.side === "Buy" ? "text-emerald-400" : "text-red-400"}`}>
        {item.side === "Buy" ? "多" : "空"}
      </td>
      <td className="px-3 py-2.5 text-right font-mono">{item.amount}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-gray-400">{formatTime(item.open_time)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-gray-400">{formatTime(item.close_time)}</td>
      <td className="px-3 py-2.5 text-right font-mono">{price(item.open_rate)}</td>
      <td className="px-3 py-2.5 text-right font-mono">{price(item.close_rate)}</td>
      <td className={`px-3 py-2.5 text-right font-mono font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
        {brokerMoney(item.net_pl, currency)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-400">
        {brokerMoney(item.commission, currency)} / {brokerMoney(item.rollover, currency)}
      </td>
    </tr>
  );
}

export function BrokerTradeHistoryModal({
  broker,
  onClose,
}: {
  broker: BrokerTrading;
  onClose: () => void;
}) {
  const { refreshHistory } = broker;
  useEffect(() => {
    void refreshHistory().catch(() => {});
  }, [refreshHistory]);

  const history = broker.history;
  const items = history?.items ?? [];
  const currency = history?.account.currency ?? broker.snapshot?.account.currency;

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-trade-history-title"
        className="flex max-h-[min(86dvh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-gray-700 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <History size={18} className="text-blue-300" />
            <div>
              <h2 id="broker-trade-history-title" className="font-semibold text-white">福汇历史交易记录</h2>
              <p className="mt-0.5 text-xs text-gray-500">账户 {history?.account.id ?? broker.snapshot?.account.id ?? "—"} · 全部品种 · 全部历史已平仓交易</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refreshHistory().catch(() => {})} disabled={broker.historyLoading} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-40" title="刷新历史记录" aria-label="刷新历史记录">
              {broker.historyLoading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            </button>
            <button type="button" onClick={onClose} className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white" title="关闭" aria-label="关闭历史交易记录">
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {broker.historyError && <p role="alert" className="m-4 rounded border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">{broker.historyError}</p>}
          {broker.historyLoading && !history ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={17} className="animate-spin" />正在从福汇查询交易记录…</div>
          ) : !history ? null : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">福汇账户暂无已平仓交易记录</div>
          ) : (
            <table className="w-full min-w-[980px] whitespace-nowrap text-left text-xs">
              <thead className="sticky top-0 z-10 bg-gray-900 text-gray-500">
                <tr>
                  <th className="px-3 py-2.5 font-normal">品种</th>
                  <th className="px-3 py-2.5 font-normal">方向</th>
                  <th className="px-3 py-2.5 text-right font-normal">数量</th>
                  <th className="px-3 py-2.5 font-normal">开仓时间</th>
                  <th className="px-3 py-2.5 font-normal">平仓时间</th>
                  <th className="px-3 py-2.5 text-right font-normal">开仓价</th>
                  <th className="px-3 py-2.5 text-right font-normal">平仓价</th>
                  <th className="px-3 py-2.5 text-right font-normal">净盈亏</th>
                  <th className="px-3 py-2.5 text-right font-normal">佣金 / 过夜费</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => <HistoryRow key={`${item.trade_id}:${item.close_order_id ?? ""}:${item.close_time ?? ""}:${item.amount}`} item={item} currency={currency} />)}
              </tbody>
            </table>
          )}
        </div>
        <footer className="shrink-0 border-t border-gray-800 px-4 py-2.5 text-xs text-gray-500">
          {history ? `共 ${items.length} 笔。` : ""}成交价格、佣金和过夜费以福汇账户报表为准。
        </footer>
      </section>
    </div>
  );
}
