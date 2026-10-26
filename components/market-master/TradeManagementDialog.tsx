"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, X } from "lucide-react";
import {
  calculateTradePnl,
  formatTradeRiskInput,
  getRiskPriceError,
  suggestTradeRiskPrice,
  tradeRiskInputToPrice,
  type TradeRiskInputMode,
  type TradeRiskKind,
  type TradePosition,
} from "./trade-management";
import {
  getPendingRiskError,
  pendingOrderKind,
  pendingOrderLabelZh,
} from "./pending-orders";

/** Pending-order variant: no position yet, so no closing; price is editable. */
export type PendingDialogConfig = {
  mode: "create" | "manage";
  onSubmit: (draft: { price: number; units: number; sl: number | null; tp: number | null }) => string | null;
  onCancelOrder?: () => void;
};

type Props = {
  trade: TradePosition;
  symbol: string;
  currentPrice: number;
  priceDecimals: number;
  riskInputStep: string;
  defaultSlDistance: number;
  defaultTpDistance: number;
  onDismiss: () => void;
  onSaveRisk: (
    tradeId: TradePosition["id"],
    sl: number | null,
    tp: number | null,
  ) => string | null;
  onCloseUnits: (tradeId: TradePosition["id"], units: number) => void;
  pending?: PendingDialogConfig;
};

const Money = ({ value }: { value: number }) => (
  <span
    className={`font-mono ${value >= 0 ? "text-emerald-400" : "text-red-400"}`}
  >
    {value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}
  </span>
);

