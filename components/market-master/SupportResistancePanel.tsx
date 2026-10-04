import { ZONE_STATUS_LABELS, type SupportResistanceSnapshot } from "./support-resistance";
import { ZONE_COLORS } from "./support-resistance-primitive";
import type { SupportResistanceHistoryState } from "./support-resistance-auto";

export function SupportResistancePanel({ snapshot, decimals, automatic, history, onRetryHistory }: {
  snapshot: SupportResistanceSnapshot | null;
  decimals: number;
  automatic: boolean;
  history: SupportResistanceHistoryState;
  onRetryHistory: () => void;
}) {
  if (!snapshot) return automatic || history.error ? (
    <div className="absolute left-2 top-14 z-10 max-w-[min(340px,calc(100%-2rem))] space-y-2 rounded-lg border border-slate-600/70 bg-gray-950/90 p-3 text-xs text-gray-300 shadow-lg sm:left-4">
      <p role={history.error ? "alert" : "status"}>{history.error || "正在分析支撑/阻力，图表可继续操作…"}</p>
    </div>
  ) : null;
  const formatTime = (time: number | null) => time == null ? "—" : new Date(time * 1000)
    .toISOString().slice(0, 16).replace("T", " ");
  return (
    <details className="absolute left-2 top-14 z-10 max-h-[calc(100%-4rem)] w-[min(340px,calc(100%-2rem))] overflow-y-auto rounded-lg border border-slate-600/70 bg-gray-950/90 text-xs shadow-lg backdrop-blur-sm sm:left-4">
      <summary className="cursor-pointer px-3 py-2 font-semibold text-slate-200">
        支撑 / 阻力 · {snapshot.zones.length} 个区域 · 查看依据
      </summary>
      <div className="space-y-3 border-t border-gray-800 p-3">
        <p className="leading-5 text-gray-400">
          {snapshot.mode === "automatic" ? `历史分析 · ${automatic ? "自动跟踪中" : "已暂停"}` : "手动识别视窗"} · {snapshot.barsAnalyzed.toLocaleString()} 根 K 线<br />
          {formatTime(snapshot.rangeStart)} – {formatTime(snapshot.asOf)} UTC
          <br />状态更新至 {formatTime(snapshot.evaluatedAt)} UTC
        </p>
        {snapshot.mode === "automatic" && (
          <div className="space-y-1 leading-5 text-gray-400">
            <p>已保存 {snapshot.candidateZones.filter((zone) => zone.status !== "invalidated").length} 个合格候选；优先补充价格附近的区域。</p>
            <p>{history.loading ? "正在向前补充历史，图表视野保持不变…" : history.hasMore ? "已分析当前加载历史；缺少相邻支撑或阻力时继续向前补充。" : "已加载到可用历史起点。"}</p>
            <p>分析截至回测进度，缩放和平移不会改变分析范围。</p>
          </div>
        )}
        {history.error && snapshot.mode === "automatic" && (
          <div role="alert" className="space-y-1 text-amber-200">
            <p>{history.error}</p>
            {automatic && <button type="button" onClick={onRetryHistory} className="underline">重试补充历史</button>}
          </div>
        )}
        {snapshot.message && <p className="leading-5 text-amber-200">{snapshot.message}</p>}
        {snapshot.zones.map((zone) => (
          <div key={zone.id} className="space-y-1.5 border-l-2 pl-2" style={{ borderColor: ZONE_COLORS[zone.role] }}>
            <div className="flex items-center justify-between gap-2">
              <strong style={{ color: ZONE_COLORS[zone.role] }}>
                {zone.label} {zone.role === "support" ? "支撑" : "阻力"}
              </strong>
              <span className="text-gray-300">形成评分 {zone.score}/100</span>
            </div>
            <p className="font-mono text-gray-200">{zone.lower.toFixed(decimals)} – {zone.upper.toFixed(decimals)}</p>
            <p className="text-amber-200">{ZONE_STATUS_LABELS[zone.status]}</p>
            <p className="leading-5 text-gray-300">{zone.statusReason}</p>
            <p className="leading-5 text-gray-400">{zone.reasons.join(" · ")}</p>
          </div>
        ))}
        <p className="leading-5 text-gray-500">
          评分比较历史证据，不代表反转概率。相对量以转折前 20 根 K 线中有效量的中位数为基准。
          颜色越深，形成评分越高。虚线表示突破待确认；确认突破或结构消耗后移除区间。
          已有区域固定边界，有效区域不会因排名变化而删除。
          开启后自动随 K 线推进寻找新区，缩放不影响分析。
          再次点击顶部支撑/阻力按钮可关闭并移除这些区间；清空画线不影响它们。
        </p>
        {snapshot.retiredZones.length > 0 && (
          <details className="border-t border-gray-800 pt-2">
            <summary className="cursor-pointer text-gray-400">已失效区域 · {snapshot.retiredZones.length}</summary>
            <div className="mt-2 space-y-2">
              {snapshot.retiredZones.map((zone) => (
                <div key={zone.id} className="leading-5 text-gray-400">
                  <p className="font-mono">{zone.lower.toFixed(decimals)} – {zone.upper.toFixed(decimals)}</p>
                  <p>{formatTime(zone.invalidatedAt)} UTC · {zone.statusReason}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}
