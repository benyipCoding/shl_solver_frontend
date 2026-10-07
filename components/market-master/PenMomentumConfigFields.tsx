// 分笔动能暂时停用，保留原实现供日后恢复；恢复步骤见 components/market-master/pen-momentum.md。
// import type { PenMomentumConfig } from "./pen-momentum";

// export function PenMomentumConfigFields({ config, onChange }: {
//   config: PenMomentumConfig;
//   onChange: (config: PenMomentumConfig) => void;
// }) {
//   return <div className="space-y-4">
//     <div className="flex items-center justify-between border-b border-gray-800 pb-3">
//       <div><h3 className="text-sm font-semibold text-slate-100">分笔动能</h3><p className="mt-1 text-xs text-slate-500">比较同向分笔的端点推进距离</p></div>
//       <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={config.enabled} onChange={(e) => onChange({ ...config, enabled: e.target.checked })} className="accent-violet-500" />启用指标</label>
//     </div>
//     <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs leading-6 text-slate-300">
//       <p className="font-medium text-violet-300">先找配对，再看推进</p>
//       <p>上笔：后笔起点和终点都更高；下笔：两者都更低。向前找最近的合格同向笔，可跨过多条震荡分笔。</p>
//       <p className="mt-2 font-mono text-violet-200">动能值 = 同向端点推进距离 ÷ 参考 ATR</p>
//     </div>
//     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
//       <label className="text-xs text-slate-400">ATR 周期
//         <input type="number" min={1} max={200} step={1} value={config.atrPeriod} onChange={(e) => {
//           const value = Number(e.target.value);
//           if (Number.isFinite(value) && value >= 1) onChange({ ...config, atrPeriod: Math.min(200, Math.floor(value)) });
//         }} className="mt-1.5 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500" />
//       </label>
//       <label className="text-xs text-slate-400">动能减弱门槛（ATR 倍数）
//         <input type="number" min={0.05} step={0.05} value={config.weakThreshold} onChange={(e) => {
//           const value = Number(e.target.value);
//           if (Number.isFinite(value) && value > 0) onChange({ ...config, weakThreshold: value });
//         }} className="mt-1.5 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500" />
//       </label>
//     </div>
//     <p className="text-xs leading-5 text-slate-500">默认 0.5：端点推进不足半个 ATR 时标记减弱。门槛越大，越容易被标记。初始值需结合实际行情观察调整。</p>
//     <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={config.includeDeveloping} onChange={(e) => onChange({ ...config, includeDeveloping: e.target.checked })} className="accent-violet-500" />显示最后一笔的动能预估</label>
//     <div className="space-y-1 border-t border-gray-800 pt-3 text-xs leading-5 text-slate-500">
//       <p>启用后在主图右侧显示上笔 / 下笔卡片，点击可高亮两条配对笔及端点连线，无需先开启工具栏自动画笔。</p>
//       <p>ATR 为真实波幅的简单平均，固定取前笔终点时的值；历史不足时不判强弱。分析已加载行情，逐 K 回测只使用已揭示 K 线。</p>
//       <p>最后一笔预估会变化；已确认结果须等待后续反向笔形成。减弱表示推进不足，不代表已经反转。</p>
//     </div>
//   </div>;
// }
