import { useRef, useState } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import type { BrokerTrading } from "@/hooks/useBrokerTrading";
import {
  brokerExpectedPl,
  brokerMoney,
  brokerRiskPrice,
  type BrokerPosition,
} from "./broker-trading";
import { brokerPendingOrders, pendingOrderKind, pendingOrderLabel } from "./pending-orders";

const inputClass =
  "w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 font-mono text-gray-100 outline-none transition-colors focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40";

export function BrokerTradeTerminal({
  broker,
  onManage,
  onManagePending,
  onCloseAll,
  width,
  visible,
  onToggle,
}: {
  broker: BrokerTrading;
  onManage: (id: string) => void;
  onManagePending?: (orderId: string) => void;
  onCloseAll: () => void;
  width: number;
  visible: boolean;
  onToggle: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [stop, setStop] = useState("");
  const [limit, setLimit] = useState("");
  const [riskMode, setRiskMode] = useState<"price" | "distance" | "amount">(
    "price",
  );
  const [message, setMessage] = useState("");
  const [orderMode, setOrderMode] = useState<"market" | "pending">("market");
  const [pendingRate, setPendingRate] = useState("");
  const snapshot = broker.snapshot;
  const instrument = snapshot?.instrument;
  const currency = snapshot?.account.currency;

  if (!visible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute bottom-3 right-3 z-20 cursor-pointer rounded-full border border-slate-500 bg-gray-800 p-3 text-gray-300 shadow-xl transition-colors hover:bg-gray-700 hover:text-white md:bottom-auto md:right-0 md:top-1/2 md:-translate-y-1/2 md:rounded-l-lg md:rounded-r-none md:border-r-0 md:px-2 md:py-4"
        title="展开交易终端"
        aria-label="展开交易终端"
      >
        <PanelRightOpen size={22} />
      </button>
    );
  }

  const amount =
    quantity === "" ? (instrument?.min_quantity ?? 0) : Number(quantity);
  const validQuantity =
    instrument != null &&
    Number.isSafeInteger(amount) &&
    amount >= instrument.min_quantity &&
    amount <= instrument.max_quantity &&
    amount % instrument.base_unit_size === 0;
  const freshQuote =
    instrument != null &&
    snapshot != null &&
    Math.abs(snapshot.server_time - instrument.quote_time) < 30;
  const money = (value: number | null | undefined) =>
    brokerMoney(value, currency);
  const price = (value: number | null | undefined) =>
    value == null ? "—" : value.toFixed(instrument?.digits ?? 5);
  const unresolved = [
    ...new Map(
      [
        ...(snapshot?.unresolved || []),
        ...(broker.result &&
        ["pending", "unknown"].includes(broker.result.status)
          ? [broker.result]
          : []),
      ].map((result) => [result.client_id, result]),
    ).values(),
  ];
  const currentPositions =
    snapshot?.positions.filter(
      (position) => position.symbol === instrument?.symbol,
    ) ?? [];
  const isPendingMode = orderMode === "pending";
  const pendingRateValue = Number(pendingRate);
  const hasPendingRate = Number.isFinite(pendingRateValue) && pendingRateValue > 0;
  const pendingKind = (side: "Buy" | "Sell") => {
    const market = side === "Buy" ? instrument?.ask : instrument?.bid;
    return hasPendingRate && market ? pendingOrderKind(side, pendingRateValue, market) : null;
  };
  const currentPendingOrders = snapshot ? brokerPendingOrders(snapshot.orders, snapshot.instrument.symbol) : [];
  // Entry orders wait for a price, so they do not need a fresh quote or an
  // open market at submission; FXCM still accepts or rejects them.
  const canOpen =
    broker.ready &&
    validQuantity &&
    instrument?.can_open === true &&
    unresolved.length === 0 &&
    (isPendingMode ? hasPendingRate : freshQuote && instrument.trading_status === "O");

  const submit = async (side: "Buy" | "Sell") => {
    setMessage("");
    try {
      if (!instrument) return;
      const entryRate = isPendingMode ? Number(pendingRateValue.toFixed(instrument.digits)) : undefined;
      await broker.send({
        action: isPendingMode ? "entry" : "open",
        side,
        amount,
        ...(entryRate != null ? { rate: entryRate } : {}),
        // Pending SL/TP points and amounts are measured from the pending rate.
        stop: brokerRiskPrice(stop, riskMode, side, "stop", amount, instrument, entryRate),
        limit: brokerRiskPrice(
          limit,
          riskMode,
          side,
          "limit",
          amount,
          instrument,
          entryRate,
        ),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "交易请求失败");
    }
  };

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[1px] md:hidden"
        onClick={onToggle}
        aria-label="关闭交易终端"
      />
      <aside
        className="absolute inset-x-0 bottom-0 z-30 flex max-h-[min(76dvh,600px)] min-h-0 shrink-0 flex-col overflow-hidden rounded-t-2xl border-t border-gray-700 bg-gray-900 text-gray-200 shadow-2xl max-md:!w-full md:static md:max-h-none md:rounded-none md:border-l md:border-t-0 md:border-gray-800 md:shadow-none"
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-gray-800 p-3 md:p-4">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-lg font-bold tracking-wide text-gray-300">
              交易终端
            </h2>
            <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
              FXCM Demo
            </span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="cursor-pointer text-gray-500 transition-colors hover:text-white"
            title="收起侧边栏"
            aria-label="收起交易终端"
          >
            <PanelRightClose size={24} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-4">
          <div
            role="status"
            className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              broker.ready
                ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-200"
                : "border-amber-800/60 bg-amber-950/30 text-amber-200"
            }`}
          >
            {broker.ready ? (
              <Wifi size={15} className="shrink-0" />
            ) : (
              <WifiOff size={15} className="shrink-0" />
            )}
            <span className="min-w-0 flex-1">{broker.status}</span>
            <button
              type="button"
              onClick={broker.reconnect}
              disabled={broker.busy}
              className="shrink-0 rounded p-1 transition-colors hover:bg-white/10 disabled:opacity-40"
              title="重新连接账户"
              aria-label="重新连接福汇账户"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="mb-3 text-center md:mb-4">
            <div className="mb-2 text-base text-gray-400">
              当前报价 ({instrument?.symbol ?? "—"})
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                <div className="mb-0.5 text-xs font-semibold text-red-300">
                  卖出 Bid
                </div>
                <div className="font-mono text-2xl font-bold tracking-tight text-white">
                  {price(instrument?.bid)}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="mb-0.5 text-xs font-semibold text-emerald-300">
                  买入 Ask
                </div>
                <div className="font-mono text-2xl font-bold tracking-tight text-white">
                  {price(instrument?.ask)}
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              点差 {instrument ? price(instrument.ask - instrument.bid) : "—"}
              <span className="mx-1.5">·</span>
              市价成交以福汇回报为准
            </div>
          </div>

          <div className="mb-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-base font-semibold text-gray-300">
                交易数量
                <span className="text-xs font-normal text-gray-500">Units</span>
              </span>
              <input
                aria-label="福汇下单数量"
                type="number"
                min={instrument?.min_quantity}
                max={instrument?.max_quantity}
                step={instrument?.base_unit_size}
                value={quantity || instrument?.min_quantity || ""}
                onChange={(event) => setQuantity(event.target.value)}
                className={`${inputClass} ${validQuantity ? "" : "border-red-500/60"}`}
              />
              <span className="mt-1 block text-xs text-gray-500">
                最小 {instrument?.min_quantity ?? "—"}，步长{" "}
                {instrument?.base_unit_size ?? "—"}
              </span>
            </label>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold tracking-wide text-gray-300">
                  止损 / 止盈
                </span>
                <div
                  className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-0.5"
                  role="group"
                  aria-label="福汇风控输入方式"
                >
                  {(
                    [
                      ["price", "价位"],
                      ["distance", "点数"],
                      ["amount", "金额"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      type="button"
                      key={mode}
                      aria-pressed={riskMode === mode}
                      onClick={() => {
                        setRiskMode(mode);
                        setStop("");
                        setLimit("");
                      }}
                      className={`cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                        riskMode === mode
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {(
                  [
                    {
                      label: "止损",
                      ariaLabel: "福汇开仓止损",
                      value: stop,
                      setValue: setStop,
                      accent: "bg-red-500",
                      focus: "focus:border-red-500/50",
                    },
                    {
                      label: "止盈",
                      ariaLabel: "福汇开仓止盈",
                      value: limit,
                      setValue: setLimit,
                      accent: "bg-emerald-500",
                      focus: "focus:border-emerald-500/50",
                    },
                  ] as const
                ).map((field) => (
                  <label
                    key={field.label}
                    className="relative block overflow-hidden rounded-lg border border-gray-800 bg-gray-900/80 pl-3"
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-0.5 ${field.accent}`}
                    />
                    <span className="block p-3">
                      <span className="mb-1.5 flex items-center justify-between text-base text-gray-300">
                        {field.label}
                        <span className="text-xs text-gray-500">可选</span>
                      </span>
                      <input
                        aria-label={field.ariaLabel}
                        type="number"
                        step={riskMode === "amount" ? "0.01" : "any"}
                        min={riskMode === "price" ? undefined : 0}
                        value={field.value}
                        placeholder={`输入${field.label}${
                          riskMode === "price"
                            ? "价位"
                            : riskMode === "distance"
                              ? "点数"
                              : "金额"
                        }`}
                        onChange={(event) => field.setValue(event.target.value)}
                        className={`${inputClass} ${field.focus}`}
                      />
                    </span>
                  </label>
                ))}
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                {riskMode === "amount"
                  ? `金额单位为 ${currency || "账户币种"}，按福汇点值换算目标价；不含滑点、过夜费和佣金。`
                  : riskMode === "distance"
                    ? "点数即报价价差，系统会根据买卖方向换算止损止盈价位。"
                    : "直接填写止损止盈价位；留空表示不设置。"}
              </p>
            </div>
          </div>

          <div className="mb-3 space-y-2">
            <div role="group" aria-label="福汇下单方式" className="grid grid-cols-2 rounded-lg border border-gray-700 bg-gray-800 p-0.5">
              {([["market", "市价单"], ["pending", "挂单"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={orderMode === mode}
                  onClick={() => {
                    setOrderMode(mode);
                    if (mode === "pending" && !pendingRate && instrument) {
                      setPendingRate(((instrument.bid + instrument.ask) / 2).toFixed(instrument.digits));
                    }
                  }}
                  className={`cursor-pointer rounded-md py-1.5 text-sm font-semibold transition-colors ${orderMode === mode ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isPendingMode && (
              <label className="block">
                <span className="mb-1 flex items-center justify-between text-sm text-gray-300">
                  挂单价
                  <span className="text-xs text-gray-500">买单对比 Ask、卖单对比 Bid</span>
                </span>
                <input
                  aria-label="福汇挂单价"
                  type="number"
                  step="any"
                  value={pendingRate}
                  onChange={(event) => setPendingRate(event.target.value)}
                  className={`${inputClass} ${hasPendingRate ? "" : "border-red-500/60"}`}
                />
              </label>
            )}
          </div>

          {!canOpen && (
            <p className="mb-3 text-center text-sm leading-5 text-gray-400">
              {!broker.ready
                ? "等待福汇账户连接后可下单"
                : unresolved.length > 0
                  ? "请先核对待确认指令的执行结果"
                  : isPendingMode && !hasPendingRate
                    ? "请输入有效的挂单价"
                    : !isPendingMode && !freshQuote
                    ? "报价已过期，等待最新报价"
                    : !validQuantity
                      ? "请输入符合最小数量和步长要求的交易数量"
                      : "当前品种暂不可开仓"}
            </p>
          )}

          {/* Confirmed commands are announced by a toast, not kept here. */}
          {(message || (broker.result && broker.result.status !== "confirmed")) && (
            <p
              role="status"
              className="mb-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-200"
            >
              {message || broker.result?.message}
            </p>
          )}

          {unresolved.map((result) => (
            <div
              key={result.client_id}
              className="mb-3 rounded-lg border border-amber-700/70 bg-amber-950/20 p-3 text-xs text-amber-100"
            >
              <p>{result.message}</p>
              <button
                type="button"
                className="mt-2 rounded border border-amber-600/60 px-2 py-1 font-semibold transition-colors hover:bg-amber-500/10"
                onClick={() => void broker.reconcile(result.client_id)}
              >
                核对执行结果
              </button>
            </div>
          ))}

          <div className="mt-auto space-y-2 md:mb-4">
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!canOpen}
                className="flex-1 rounded-lg bg-red-600 py-3 text-lg font-bold text-white shadow-lg shadow-red-900/20 transition-all hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-600 disabled:active:scale-100"
                onClick={() => void submit("Sell")}
              >
                {isPendingMode
                  ? `挂卖单${pendingKind("Sell") ? ` (Sell ${pendingKind("Sell") === "limit" ? "Limit" : "Stop"})` : ""}`
                  : "做空 (Sell)"}
              </button>
              <button
                type="button"
                disabled={!canOpen}
                className="flex-1 rounded-lg bg-emerald-600 py-3 text-lg font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:active:scale-100"
                onClick={() => void submit("Buy")}
              >
                {isPendingMode
                  ? `挂买单${pendingKind("Buy") ? ` (Buy ${pendingKind("Buy") === "limit" ? "Limit" : "Stop"})` : ""}`
                  : "做多 (Buy)"}
              </button>
            </div>
            <button
              type="button"
              onClick={onCloseAll}
              disabled={!broker.ready || currentPositions.length === 0}
              className="w-full rounded-lg border border-gray-600 bg-gray-800 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-600 disabled:hover:bg-gray-800 disabled:hover:text-gray-200"
              title={
                currentPositions.length === 0
                  ? "当前品种暂无持仓可平"
                  : `向福汇提交全部 ${currentPositions.length} 笔持仓的市价平仓指令`
              }
            >
              全部平仓
              {currentPositions.length > 0
                ? `（${currentPositions.length} 笔）`
                : ""}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {currentPendingOrders.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-gray-800 bg-gray-950/30 p-3">
                <div className="text-sm font-semibold text-gray-300">
                  当前品种挂单（{currentPendingOrders.length}）
                </div>
                {currentPendingOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-2 rounded bg-gray-900/80 px-2.5 py-2 text-xs">
                    <span className={`min-w-0 flex-1 truncate ${order.type === "Buy" ? "text-emerald-300" : "text-red-300"}`}>
                      {pendingOrderLabel(order)} {order.units} @ <span className="font-mono">{price(order.price)}</span>
                    </span>
                    <button type="button" onClick={() => onManagePending?.(order.id)}
                      className="rounded border border-gray-700 px-2 py-1 text-blue-300 transition-colors hover:bg-gray-800">
                      管理
                    </button>
                  </div>
                ))}
              </div>
            )}
            <details className="group rounded-lg border border-gray-800 bg-gray-950/30">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-gray-300 marker:hidden">
                <span className="flex items-center justify-between">
                  账户全部持仓
                  <span className="text-xs font-normal text-gray-500">
                    {snapshot?.positions.length ?? 0} 笔
                  </span>
                </span>
              </summary>
              <div className="space-y-2 border-t border-gray-800 px-3 py-3">
                {snapshot?.positions.map((position) => (
                  <div
                    key={position.trade_id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded bg-gray-900/80 px-2.5 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-gray-300">
                      <span
                        className={
                          position.side === "Buy"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        {position.side === "Buy" ? "多" : "空"}
                      </span>{" "}
                      {position.symbol} · {position.amount} Units
                    </span>
                    <span
                      className={`font-mono ${
                        (position.net_pl ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {money(position.net_pl)}
                    </span>
                    {position.symbol === instrument?.symbol ? (
                      <button
                        type="button"
                        onClick={() => onManage(position.trade_id)}
                        className="rounded border border-gray-700 px-2 py-1 text-blue-300 transition-colors hover:bg-gray-800"
                      >
                        管理
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
                {!snapshot?.positions.length && (
                  <p className="text-xs text-gray-500">暂无持仓</p>
                )}
              </div>
            </details>

            <details className="group rounded-lg border border-gray-800 bg-gray-950/30">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-gray-300 marker:hidden">
                <span className="flex items-center justify-between">
                  福汇费用参考
                  <span className="text-xs font-normal text-gray-500">
                    佣金 / 过夜费
                  </span>
                </span>
              </summary>
              <div className="space-y-1 border-t border-gray-800 px-3 py-3 text-xs leading-5 text-gray-400">
                <p>
                  每 {instrument?.base_unit_size ?? "—"} Units：开仓佣金 买{" "}
                  {money(instrument?.commission_buy)} / 卖{" "}
                  {money(instrument?.commission_sell)}
                </p>
                <p>
                  隔夜利息 买 {money(instrument?.rollover_buy)} / 卖{" "}
                  {money(instrument?.rollover_sell)}
                </p>
                <p className="text-gray-500">
                  利息按福汇结算日和倍数计收，实际佣金和累计过夜费以持仓详情为准。切换页面不会平仓，止损止盈由福汇执行。
                </p>
              </div>
            </details>

            {!!snapshot?.orders.length && (
              <details className="group rounded-lg border border-gray-800 bg-gray-950/30">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-gray-300 marker:hidden">
                  <span className="flex items-center justify-between">
                    福汇委托
                    <span className="text-xs font-normal text-gray-500">
                      {snapshot.orders.length} 笔
                    </span>
                  </span>
                </summary>
                <div className="space-y-2 border-t border-gray-800 px-3 py-3 text-xs text-gray-400">
                  {snapshot.orders.map((order) => (
                    <p key={order.order_id} className="font-mono">
                      {order.order_id} · {order.type} · {order.status} ·{" "}
                      {order.amount} @ {price(order.rate)}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export function BrokerCloseAllDialog({
  broker,
  selection,
  onDismiss,
}: {
  broker: BrokerTrading;
  selection: { accountId: string; symbol: string; positions: BrokerPosition[] };
  onDismiss: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const submitted = useRef(false);
  const confirm = async () => {
    if (submitted.current) return;
    if (
      broker.snapshot?.account.id !== selection.accountId ||
      broker.snapshot.instrument.symbol !== selection.symbol
    ) {
      setMessage("账户或品种已变化，请重新确认");
      return;
    }
    submitted.current = true;
    setRunning(true);
    try {
      for (const position of selection.positions) {
        await broker.send(
          {
            action: "close",
            trade_id: position.trade_id,
            amount: position.amount,
          },
          { quiet: true },
        );
      }
      toast.success(`福汇已确认平仓 ${selection.positions.length} 笔持仓`);
      onDismiss();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "部分指令未完成，请核对持仓后重新操作",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-close-all-title"
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl"
      >
        <div className="border-b border-gray-700 px-5 py-4">
          <h3
            id="broker-close-all-title"
            className="text-base font-bold text-white"
          >
            确认平掉当前品种全部持仓？
          </h3>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-gray-300">
          <p>
            账户 {selection.accountId} · {selection.symbol}，共有{" "}
            <span className="font-semibold text-amber-300">
              {selection.positions.length}
            </span>{" "}
            笔持仓。
          </p>
          <p>系统将逐笔向福汇发送市价平仓指令，成交价格以福汇回报为准。</p>
          {message && (
            <p role="alert" className="text-red-300">
              {message}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-700 px-5 py-4">
          <button
            type="button"
            disabled={running}
            onClick={onDismiss}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!broker.ready || running || submitted.current}
            onClick={() => void confirm()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? "正在提交…" : "确认全部平仓"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BrokerTradeManagement({
  broker,
  tradeId,
  draft,
  onDismiss,
}: {
  broker: BrokerTrading;
  tradeId: string;
  /** SL/TP prices dragged on the chart, waiting for the user to save them. */
  draft?: { stop?: number; limit?: number };
  onDismiss: () => void;
}) {
  const position = broker.snapshot?.positions.find(
    (item) => item.trade_id === tradeId,
  );
  const digits = broker.snapshot?.instrument.digits;
  const formatRate = (rate: number) => (digits == null ? String(rate) : rate.toFixed(digits));
  const [stop, setStop] = useState(
    draft?.stop != null ? formatRate(draft.stop) : position?.stop?.toString() ?? "",
  );
  const [limit, setLimit] = useState(
    draft?.limit != null ? formatRate(draft.limit) : position?.limit?.toString() ?? "",
  );
  const [amount, setAmount] = useState(position?.amount.toString() ?? "");
  const [status, setStatus] = useState("");

  if (!position) {
    return (
      <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="福汇持仓已结束"
          className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl"
        >
          <div className="border-b border-gray-700 px-5 py-4">
            <h3 className="font-bold text-white">持仓已变化</h3>
          </div>
          <p className="px-5 py-4 text-sm leading-relaxed text-gray-300">
            此持仓编号已结束或拆分。部分平仓后的剩余持仓以福汇列表中的新编号为准。
          </p>
          <div className="flex justify-end border-t border-gray-700 px-5 py-4">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currency = broker.snapshot?.account.currency;
  const instrument = broker.snapshot?.instrument;
  const execute = async (kind: "stop" | "limit" | "close") => {
    try {
      setStatus("");
      await broker.send(
        kind === "close"
          ? { action: "close", trade_id: tradeId, amount: Number(amount) }
          : {
              action: "risk",
              trade_id: tradeId,
              kind,
              rate: (kind === "stop" ? stop : limit).trim()
                ? Number(kind === "stop" ? stop : limit)
                : null,
            },
      );
      // The broker hook confirms success with a toast; a saved SL/TP is done.
      if (kind !== "close") onDismiss();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "指令失败");
    }
  };
  const closeAmount = Number(amount);
  const canClose =
    broker.ready &&
    Number.isSafeInteger(closeAmount) &&
    closeAmount > 0 &&
    closeAmount <= position.amount;

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-trade-management-title"
        className="flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-gray-200 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-700 px-4 py-3">
          <h3
            id="broker-trade-management-title"
            className="font-semibold text-white"
          >
            订单管理 · {position.symbol}
          </h3>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="关闭订单管理"
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-800 px-3 py-2 sm:grid-cols-4">
            <div className="space-y-0.5 font-semibold">
              <span
                className={`block ${
                  position.side === "Buy" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {position.side === "Buy" ? "多单" : "空单"}
              </span>
              <span className="block">{position.amount} Units</span>
            </div>
            <div className="space-y-0.5 text-gray-400">
              <span className="block text-xs">建仓价</span>
              <span className="block font-mono text-gray-200">
                {position.open_rate}
              </span>
            </div>
            <div className="space-y-0.5 text-gray-400">
              <span className="block text-xs">佣金 / 过夜费</span>
              <span className="block font-mono text-gray-200">
                {brokerMoney(position.commission, currency)} /{" "}
                {brokerMoney(position.rollover, currency)}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="block text-xs text-gray-400">当前净盈亏</span>
              <span
                className={`block font-mono ${
                  (position.net_pl ?? 0) >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {brokerMoney(position.net_pl, currency)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-gray-200">止损 / 止盈</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    kind: "stop",
                    label: "止损价格",
                    value: stop,
                    setValue: setStop,
                    dragged: draft?.stop != null,
                  },
                  {
                    kind: "limit",
                    label: "止盈价格",
                    value: limit,
                    setValue: setLimit,
                    dragged: draft?.limit != null,
                  },
                ] as const
              ).map((field) => {
                const expected = field.value.trim() && instrument
                  ? brokerExpectedPl(position, Number(field.value), instrument)
                  : null;
                return (
                <div
                  key={field.kind}
                  className={`rounded-lg border p-3 ${
                    field.dragged ? "border-amber-500/60" : "border-gray-700"
                  }`}
                >
                  <label className="mb-1.5 flex items-center justify-between gap-2 text-gray-300">
                    {field.label}
                    {field.dragged && (
                      <span className="text-xs font-normal text-amber-300">
                        已从图表拖动填入，保存后生效
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      aria-label={
                        field.kind === "stop" ? "福汇持仓止损" : "福汇持仓止盈"
                      }
                      type="number"
                      step="any"
                      value={field.value}
                      onChange={(event) => field.setValue(event.target.value)}
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      disabled={!broker.ready}
                      onClick={() => void execute(field.kind)}
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      保存
                    </button>
                  </div>
                  {expected != null && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      {field.kind === "stop" ? "触发止损" : "触发止盈"}预计
                      {expected >= 0 ? "盈利" : "亏损"}{" "}
                      <span
                        className={`font-mono ${
                          expected >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {brokerMoney(Math.abs(expected), currency)}
                      </span>
                    </p>
                  )}
                </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              预计盈亏按建仓价和持仓数量估算，不含佣金和过夜费。清空价格并保存，可撤销对应的止损或止盈。
            </p>
          </div>

          <div className="grid gap-3 border-t border-gray-700 pt-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label className="flex items-center justify-between font-semibold">
                平仓数量
                <span className="text-xs font-normal text-gray-400">
                  可平 {position.amount} Units
                </span>
              </label>
              <input
                aria-label="福汇平仓数量"
                type="number"
                min={broker.snapshot?.instrument.base_unit_size}
                max={position.amount}
                step={broker.snapshot?.instrument.base_unit_size}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex min-w-0 items-end">
              <button
                type="button"
                disabled={!canClose}
                onClick={() => void execute("close")}
                className="w-full rounded-lg border border-red-500/50 bg-red-500/10 py-2 font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {canClose && closeAmount < position.amount
                  ? `市价平仓 ${closeAmount} Units`
                  : "市价平掉剩余持仓"}
              </button>
            </div>
          </div>

          {status && (
            <p role="status" className="text-sm text-amber-300">
              {status}
            </p>
          )}
          <p className="text-xs text-gray-500">
            所有操作将直接提交到福汇 Demo
            账户，成交价格和最终费用以福汇回报为准。
          </p>
        </div>
      </div>
    </div>
  );
}
