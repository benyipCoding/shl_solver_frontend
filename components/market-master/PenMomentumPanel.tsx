import { useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { formatCandleTooltipTime } from "./market-config";
import type { PenMomentumConfig, PenMomentumPair, PenMomentumSnapshot } from "./pen-momentum";

export function PenMomentumPanel({ snapshot, config, selectedPair, onSelect, decimals }: {
  snapshot: PenMomentumSnapshot | null;
  config: PenMomentumConfig;
  selectedPair: PenMomentumPair | null;
  onSelect: (direction: "up" | "down") => void;
  decimals: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const format = (value: number) => value.toFixed(decimals);
  return (
    <section aria-label="分笔动能" className="absolute right-20 top-14 z-10 max-h-[calc(100%-4rem)] w-72 max-w-[calc(100%-1rem)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 text-xs shadow-xl backdrop-blur-sm max-sm:right-2">
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-slate-100">
        <span className="flex items-center gap-2 font-semibold"><Activity size={14} className="text-violet-400" />分笔动能 <span className="font-normal text-slate-500">ATR {config.atrPeriod}</span></span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && <div className="space-y-2.5 border-t border-slate-800 p-3">
        <p className="text-[11px] leading-5 text-slate-400">端点推进 / 参考 ATR · 低于 {config.weakThreshold} 为动能减弱</p>
        {(["up", "down"] as const).map((direction) => {
          const pair = snapshot?.[direction];
          const selected = pair != null && selectedPair?.id === pair.id;
          return <button key={direction} type="button" disabled={!pair} onClick={() => onSelect(direction)} aria-pressed={selected}
            className={`w-full rounded-lg border p-2.5 text-left transition-colors ${selected ? "border-violet-500/70 bg-violet-500/10" : "border-slate-800 bg-slate-900/60 hover:border-slate-600"} disabled:cursor-default`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-200">{direction === "up" ? "↗ 上笔" : "↘ 下笔"}</span>
              {pair && <span className={`rounded px-1.5 py-0.5 text-[10px] ${pair.developing ? "bg-slate-800 text-slate-400" : "bg-sky-500/10 text-sky-300"}`}>{pair.developing ? "预估 · 笔未完成" : "已确认"}</span>}
            </div>
            {pair ? <>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <strong className={`font-mono text-xl ${pair.weak ? "text-amber-300" : "text-violet-300"}`}>{pair.score?.toFixed(2) ?? "—"}<span className="ml-1 text-[10px] font-normal text-slate-500">ATR</span></strong>
                <span className={pair.weak ? "text-amber-300" : "text-slate-300"}>{pair.weak === null ? "波动基准不足" : pair.weak ? "动能减弱" : "推进正常"}</span>
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-slate-400">#{pair.previousIndex + 1} → #{pair.currentIndex + 1} · 中间 {pair.interveningPens} 笔 · Δ {format(pair.advance)}</p>
            </> : <p className="mt-2 text-[11px] leading-5 text-slate-500">{!snapshot ? "正在计算…" : `最新${direction === "up" ? "上" : "下"}笔暂无符合条件的同向配对`}</p>}
          </button>;
        })}
        {selectedPair && <div className="space-y-1 rounded-lg bg-slate-900/60 p-2.5 text-[10px] leading-5 text-slate-400">
          <p><span className="text-sky-400">A 前笔终点</span> <span className="float-right font-mono text-slate-200">{format(selectedPair.previous.endPoint.price)}</span><br />{formatCandleTooltipTime(selectedPair.previous.endPoint.time)} UTC</p>
          <p><span className="text-violet-300">B 后笔终点</span> <span className="float-right font-mono text-slate-200">{format(selectedPair.current.endPoint.price)}</span><br />{formatCandleTooltipTime(selectedPair.current.endPoint.time)} UTC</p>
          <p className="border-t border-slate-800 pt-1">参考 ATR：{selectedPair.referenceAtr === null ? "历史不足" : format(selectedPair.referenceAtr)}<br />固定取 A 端点时的 ATR，图上虚线连接 A / B。</p>
        </div>}
        <p className="text-[10px] leading-4 text-slate-500">点击上笔 / 下笔高亮配对。预估随分笔延伸更新；减弱表示推进不足，不等于反转信号。</p>
      </div>}
    </section>
  );
}
