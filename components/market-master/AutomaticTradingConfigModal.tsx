import { useEffect, useRef, useState } from "react";
import { Bot, X } from "lucide-react";
import { automaticTradingConfigError, DEFAULT_AUTOMATIC_TRADING_CONFIG, type AutomaticTradingConfig } from "./automatic-trading-config";

type NumericConfigKey = { [K in keyof AutomaticTradingConfig]: AutomaticTradingConfig[K] extends number ? K : never }[keyof AutomaticTradingConfig];

export function AutomaticTradingConfigModal({ config, enabled, balance, penModeLocked = false, onApply, onDisable, onClose }: {
  config: AutomaticTradingConfig; enabled: boolean; balance: number;
  penModeLocked?: boolean;
  onApply: (config: AutomaticTradingConfig) => void; onDisable: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState({ ...config });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const numberField = (key: NumericConfigKey, label: string, suffix: string, step = "any") => (
    <label className="block space-y-1.5 text-sm text-slate-300">
      <span>{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 focus-within:border-blue-500">
        <input aria-label={label} type="number" step={step} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
          className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-white outline-none" />
        <span className="shrink-0 text-xs text-slate-500">{suffix}</span>
      </div>
    </label>
  );
  return (
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-labelledby="automatic-config-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(860px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-700 bg-gray-900 p-0 text-slate-200 shadow-2xl backdrop:bg-black/70">
      <form onSubmit={(e) => { e.preventDefault(); const issue = automaticTradingConfigError(draft); setError(issue); if (!issue) onApply({ ...draft }); }} className="flex max-h-[90dvh] flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 id="automatic-config-title" className="flex items-center gap-2 font-semibold"><Bot size={20} className="text-emerald-400" />自动做单 · 策略配置中心</h2>
          <button type="button" aria-label="关闭策略配置" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800"><X size={20} /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <nav aria-label="交易策略" className="shrink-0 border-b border-slate-800 bg-slate-950/40 p-3 md:w-44 md:border-b-0 md:border-r">
            <button type="button" aria-current="page" className="w-full rounded-lg bg-emerald-500/10 px-3 py-3 text-left text-sm font-semibold text-emerald-300">分笔做单系统</button>
            <p className="mt-3 hidden px-3 text-xs leading-5 text-slate-500 md:block">五笔确认趋势，第六笔入场。按结构止损，使用保底利润加仓。</p>
          </nav>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
            <section className="space-y-3">
              <h3 className="font-semibold">分笔算法</h3>
              <select aria-label="策略分笔算法" value={draft.penMode} disabled={penModeLocked}
                onChange={(e) => setDraft({ ...draft, penMode: e.target.value as AutomaticTradingConfig["penMode"] })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white disabled:opacity-40">
                <option value="simple">简单笔</option><option value="strict">严格笔</option>
              </select>
              <p className="text-xs leading-5 text-slate-400">简单笔：实体创新极值，端点跨度至少 5 根。严格笔：在简单笔基础上，幅度须达到起点时的 1 × max(ATR14, ATR100)，或端点跨度至少 15 根。两种笔均不按横盘等待时间补足跨度。</p>
              <p className="text-xs leading-5 text-slate-500">与图表画笔同步。已有交易时，请先“从头再跑”，再切换算法比较同一样本。</p>
            </section>
            <section className="space-y-3">
              <h3 className="font-semibold">首单仓位</h3>
              <p className="text-xs leading-5 text-slate-400">同方向没有自动持仓时使用此设置。当前余额 ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}。</p>
              <label className="block space-y-1.5 text-sm text-slate-300"><span>计算方式</span>
                <select aria-label="首单仓位计算方式" value={draft.firstOrderMode} onChange={(e) => setDraft({ ...draft, firstOrderMode: e.target.value as AutomaticTradingConfig["firstOrderMode"] })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white">
                  <option value="units">固定交易数量</option><option value="amount">固定止损金额</option><option value="balancePercent">账户余额百分比</option>
                </select>
              </label>
              {draft.firstOrderMode === "units" ? numberField("firstOrderUnits", "首单交易数量", "Units", "1") : draft.firstOrderMode === "amount" ? numberField("firstOrderRiskAmount", "首单最大止损预算", "USD", "0.01") : numberField("firstOrderRiskPercent", "首单余额风险比例", "%", "0.1")}
              {draft.firstOrderMode !== "units" && <p className="text-xs leading-5 text-slate-500">数量 = 止损预算 ÷ 初始止损距离，向下取整；不足 1 Unit 时跳过信号。跳空、滑点可能使实际损失超出预算。</p>}
            </section>
            <section className="space-y-3 border-t border-slate-800 pt-4">
              <h3 className="font-semibold">保底利润加仓</h3>
              {numberField("addRiskPercent", "加仓使用保底利润比例", "%", "1")}
              <p className="text-xs leading-5 text-slate-400">只使用最近一笔仍持仓的同向自动单，每单最多资助一次。默认 50%；设为 0 可关闭加仓。</p>
            </section>
            <section className="space-y-3 border-t border-slate-800 pt-4">
              <h3 className="font-semibold">短线减仓</h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={draft.shortExitEnabled} onChange={(e) => setDraft({ ...draft, shortExitEnabled: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
                启用第 7 笔减仓
              </label>
              <fieldset disabled={!draft.shortExitEnabled} className="disabled:opacity-40">
                {numberField("shortExitPercent", "短线减仓比例", "%", "1")}
              </fieldset>
              <p className="text-xs leading-5 text-slate-400">第 6 笔入场，第 7 笔首次形成时按市价减仓，每单执行一次；多空对称。默认平掉剩余仓位的 50%，其余继续按原规则持有。若同时触发突破失效，则全部出场。</p>
              <p className="text-xs leading-5 text-slate-500">减仓数量向下取整，不足 1 Unit 时跳过；设为 100% 则全部出场。修改只影响之后新建的订单。</p>
            </section>
            <section className="space-y-3 border-t border-slate-800 pt-4">
              <h3 className="font-semibold">止损、止盈与运行</h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" role="switch" checked={draft.initialStopEnabled} onChange={(e) => setDraft({ ...draft, initialStopEnabled: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
                初始进场设置止损
              </label>
              <p className="text-xs leading-5 text-slate-400">默认开启，在趋势起点之外设置初始止损。关闭后，新订单（含加仓单）进场时不设止损，后续仍按原规则设置并移动止损。</p>
              {!draft.initialStopEnabled && <p className="text-xs leading-5 text-slate-500">仓位和止盈仍按趋势起点及缓冲计算的参考止损距离确定；首次移动止损前没有止损保护，止损预算仅用于计算仓位。</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {numberField("stopAtrMultiplier", "止损 ATR 缓冲倍数", "× ATR(14)", "0.1")}
                {numberField("minStopTicks", "最小止损缓冲", "报价单位", "1")}
                {numberField("takeProfitR", "止盈距离倍数", "× 初始风险", "1")}
                {numberField("stepCandles", "单步推进 K 线", "根", "1")}
              </div>
              <p className="text-xs leading-5 text-slate-400">止损缓冲取 ATR 缓冲与最小缓冲中的较大值。移动止损和第 6 笔突破失效出场继续生效。修改参数只影响之后新建的订单。</p>
              <p className="text-xs leading-5 text-slate-500">启用后，“单步”按设定根数推进，“播放”运行到本次历史数据末尾。计算仍严格逐根执行，不使用未来信号。</p>
            </section>
          </div>
        </div>
        <footer className="shrink-0 space-y-3 border-t border-slate-800 px-5 py-4">
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => { setDraft({ ...DEFAULT_AUTOMATIC_TRADING_CONFIG, ...(penModeLocked ? { penMode: config.penMode } : {}) }); setError(null); }} className="text-sm text-slate-400 hover:text-white">恢复默认</button>
            <div className="flex gap-2">
              {enabled && <button type="button" onClick={onDisable} className="rounded-lg border border-slate-600 px-4 py-2 text-sm">停用新开仓</button>}
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">{enabled ? "保存配置" : "保存并启用"}</button>
            </div>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
