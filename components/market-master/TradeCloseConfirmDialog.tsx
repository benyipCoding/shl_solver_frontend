type PendingTradeClose =
  | {
      kind: "single";
      tradeId: string | number;
      tradeType: "Buy" | "Sell";
      units: number;
      entry: number;
    }
  | {
      kind: "all";
      openCount: number;
    };

type TradeCloseConfirmDialogProps = {
  pendingClose: PendingTradeClose | null;
  currentPrice: number;
  priceDecimals: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export type { PendingTradeClose };

export function TradeCloseConfirmDialog({
  pendingClose,
  currentPrice,
  priceDecimals,
  onCancel,
  onConfirm,
}: TradeCloseConfirmDialogProps) {
  if (!pendingClose) return null;

  const isCloseAll = pendingClose.kind === "all";
  const floatingPnl =
    pendingClose.kind === "single"
      ? pendingClose.tradeType === "Buy"
        ? (currentPrice - pendingClose.entry) * pendingClose.units
        : (pendingClose.entry - currentPrice) * pendingClose.units
      : 0;

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-close-dialog-title"
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
      >
        <div className="border-b border-gray-700 px-5 py-4">
          <h3
            id="trade-close-dialog-title"
            className="text-base font-bold text-white"
          >
            {isCloseAll ? "确认平掉所有订单？" : "确认市价平仓？"}
          </h3>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-gray-300">
          {isCloseAll ? (
            <>
              <p>
                当前有{" "}
                <span className="font-semibold text-amber-300">
                  {pendingClose.openCount}
                </span>{" "}
                笔尚未平仓的交易。
              </p>
              <p>将以当前回测市价一次性平掉这些订单，此操作无法撤销。</p>
            </>
          ) : (
            <>
              <p>
                将以当前市价平掉这笔{" "}
                <span
                  className={`font-semibold ${
                    pendingClose.tradeType === "Buy"
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {pendingClose.tradeType === "Buy" ? "多单" : "空单"}
                </span>
                的 {pendingClose.units} Units。
              </p>
              <p className="text-gray-400">
                开仓价 {pendingClose.entry.toFixed(priceDecimals)} · 当前市价{" "}
                {currentPrice.toFixed(priceDecimals)} · 浮动盈亏{" "}
                <span
                  className={
                    floatingPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {floatingPnl >= 0 ? "+" : ""}
                  {floatingPnl.toFixed(2)}
                </span>
              </p>
            </>
          )}
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            {isCloseAll ? "确认全部平仓" : "确认平仓"}
          </button>
        </div>
      </div>
    </div>
  );
}
