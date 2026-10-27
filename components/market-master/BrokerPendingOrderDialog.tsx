"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { BrokerTrading } from "@/hooks/useBrokerTrading";
import { brokerPendingOrders, pendingOrderKind, pendingOrderLabelZh } from "./pending-orders";

const inputClass =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-gray-100 outline-none transition-colors focus:border-blue-500";

export type BrokerPendingDialogTarget =
  | { mode: "create"; side: "Buy" | "Sell"; price: number }
  | { mode: "manage"; id: string };

const optionalRate = (value: string) => (value.trim() ? Number(value) : null);

/**
 * FXCM entry (pending) order: create one at a chosen price, or manage an
 * existing one (move it, set/remove its stop and limit, cancel it). Every
 * action is a separate broker command confirmed against the account tables.
 */
export function BrokerPendingOrderDialog({
  broker,
  target,
  onDismiss,
}: {
  broker: BrokerTrading;
  target: BrokerPendingDialogTarget;
  onDismiss: () => void;
}) {
  const snapshot = broker.snapshot;
  const instrument = snapshot?.instrument;
  const order = target.mode === "manage" && snapshot
    ? brokerPendingOrders(snapshot.orders, snapshot.instrument.symbol).find((item) => item.id === target.id)
    : undefined;
  const side = target.mode === "create" ? target.side : order?.type ?? "Buy";
  const digits = instrument?.digits ?? 5;
  const [rate, setRate] = useState(
    (target.mode === "create" ? target.price : order?.price)?.toFixed(digits) ?? ""
  );
  const [amount, setAmount] = useState(String(order?.units ?? instrument?.min_quantity ?? ""));
  const [stop, setStop] = useState(order?.sl?.toFixed(digits) ?? "");
  const [limit, setLimit] = useState(order?.tp?.toFixed(digits) ?? "");
  const [status, setStatus] = useState("");

  if (target.mode === "manage" && !order) {
    return (
      <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div role="dialog" aria-modal="true" aria-label="福汇挂单已结束"
          className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl">
          <div className="border-b border-gray-700 px-5 py-4">
            <h3 className="font-bold text-white">挂单已变化</h3>
          </div>
          <p className="px-5 py-4 text-sm leading-relaxed text-gray-300">
            此挂单已成交或已撤销。成交后的持仓可在持仓列表或建仓箭头处管理。
          </p>
          <div className="flex justify-end border-t border-gray-700 px-5 py-4">
            <button type="button" onClick={onDismiss}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rateValue = Number(rate);
  const market = instrument ? (side === "Buy" ? instrument.ask : instrument.bid) : 0;
  const kind = rateValue > 0 && market > 0 ? pendingOrderKind(side, rateValue, market) : null;
  const amountValue = Number(amount);
  const validAmount = instrument != null && Number.isSafeInteger(amountValue) &&
    amountValue >= instrument.min_quantity && amountValue <= instrument.max_quantity &&
    amountValue % instrument.base_unit_size === 0;

  const run = async (command: Parameters<BrokerTrading["send"]>[0]) => {
    try {
      setStatus("");
      // Success is announced by the broker hook's toast.
      await broker.send(command);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "指令失败");
      return false;
    }
  };

  const create = async () => {
    if (await run({
      action: "entry", side, amount: amountValue, rate: rateValue,
      stop: optionalRate(stop), limit: optionalRate(limit),
    })) onDismiss();
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="broker-pending-title"
        className="flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-700 px-4 py-3">
          <h3 id="broker-pending-title" className="font-semibold text-white">
            {target.mode === "create" ? "新建挂单" : "挂单管理"} · {instrument?.symbol ?? ""}
          </h3>
          <button type="button" onClick={onDismiss} aria-label="关闭挂单管理"
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-800 px-3 py-2 sm:grid-cols-4">
            <div className="space-y-0.5 font-semibold">
              <span className={`block ${side === "Buy" ? "text-emerald-400" : "text-red-400"}`}>
                {kind ? pendingOrderLabelZh({ type: side, kind }) : side === "Buy" ? "买入挂单" : "卖出挂单"}
              </span>
              <span className="block">{target.mode === "manage" ? order?.units : amount || "—"} Units</span>
            </div>
            <div className="space-y-0.5 text-gray-400">
              <span className="block text-xs">挂单价</span>
              <span className="block font-mono text-gray-200">{rateValue > 0 ? rateValue.toFixed(digits) : "—"}</span>
            </div>
            <div className="space-y-0.5 text-gray-400">
              <span className="block text-xs">{side === "Buy" ? "买入 Ask" : "卖出 Bid"}</span>
              <span className="block font-mono text-gray-200">{market > 0 ? market.toFixed(digits) : "—"}</span>
            </div>
            <div className="space-y-0.5 text-gray-400">
              <span className="block text-xs">距现价</span>
              <span className="block font-mono text-gray-200">
                {rateValue > 0 && market > 0 ? Math.abs(rateValue - market).toFixed(digits) : "—"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-lg border border-gray-700 p-3">
              <span className="mb-1.5 block text-gray-300">挂单价</span>
              <div className="flex gap-2">
                <input aria-label="福汇挂单价" type="number" step="any" value={rate}
                  onChange={(event) => setRate(event.target.value)} className={`${inputClass} min-w-0 flex-1`} />
                {target.mode === "manage" && order?.brokerOrderId && (
                  <button type="button" disabled={!broker.ready || !(rateValue > 0)}
                    onClick={() => void run({ action: "entry_edit", order_id: order.brokerOrderId, rate: rateValue })}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
                    保存
                  </button>
                )}
              </div>
            </label>
            <label className="block rounded-lg border border-gray-700 p-3">
              <span className="mb-1.5 flex items-center justify-between text-gray-300">
                数量 (Units)
                <span className="text-xs text-gray-500">
                  {target.mode === "create" ? `最小 ${instrument?.min_quantity ?? "—"}，步长 ${instrument?.base_unit_size ?? "—"}` : "挂单数量不可修改"}
                </span>
              </span>
              <input aria-label="福汇挂单数量" type="number" value={amount} disabled={target.mode === "manage"}
                min={instrument?.min_quantity} step={instrument?.base_unit_size}
                onChange={(event) => setAmount(event.target.value)}
                className={`${inputClass} ${target.mode === "create" && !validAmount ? "border-red-500/60" : ""} disabled:opacity-50`} />
            </label>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-gray-200">止损 / 止盈（相对挂单价）</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { kind: "stop", label: "止损价格", value: stop, setValue: setStop },
                { kind: "limit", label: "止盈价格", value: limit, setValue: setLimit },
              ] as const).map((field) => (
                <div key={field.kind} className="rounded-lg border border-gray-700 p-3">
                  <label className="mb-1.5 block text-gray-300">{field.label}</label>
                  <div className="flex gap-2">
                    <input aria-label={field.kind === "stop" ? "福汇挂单止损" : "福汇挂单止盈"} type="number" step="any"
                      value={field.value} placeholder="留空表示不设置"
                      onChange={(event) => field.setValue(event.target.value)} className={`${inputClass} min-w-0 flex-1`} />
                    {target.mode === "manage" && order?.brokerOrderId && (
                      <button type="button" disabled={!broker.ready}
                        onClick={() => void run({ action: "entry_risk", order_id: order.brokerOrderId, kind: field.kind, rate: optionalRate(field.value) })}
                        className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
                        保存
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {target.mode === "manage" && (
              <p className="text-xs text-gray-500">清空价格并保存，可撤销对应的止损或止盈。</p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-700 pt-3">
            {target.mode === "create" ? (
              <button type="button" disabled={!broker.ready || !validAmount || !(rateValue > 0)} onClick={() => void create()}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
                提交福汇挂单
              </button>
            ) : order?.brokerOrderId && (
              <button type="button" disabled={!broker.ready}
                onClick={async () => { if (await run({ action: "entry_cancel", order_id: order.brokerOrderId })) onDismiss(); }}
                className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                撤销挂单
              </button>
            )}
          </div>

          {status && <p role="status" className="text-sm text-amber-300">{status}</p>}
          <p className="text-xs text-gray-500">
            挂单直接提交到福汇 Demo 账户：买单低于 Ask、卖单高于 Bid 为限价挂单，反之为止损挂单；成交价与费用以福汇回报为准。
          </p>
        </div>
      </div>
    </div>
  );
}
