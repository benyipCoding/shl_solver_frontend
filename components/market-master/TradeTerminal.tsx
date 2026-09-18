import React, { useEffect, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

type RiskInputMode = "points" | "amount";

type TradeTerminalProps = {
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (open: boolean) => void;
  symbol: string;
  currentPrice: number;
  orderUnits: number;
  setOrderUnits: (units: number) => void;
  slEnabled: boolean;
  setSlEnabled: (enabled: boolean) => void;
  slDistance: number;
  setSlDistance: (distance: number | ((prev: number) => number)) => void;
  tpEnabled: boolean;
  setTpEnabled: (enabled: boolean) => void;
  tpDistance: number;
  setTpDistance: (distance: number | ((prev: number) => number)) => void;
  handlePlaceOrder: (type: "Buy" | "Sell") => void;
  priceDecimals: number;
  riskInputStep: string;
  isMaximized: boolean;
  panelWidth: number;
  canPlaceOrder?: boolean;
};

const roundTo = (value: number, decimals: number) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** Math.max(0, decimals);
  return Math.round(value * factor) / factor;
};

const formatSignedMoney = (value: number) => {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) return `+$${formatted}`;
  if (value < 0) return `-$${formatted}`;
  return `$${formatted}`;
};

const SignedMoney = ({ value }: { value: number }) => {
  const colorClass =
    value > 0
      ? "text-emerald-400"
      : value < 0
        ? "text-red-400"
        : "text-gray-300";

  return (
    <span className={`font-mono font-semibold ${colorClass}`}>
      {formatSignedMoney(value)}
    </span>
  );
};

const formatPoints = (value: number, decimals: number) => {
  if (!Number.isFinite(value)) return "";
  return String(roundTo(Math.max(0, value), decimals));
};

const formatAmountInput = (value: number) => {
  if (!Number.isFinite(value)) return "";
  return roundTo(Math.max(0, value), 2).toFixed(2);
};

const toInputValue = (
  distance: number,
  units: number,
  mode: RiskInputMode,
  priceDecimals: number
) =>
  mode === "amount"
    ? formatAmountInput(distance * Math.max(0, units))
    : formatPoints(distance, priceDecimals);