export function TradeManagementDialog(props: Props) {
  const [riskInputMode, setRiskInputMode] =
    useState<TradeRiskInputMode>("price");
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const keepInViewport = () => {
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
      panel.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - rect.height - 8))}px`;
    };
    panel.style.left = `${Math.max(8, (window.innerWidth - panel.offsetWidth) / 2)}px`;
    panel.style.top = `${Math.max(8, (window.innerHeight - panel.offsetHeight) / 2)}px`;
    keepInViewport();
    window.addEventListener("resize", keepInViewport);
    const observer = new ResizeObserver(keepInViewport);
    observer.observe(panel);
    return () => {
      window.removeEventListener("resize", keepInViewport);
      observer.disconnect();
    };
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button"))
      return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    panel.style.left = `${Math.max(8, Math.min(drag.left + event.clientX - drag.x, window.innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(drag.top + event.clientY - drag.y, window.innerHeight - panel.offsetHeight - 8))}px`;
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="trade-management-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          props.onDismiss();
        }
      }}
      className="fixed z-100 flex max-h-[calc(100dvh-16px)] w-[800px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-900 text-gray-200 shadow-2xl sm:aspect-[1000/618]"
    >
      <div
        className="flex shrink-0 touch-none cursor-move select-none items-center justify-between border-b border-gray-700 px-4 py-2.5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onLostPointerCapture={() => {
          dragRef.current = null;
        }}
      >
        <h3
          id="trade-management-title"
          className="flex items-center gap-2 font-semibold"
        >
          <GripHorizontal size={18} className="text-gray-500" />
          {props.pending ? (props.pending.mode === "create" ? "新建挂单" : "挂单管理") : "订单管理"} · {props.symbol}
        </h3>
        <button
          type="button"
          onClick={props.onDismiss}
          aria-label="关闭订单管理"
          className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>
      <TradeManagementForm
        key={`${props.trade.id}:${props.trade.units}:${props.trade.sl}:${props.trade.tp}`}
        {...props}
        riskInputMode={riskInputMode}
        setRiskInputMode={setRiskInputMode}
      />
    </div>,
    document.body,
  );
}

function TradeManagementForm({
  trade,
  currentPrice,
  priceDecimals,
  riskInputStep,
  defaultSlDistance,
  defaultTpDistance,
  riskInputMode,
  setRiskInputMode,
  onDismiss,
  onSaveRisk,
  onCloseUnits,
  pending,
}: Props & {
  riskInputMode: TradeRiskInputMode;
  setRiskInputMode: (mode: TradeRiskInputMode) => void;
}) {
  const [priceInput, setPriceInput] = useState(trade.entry.toFixed(priceDecimals));
  const [unitsInput, setUnitsInput] = useState(String(trade.units));
  const draftPrice = Number(priceInput);
  const draftUnits = Number(unitsInput);
  // A pending order's SL/TP and P&L preview are measured from its own price.
  const riskTrade = pending
    ? { ...trade, entry: draftPrice, units: draftUnits > 0 ? draftUnits : trade.units }
    : trade;
  const riskReference = pending ? draftPrice : currentPrice;
  const suggestedPrice = (kind: TradeRiskKind) =>
    suggestTradeRiskPrice(
      trade.type,
      kind,
      riskReference,
      kind === "sl" ? defaultSlDistance : defaultTpDistance,
      priceDecimals,
    );
  const createDraft = (kind: TradeRiskKind) => {
    const price = trade[kind] ?? suggestedPrice(kind);
    return {
      price,
      input: formatTradeRiskInput(
        riskTrade,
        kind,
        price,
        riskInputMode,
        priceDecimals,
      ),
      edited: false,
    };
  };
  const [slEnabled, setSlEnabled] = useState(trade.sl != null);
  const [tpEnabled, setTpEnabled] = useState(trade.tp != null);
  const [slDraft, setSlDraft] = useState(() => createDraft("sl"));
  const [tpDraft, setTpDraft] = useState(() => createDraft("tp"));
  const [closeInput, setCloseInput] = useState(String(trade.units));
  const [saveError, setSaveError] = useState<string | null>(null);
  const sl = slEnabled ? slDraft.price : null;
  const tp = tpEnabled ? tpDraft.price : null;
  const changeInputMode = (mode: TradeRiskInputMode) => {
    if (mode === riskInputMode) return;
    // Keep the canonical price unchanged when switching units, including
    // profitable trailing stops and amounts smaller than one cent.
    setSlDraft((draft) => ({
      ...draft,
      input: formatTradeRiskInput(
        riskTrade,
        "sl",
        draft.price,
        mode,
        priceDecimals,
      ),
    }));
    setTpDraft((draft) => ({
      ...draft,
      input: formatTradeRiskInput(
        riskTrade,
        "tp",
        draft.price,
        mode,
        priceDecimals,
      ),
    }));
    setRiskInputMode(mode);
  };
  const inputUnit =
    riskInputMode === "price"
      ? "价位"
      : riskInputMode === "points"
        ? "点"
        : "USD";
  const pendingError = !pending
    ? null
    : !Number.isFinite(draftPrice) || draftPrice <= 0
      ? "挂单价必须是大于 0 的有效价格"
      : !Number.isSafeInteger(draftUnits) || draftUnits <= 0
        ? "交易数量必须为正整数"
        : null;
  const riskError = pending
    ? pendingError ||
      getPendingRiskError(trade.type, "sl", sl, draftPrice) ||
      getPendingRiskError(trade.type, "tp", tp, draftPrice)
    : getRiskPriceError(trade.type, "sl", sl, currentPrice) ||
      getRiskPriceError(trade.type, "tp", tp, currentPrice);
  const hasChanges =
    sl !== trade.sl ||
    tp !== trade.tp ||
    (pending != null && (draftPrice !== trade.entry || draftUnits !== trade.units));
  const pendingKind = pending && Number.isFinite(draftPrice) && draftPrice > 0 && currentPrice > 0
    ? pendingOrderKind(trade.type, draftPrice, currentPrice)
    : null;
  const units = Number(closeInput);
  const canClose =
    Number.isInteger(units) &&
    units > 0 &&
    units <= trade.units &&
    currentPrice > 0;
  const floatingPnl = calculateTradePnl(trade, currentPrice);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
      {pending ? (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-800 px-3 py-2 sm:grid-cols-4">
        <div className="space-y-0.5 font-semibold">
          <span className={`block ${trade.type === "Buy" ? "text-emerald-400" : "text-red-400"}`}>
            {pendingKind ? pendingOrderLabelZh({ type: trade.type, kind: pendingKind }) : trade.type === "Buy" ? "买入挂单" : "卖出挂单"}
          </span>
          <span className="block">{Number.isSafeInteger(draftUnits) && draftUnits > 0 ? draftUnits : "—"} Units</span>
        </div>
        <div className="space-y-0.5 text-gray-400">
          <span className="block text-xs">挂单价</span>
          <span className="block font-mono text-gray-200">
            {Number.isFinite(draftPrice) && draftPrice > 0 ? draftPrice.toFixed(priceDecimals) : "—"}
          </span>
        </div>
        <div className="space-y-0.5 text-gray-400">
          <span className="block text-xs">当前市价</span>
          <span className="block font-mono text-gray-200">{currentPrice.toFixed(priceDecimals)}</span>
        </div>
        <div className="space-y-0.5 text-gray-400">
          <span className="block text-xs">距当前市价</span>
          <span className="block font-mono text-gray-200">
            {Number.isFinite(draftPrice) && draftPrice > 0 ? Math.abs(draftPrice - currentPrice).toFixed(priceDecimals) : "—"}
          </span>
        </div>
      </div>
      ) : (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-800 px-3 py-2 sm:grid-cols-4">
        <div className="space-y-0.5 font-semibold">
          <span
            className={`block ${
              trade.type === "Buy" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trade.type === "Buy" ? "多单" : "空单"}
          </span>
          <span className="block">剩余 {trade.units} Units</span>
        </div>
        <div className="space-y-0.5 text-gray-400">
          <span className="block text-xs">建仓价</span>
          <span className="block font-mono text-gray-200">
            {trade.entry.toFixed(priceDecimals)}
          </span>
        </div>
        <div className="space-y-0.5 text-gray-400">
          <span className="block text-xs">当前市价</span>
          <span className="block font-mono text-gray-200">
            {currentPrice.toFixed(priceDecimals)}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="block text-xs text-gray-400">当前浮动盈亏</span>
          <Money value={floatingPnl} />
        </div>
      </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">止损 / 止盈</h4>
            {hasChanges && (
              <span className="text-xs text-amber-300">未保存</span>
            )}
          </div>
          <div
            role="group"
            aria-label="订单止损止盈输入单位"
            className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-0.5"
          >
            {(
              [
                ["price", "价位"],
                ["points", "点数"],
                ["amount", "金额"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={riskInputMode === mode}
                onClick={() => changeInputMode(mode)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${riskInputMode === mode ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={(pending?.mode !== "create" && !hasChanges) || !!riskError}
            onClick={() => {
              const error = pending
                ? pending.onSubmit({ price: draftPrice, units: draftUnits, sl, tp })
                : onSaveRisk(trade.id, sl, tp);
              setSaveError(error);
              if (error === null) onDismiss();
            }}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? (pending.mode === "create" ? "确认挂单" : "保存挂单") : "保存止损 / 止盈"}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                kind: "sl",
                label: "止损",
                enabled: slEnabled,
                setEnabled: setSlEnabled,
                draft: slDraft,
                setDraft: setSlDraft,
                price: sl,
              },
              {
                kind: "tp",
                label: "止盈",
                enabled: tpEnabled,
                setEnabled: setTpEnabled,
                draft: tpDraft,
                setDraft: setTpDraft,
                price: tp,
              },
            ] as const
          ).map((field) => (
            <div
              key={field.kind}
              className="min-w-0 rounded-lg border border-gray-700 p-3"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  className="flex items-center gap-2"
                  title={
                    field.kind === "sl"
                      ? "点数/金额正数表示亏损，负数表示锁定盈利"
                      : "点数/金额正数表示盈利，负数表示亏损"
                  }
                >
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      field.setEnabled(enabled);
                      setSaveError(null);
                      if (
                        enabled &&
                        !field.draft.edited &&
                        trade[field.kind] == null
                      ) {
                        const price = suggestedPrice(field.kind);
                        field.setDraft({
                          price,
                          input: formatTradeRiskInput(
                            riskTrade,
                            field.kind,
                            price,
                            riskInputMode,
                            priceDecimals,
                          ),
                          edited: false,
                        });
                      }
                    }}
                    className="h-4 w-4 accent-blue-500"
                  />
                  {field.label}
                </label>
                {riskInputMode !== "price" &&
                  Number.isFinite(field.draft.price) && (
                    <span className="text-xs text-gray-400">
                      价位{" "}
                      <span className="font-mono text-gray-200">
                        {field.draft.price.toFixed(priceDecimals)}
                      </span>
                    </span>
                  )}
              </div>
              <div className="relative">
                <input
                  aria-label={`${field.label}${riskInputMode === "price" ? "价格" : riskInputMode === "points" ? "点数" : "金额"}`}
                  type="number"
                  step={riskInputMode === "amount" ? "0.01" : riskInputStep}
                  value={field.draft.input}
                  disabled={!field.enabled}
                  placeholder={`输入${field.label}${inputUnit}`}
                  onChange={(e) => {
                    const input = e.target.value;
                    field.setDraft({
                      input,
                      price: tradeRiskInputToPrice(
                        riskTrade,
                        field.kind,
                        input,
                        riskInputMode,
                        priceDecimals,
                      ),
                      edited: true,
                    });
                    setSaveError(null);
                  }}
                  onBlur={() => {
                    if (Number.isFinite(field.draft.price))
                      field.setDraft((draft) => ({
                        ...draft,
                        input: formatTradeRiskInput(
                          riskTrade,
                          field.kind,
                          draft.price,
                          riskInputMode,
                          priceDecimals,
                        ),
                      }));
                  }}
                  className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 pr-14 font-mono outline-none focus:border-blue-500 disabled:opacity-40"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {inputUnit}
                </span>
              </div>
              {field.enabled &&
                field.price != null &&
                Number.isFinite(field.price) && (
                  <div
                    className="mt-2 space-y-1 text-sm text-gray-400"
                    aria-live="polite"
                  >
                    <div className="flex justify-between">
                      <span>预计盈亏</span>
                      <Money value={calculateTradePnl(riskTrade, field.price)} />
                    </div>
                    <div>
                      {pending ? "距挂单价" : "距当前市价"}{" "}
                      {Math.abs(field.price - riskReference).toFixed(
                        priceDecimals,
                      )}{" "}
                      点
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
        {(riskError || saveError) && (
          <p role="alert" className="text-xs text-red-400">
            {riskError || saveError}
          </p>
        )}
      </div>

      {pending ? (
      <div className="grid gap-3 border-t border-gray-700 pt-3 sm:grid-cols-3">
        <label className="min-w-0 space-y-2">
          <span className="flex items-center justify-between font-semibold">
            挂单价
            {pendingKind && <span className="text-xs font-normal text-gray-400">{pendingKind === "limit" ? "限价" : "止损"}挂单</span>}
          </span>
          <input
            aria-label="挂单价"
            type="number"
            step={riskInputStep}
            value={priceInput}
            onChange={(e) => { setPriceInput(e.target.value); setSaveError(null); }}
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-1.5 font-mono outline-none focus:border-blue-500"
          />
        </label>
        <label className="min-w-0 space-y-2">
          <span className="block font-semibold">数量 (Units)</span>
          <input
            aria-label="挂单数量"
            type="number"
            min={1}
            step={1}
            value={unitsInput}
            onChange={(e) => { setUnitsInput(e.target.value); setSaveError(null); }}
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-1.5 font-mono outline-none focus:border-blue-500"
          />
        </label>
        <div className="flex min-w-0 items-end">
          {pending.onCancelOrder ? (
            <button
              type="button"
              onClick={pending.onCancelOrder}
              className="w-full rounded-lg border border-red-500/50 bg-red-500/10 py-1.5 font-semibold text-red-300 hover:bg-red-500/20"
            >
              撤销挂单
            </button>
          ) : (
            <p className="text-xs leading-5 text-gray-500">
              买单价格低于现价为限价挂单、高于现价为止损挂单；卖单相反。
            </p>
          )}
        </div>
      </div>
      ) : (
      <div className="grid gap-3 border-t border-gray-700 pt-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <label
            htmlFor="trade-close-units"
            className="flex items-center justify-between font-semibold"
          >
            平仓数量
            <span className="text-xs font-normal text-gray-400">
              可平 1–{trade.units} Units
            </span>
          </label>
          <div className="flex gap-2">
            <input
              id="trade-close-units"
              type="number"
              min={1}
              max={trade.units}
              step={1}
              value={closeInput}
              onChange={(e) => setCloseInput(e.target.value)}
              className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 font-mono outline-none focus:border-blue-500"
            />
            <button
              type="button"
              disabled={trade.units < 2}
              onClick={() => setCloseInput(String(Math.floor(trade.units / 2)))}
              className="rounded border border-gray-600 px-2 hover:bg-gray-800 disabled:opacity-40"
            >
              一半
            </button>
            <button
              type="button"
              onClick={() => setCloseInput(String(trade.units))}
              className="rounded border border-gray-600 px-2 hover:bg-gray-800"
            >
              全部
            </button>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span>本次预计实现盈亏</span>
            {canClose ? (
              <Money value={calculateTradePnl(trade, currentPrice, units)} />
            ) : (
              <span>—</span>
            )}
          </div>
          <button
            type="button"
            disabled={!canClose}
            onClick={() => onCloseUnits(trade.id, units)}
            className="w-full rounded-lg border border-red-500/50 bg-red-500/10 py-1.5 font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {canClose && units < trade.units
              ? `市价平仓 ${units} Units`
              : "市价平掉剩余持仓"}
          </button>
        </div>
      </div>
      )}
      <p className="text-xs text-gray-500">
        {pending
          ? "K线触及挂单价时成交（跳空按开盘价）；止损止盈从成交后的下一根K线开始生效。也可在图上拖动挂单虚线改价。"
          : riskInputMode === "price"
          ? "未设置时按品种和当前市价预填参考价，勾选后保存即可。拖动标题栏可移动窗口。"
          : `点数即价差，按建仓价和剩余 ${trade.units} Units 换算；止损正数为亏损，负数为锁盈。`}
      </p>
    </div>
  );
}
