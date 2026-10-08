import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { AutomaticRunProgress } from "./automatic-trading-runner";
import type { AutomaticPenMode } from "./automatic-pens";

export type AutomaticRunView = AutomaticRunProgress & {
  status: "running" | "done" | "cancelled" | "error";
  message?: string;
  penMode?: AutomaticPenMode;
  result?: { realized: number; floating: number; closed: number; wins: number; drawdown: number; seconds: number };
};
export function AutomaticTradingRunDialog({ run, onStop, onClose }: { run: AutomaticRunView; onStop: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = ref.current; node?.showModal(); return () => node?.close(); }, []);
  const running = run.status === "running";
  const percent = run.target ? Math.min(100, run.processed / run.target * 100) : 0;
  const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <dialog ref={ref} aria-labelledby="strategy-run-title" onCancel={(e) => { e.preventDefault(); if (running) onStop(); else onClose(); }} className="fixed inset-0 m-auto w-[min(480px,calc(100vw-32px))] rounded-2xl border border-slate-700 bg-gray-900 p-6 text-slate-200 shadow-2xl backdrop:bg-black/70">
    <h2 id="strategy-run-title" className="flex items-center gap-2 text-lg font-semibold">{running && <Loader2 size={20} className="animate-spin text-emerald-400" />}分笔做单系统 · {running ? "运行中" : run.status === "done" ? "运行完成" : run.status === "cancelled" ? "已停止" : "运行中断"}</h2>
    <p className="mt-2 text-xs text-yellow-300">本轮算法：{run.penMode === "strict" ? "严格笔" : "简单笔"}</p>
    <p className="mt-3 text-sm text-slate-400" aria-live="polite">{run.message ?? (run.phase === "loading" ? "正在加载后续 K 线…" : run.phase === "saving" ? "正在保存交易记录…" : "正在逐根计算交易信号与持仓盈亏…")}</p>
    <progress value={run.processed} max={Math.max(1, run.target)} aria-label="策略回测进度" className="mt-5 h-2 w-full accent-emerald-500" />
    <p className="mt-2 text-sm tabular-nums text-slate-400">{run.processed.toLocaleString()} / {run.target.toLocaleString()} 根 · {percent.toFixed(1)}%</p>
    {run.result && <>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        {[["本次已实现盈亏", `$${money(run.result.realized)}`], ["当前持仓浮盈亏", `$${money(run.result.floating)}`], ["本次平仓 / 胜率", `${run.result.closed} / ${run.result.closed ? (run.result.wins / run.result.closed * 100).toFixed(1) : "0"}%`], ["本次最大净值回撤", `$${money(run.result.drawdown)}`]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-mono text-slate-100">{value}</dd></div>)}
      </dl>
      <p className="mt-4 text-xs leading-5 text-slate-500">耗时 {run.result.seconds.toFixed(1)} 秒。回撤按每根收盘净值统计；末尾持仓继续保留。关闭后可在图表与交易记录中审核结果。</p>
    </>}
    <button type="button" onClick={running ? onStop : onClose} className="mt-6 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-600">{running ? "停止运行并保留结果" : "查看图表与交易记录"}</button>
  </dialog>;
}