const parseRiskInput = (
  raw: string,
  units: number,
  mode: RiskInputMode
): number | null => {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (mode === "points") return parsed;
  return units > 0 ? parsed / units : 0;
};

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
}: TradeTerminalProps) => {
  const [riskInputMode, setRiskInputMode] = useState<RiskInputMode>("points");
  const [slInput, setSlInput] = useState(() =>
    toInputValue(slDistance, orderUnits, "points", priceDecimals)
  );
  const [tpInput, setTpInput] = useState(() =>
    toInputValue(tpDistance, orderUnits, "points", priceDecimals)
  );
  const slFocusedRef = useRef(false);
  const tpFocusedRef = useRef(false);

  useEffect(() => {
    if (!slFocusedRef.current) {
      setSlInput(
        toInputValue(slDistance, orderUnits, riskInputMode, priceDecimals)
      );
    }
    if (!tpFocusedRef.current) {
      setTpInput(
        toInputValue(tpDistance, orderUnits, riskInputMode, priceDecimals)
      );
    }
  }, [orderUnits, priceDecimals, riskInputMode, slDistance, tpDistance]);

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
    const safeUnits = Math.max(1, orderUnits);
    const slAmount = slDistance * safeUnits;
    const tpAmount = tpDistance * safeUnits;
    const hasPrice = currentPrice > 0;
    const slBuyPrice = hasPrice ? currentPrice - slDistance : null;
    const slSellPrice = hasPrice ? currentPrice + slDistance : null;
    const tpBuyPrice = hasPrice ? currentPrice + tpDistance : null;
    const tpSellPrice = hasPrice ? currentPrice - tpDistance : null;
    const riskReward =
      slEnabled && tpEnabled && slDistance > 0
        ? tpDistance / slDistance
        : null;
    const inputStep = riskInputMode === "amount" ? "0.01" : riskInputStep;
    const unitLabel = riskInputMode === "amount" ? "USD" : "点";

    const commitDistance = (
      distance: number,
      setDistance: TradeTerminalProps["setSlDistance"],
      setInput: (value: string) => void
    ) => {
      const nextDistance = roundTo(Math.max(0, distance), priceDecimals);
      setDistance(nextDistance);
      setInput(
        toInputValue(nextDistance, safeUnits, riskInputMode, priceDecimals)
      );
    };

    const handleRiskInputChange = (
      raw: string,
      setInput: (value: string) => void,
      setDistance: TradeTerminalProps["setSlDistance"]
    ) => {
      setInput(raw);
      const nextDistance = parseRiskInput(raw, safeUnits, riskInputMode);
      if (nextDistance == null) return;
      setDistance(nextDistance);
    };

    const handleModeChange = (nextMode: RiskInputMode) => {
      if (nextMode === riskInputMode) return;
      slFocusedRef.current = false;
      tpFocusedRef.current = false;
      setRiskInputMode(nextMode);
    };

    const handleOrderUnitsChange = (raw: string) => {
      const parsed = Number(raw);
      const nextUnits = Math.max(1, Number.isFinite(parsed) ? parsed : 1);
      if (
        riskInputMode === "amount" &&
        orderUnits > 0 &&
        nextUnits !== orderUnits
      ) {
        setSlDistance((slDistance * orderUnits) / nextUnits);
        setTpDistance((tpDistance * orderUnits) / nextUnits);
      }
      setOrderUnits(nextUnits);
    };

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
            <h2 className="text-lg font-bold tracking-wide text-gray-300">
              交易终端
            </h2>
            <button
              onClick={() => setIsRightPanelOpen(false)}
              className="cursor-pointer text-gray-500 transition-colors hover:text-white"
              title="收起侧边栏"
              aria-label="收起交易终端"
            >
              <PanelRightClose size={24} />
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-4">
            <div className="mb-3 text-center md:mb-4">
              <div className="mb-1 text-base text-gray-400">
                当前市价 ({symbol})
              </div>
              <div className="font-mono text-3xl font-bold tracking-tight text-white">
                {hasPrice ? currentPrice.toFixed(priceDecimals) : "-"}
              </div>
            </div>

            <div className="mb-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-base text-gray-400">
                  交易数量 (Units)
                </label>
                <input
                  type="number"
                  min={1}
                  value={orderUnits}
                  onChange={(e) => handleOrderUnitsChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 font-mono text-lg text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-base font-semibold tracking-wide text-gray-300">
                    止损 / 止盈
                  </span>
                  <div
                    className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-0.5"
                    role="group"
                    aria-label="止损止盈输入单位"
                  >
                    <button
                      type="button"
                      onClick={() => handleModeChange("points")}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-base font-semibold transition-colors ${
                        riskInputMode === "points"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      点数
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange("amount")}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-base font-semibold transition-colors ${
                        riskInputMode === "amount"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      金额
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <RiskOffsetField
                    accent="sl"
                    label="止损"
                    enabled={slEnabled}
                    onEnabledChange={setSlEnabled}
                    mode={riskInputMode}
                    unitLabel={unitLabel}
                    step={inputStep}
                    inputValue={slInput}
                    onInputChange={(value) =>
                      handleRiskInputChange(value, setSlInput, setSlDistance)
                    }
                    onFocus={() => {
                      slFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      slFocusedRef.current = false;
                      commitDistance(slDistance, setSlDistance, setSlInput);
                    }}
                    helper={
                      <>
                        <SignedMoney value={-slAmount} />
                        {riskInputMode === "amount" && (
                          <span className="ml-2 text-gray-500">
                            {formatPoints(slDistance, priceDecimals)} 点
                          </span>
                        )}
                      </>
                    }
                    buyPrice={slBuyPrice}
                    sellPrice={slSellPrice}
                    priceDecimals={priceDecimals}
                  />

                  <RiskOffsetField
                    accent="tp"
                    label="止盈"
                    enabled={tpEnabled}
                    onEnabledChange={setTpEnabled}
                    mode={riskInputMode}
                    unitLabel={unitLabel}
                    step={inputStep}
                    inputValue={tpInput}
                    onInputChange={(value) =>
                      handleRiskInputChange(value, setTpInput, setTpDistance)
                    }
                    onFocus={() => {
                      tpFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      tpFocusedRef.current = false;
                      commitDistance(tpDistance, setTpDistance, setTpInput);
                    }}
                    helper={
                      <>
                        <SignedMoney value={tpAmount} />
                        {riskInputMode === "amount" && (
                          <span className="ml-2 text-gray-500">
                            {formatPoints(tpDistance, priceDecimals)} 点
                          </span>
                        )}
                      </>
                    }
                    buyPrice={tpBuyPrice}
                    sellPrice={tpSellPrice}
                    priceDecimals={priceDecimals}
                  />
                </div>

                <div className="mt-3 space-y-1 text-base leading-6 text-gray-400">
                  {riskReward != null && (
                    <div>
                      盈亏比{" "}
                      <span className="font-mono text-gray-200">
                        1 : {riskReward.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div>
                    {riskInputMode === "amount"
                      ? "金额会按 交易数量 × 价差 自动换算止损止盈价位；改数量时金额保持不变。"
                      : "点数即价差。切换到金额可直接按最大亏损/盈利下单。"}
                  </div>
                </div>
              </div>

              <div className="text-center text-base leading-6 text-gray-400">
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
                className="flex-1 rounded-lg bg-red-600 py-3 text-lg font-bold text-white shadow-lg shadow-red-900/20 transition-all hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-600 disabled:active:scale-100"
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
                className="flex-1 rounded-lg bg-emerald-600 py-3 text-lg font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:active:scale-100"
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

const RiskOffsetField = ({
  accent,
  label,
  enabled,
  onEnabledChange,
  mode,
  unitLabel,
  step,
  inputValue,
  onInputChange,
  onFocus,
  onBlur,
  helper,
  buyPrice,
  sellPrice,
  priceDecimals,
}: {
  accent: "sl" | "tp";
  label: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  mode: RiskInputMode;
  unitLabel: string;
  step: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  helper: React.ReactNode;
  buyPrice: number | null;
  sellPrice: number | null;
  priceDecimals: number;
}) => {
  const focusClass =
    accent === "sl" ? "focus:border-red-500/50" : "focus:border-emerald-500/50";
  const barClass = accent === "sl" ? "bg-red-500" : "bg-emerald-500";

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-gray-800 bg-gray-900/80 pl-3 ${
        enabled ? "" : "opacity-60"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-0.5 ${barClass}`} />
      <div className="p-3">
        <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-base text-gray-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="h-5 w-5 accent-current"
          />
          <span>{`${label}（${mode === "amount" ? "金额" : "点数"}）`}</span>
        </label>
        <div className="relative">
          <input
            type="number"
            min={0}
            step={step}
            value={inputValue}
            disabled={!enabled}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className={`w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 pr-14 font-mono text-lg text-white outline-none disabled:cursor-not-allowed disabled:opacity-30 ${focusClass}`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base font-semibold text-gray-400">
            {unitLabel}
          </span>
        </div>
        {enabled && (
          <div className="mt-2 space-y-0.5 text-base leading-6 text-gray-400">
            <div>{helper}</div>
            {buyPrice != null && sellPrice != null && (
              <div className="font-mono text-gray-300">
                做多 {buyPrice.toFixed(priceDecimals)} · 做空{" "}
                {sellPrice.toFixed(priceDecimals)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
