"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

import { formatCandleTooltipTime } from "@/components/market-master/market-config";

export type KlineRepairRange = {
  from: number;
  to: number;
};

type KlineRepairSelectOverlayProps = {
  active: boolean;
  symbol: string;
  timeframe: string;
  isSubmitting?: boolean;
  pendingRange: KlineRepairRange | null;
  resolveTimeAtX: (x: number) => number | null;
  resolveXAtTime: (time: number) => number | null;
  onRangeSelected: (range: KlineRepairRange) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onClearPending: () => void;
};

const MIN_DRAG_PX = 8;

const pointerX = (event: PointerEvent<HTMLDivElement>) =>
  event.clientX - event.currentTarget.getBoundingClientRect().left;

export function KlineRepairSelectOverlay({
  active,
  symbol,
  timeframe,
  isSubmitting = false,
  pendingRange,
  resolveTimeAtX,
  resolveXAtTime,
  onRangeSelected,
  onCancel,
  onConfirm,
  onClearPending,
}: KlineRepairSelectOverlayProps) {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setDragStartX(null);
      setDragCurrentX(null);
    }
  }, [active]);

  useEffect(() => {
    if (!active || isSubmitting) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (pendingRange) {
        onClearPending();
        return;
      }
      onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, isSubmitting, onCancel, onClearPending, pendingRange]);

  const liveRect = useMemo(() => {
    if (dragStartX == null || dragCurrentX == null) return null;
    const left = Math.min(dragStartX, dragCurrentX);
    const width = Math.abs(dragCurrentX - dragStartX);
    return { left, width };
  }, [dragCurrentX, dragStartX]);

  const pendingRect = useMemo(() => {
    if (!pendingRange) return null;
    const x1 = resolveXAtTime(pendingRange.from);
    const x2 = resolveXAtTime(pendingRange.to);
    if (x1 == null || x2 == null) return null;
    const left = Math.min(x1, x2);
    const width = Math.max(Math.abs(x2 - x1), 2);
    return { left, width };
  }, [pendingRange, resolveXAtTime]);

  if (!active) return null;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isSubmitting || pendingRange) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const x = pointerX(event);
    setDragStartX(x);
    setDragCurrentX(x);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX == null || pendingRange) return;
    setDragCurrentX(pointerX(event));
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX == null) return;
    const endX = pointerX(event);
    setDragCurrentX(endX);
    const startX = dragStartX;
    setDragStartX(null);
    setDragCurrentX(null);

    if (Math.abs(endX - startX) < MIN_DRAG_PX) return;

    const timeA = resolveTimeAtX(startX);
    const timeB = resolveTimeAtX(endX);
    if (timeA == null || timeB == null) return;

    onRangeSelected({
      from: Math.min(timeA, timeB),
      to: Math.max(timeA, timeB),
    });
  };

  return (
    <>
      <div
        className={`absolute inset-0 z-30 ${
          pendingRange || isSubmitting
            ? "pointer-events-none"
            : "cursor-col-resize touch-none"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          setDragStartX(null);
          setDragCurrentX(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (pendingRange) {
            onClearPending();
            return;
          }
          onCancel();
        }}
      >
        <div className="pointer-events-none absolute left-4 top-12 z-10 rounded-full border border-amber-500 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
          水平拖拽框选需要修复的时间段 · Esc 取消
        </div>
        {liveRect && liveRect.width > 0 ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 border-x border-amber-400/80 bg-amber-400/15"
            style={{ left: liveRect.left, width: liveRect.width }}
          />
        ) : pendingRect ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 border-x border-amber-400/80 bg-amber-400/20"
            style={{ left: pendingRect.left, width: pendingRect.width }}
          />
        ) : null}
      </div>
      {pendingRange &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
            >
              <div className="border-b border-gray-700 px-5 py-4">
                <h3 className="text-base font-bold text-white">确认修复框选 K 线</h3>
              </div>
              <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-gray-300">
                <p>
                  将以最高优先级重新采集{" "}
                  <span className="font-semibold text-amber-300">
                    {symbol} {timeframe}
                  </span>{" "}
                  以下时间段的福汇数据，若与本地不一致则以新数据为准。
                </p>
                <div className="rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2 font-mono text-xs text-gray-200">
                  <div>
                    开始：{formatCandleTooltipTime(pendingRange.from)} UTC
                  </div>
                  <div>
                    结束：{formatCandleTooltipTime(pendingRange.to)} UTC
                  </div>
                </div>
                <p className="text-gray-400">
                  采集过程中会插队到定时任务之前。范围较大时可能需要等待片刻。
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-700 px-5 py-4">
                <button
                  type="button"
                  onClick={onClearPending}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  重新框选
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  {isSubmitting ? "修复中" : "确认修复"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
