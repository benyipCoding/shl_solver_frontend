export type PendingMarketChange = {
  kind: "symbol" | "timeframe";
  value: string;
  openCount: number;
  wasBacktestMode: boolean;
};

type PendingMarketChangeDialogProps = {
  pendingChange: PendingMarketChange | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PendingMarketChangeDialog({
  pendingChange,
  onCancel,
  onConfirm,
}: PendingMarketChangeDialogProps) {
  if (!pendingChange) return null;

  const targetLabel =
    pendingChange.kind === "symbol" ? "交易标的" : "周期";

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="border-b border-gray-700 px-5 py-4">
          <h3 className="text-base font-bold text-white">确认切换</h3>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-gray-300">
          <p>
            当前有{" "}
            <span className="font-semibold text-amber-300">
              {pendingChange.openCount}
            </span>{" "}
            笔尚未平仓的交易。
          </p>
          <p>
            {pendingChange.wasBacktestMode
              ? `切换${targetLabel}将先退出逐K回测，并以当前回测市价强制平仓这些未平仓交易。`
              : `切换${targetLabel}将以当前市价强制平仓这些未平仓交易。`}
          </p>
          <p className="text-gray-400">是否继续？</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-700 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            确认切换并强平
          </button>
        </div>
      </div>
    </div>
  );
}
