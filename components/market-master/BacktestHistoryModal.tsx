"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, Loader2, Play, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useFetch } from "@/context/FetchContext";
import { TIMEFRAME_OPTIONS } from "@/components/market-master/market-config";
import { createBacktestPersistClient } from "@/components/market-master/backtest-persistence";
import type { BacktestSessionListItem } from "@/components/market-master/backtest-replay";

type BacktestHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onReplay: (publicId: string) => void;
  replayingId?: string | null;
};

const PAGE_SIZE = 20;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const formatPnl = (value = 0) => {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
};

const timeframeLabel = (item: BacktestSessionListItem) => {
  const timeframe = item.timeframe;
  const fromTimeframe = TIMEFRAME_OPTIONS.find(
    (option) => option.value === timeframe
  )?.label;
  if (fromTimeframe) return fromTimeframe;
  const fromInterval = TIMEFRAME_OPTIONS.find(
    (option) => option.interval === item.interval
  )?.label;
  return fromInterval || item.interval || "-";
};

export function BacktestHistoryModal({
  isOpen,
  onClose,
  onReplay,
  replayingId = null,
}: BacktestHistoryModalProps) {
  const { customFetch } = useFetch();
  const persistRef = useRef(createBacktestPersistClient());
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<BacktestSessionListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<BacktestSessionListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isLoadingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    persistRef.current.configure({
      enabled: true,
      fetchFn: (input, init) => customFetch(input, init, true),
    });
  }, [customFetch]);

  const fetchPage = useCallback(async (pageNum: number, append = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError("");
    try {
      const data = await persistRef.current.listSessions(pageNum, PAGE_SIZE);
      const nextItems: BacktestSessionListItem[] = data?.items || [];
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setHasMore(nextItems.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (err: any) {
      setError(err?.message || "获取回测记录失败");
      if (!append) setItems([]);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPendingDelete(null);
      setDeletingId(null);
      return;
    }
    setItems([]);
    setPage(1);
    setHasMore(true);
    void fetchPage(1, false);
  }, [fetchPage, isOpen]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container || !hasMore || isLoadingRef.current) return;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 48) {
      void fetchPage(page + 1, true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deletingId) return;
    const publicId = pendingDelete.public_id;
    setDeletingId(publicId);
    try {
      await persistRef.current.deleteSession(publicId);
      setPendingDelete(null);
      toast.success("已删除回测记录");
      setItems([]);
      setPage(1);
      setHasMore(true);
      void fetchPage(1, false);
    } catch (err: any) {
      toast.error(err?.message || "删除回测记录失败");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="backtest-history-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <h2
            id="backtest-history-title"
            className="flex items-center gap-2 text-base font-bold text-white"
          >
            <History size={18} className="text-blue-400" />
            回测记录
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="关闭回测记录"
          >
            <X size={18} />
          </button>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          {items.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-14 text-sm text-gray-500">
              <History size={36} className="mb-3 text-gray-700" />
              {error || "暂无回测记录"}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const pnl = Number(item.realized_pnl || 0);
                const isReplaying = replayingId === item.public_id;
                const isDeleting = deletingId === item.public_id;
                return (
                  <article
                    key={item.public_id}
                    className="rounded-lg border border-gray-800 bg-gray-950/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">
                            {item.symbol}
                          </span>
                          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-300">
                            {timeframeLabel(item)}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              item.status === "COMPLETED"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {item.status === "COMPLETED" ? "已结束" : "进行中"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDateTime(item.created_at)}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">
                          成交 {item.trade_count || 0} 笔
                          {item.closed_trade_count
                            ? ` · 已平 ${item.closed_trade_count}`
                            : ""}
                          {item.win_count ? ` · 盈利 ${item.win_count}` : ""}
                          <span
                            className={`ml-2 font-mono ${
                              pnl >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {formatPnl(pnl)}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2">
                        <button
                          type="button"
                          disabled={Boolean(replayingId) || Boolean(deletingId)}
                          onClick={() => onReplay(item.public_id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isReplaying ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Play size={14} />
                          )}
                          还原播放
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(deletingId)}
                          onClick={() => setPendingDelete(item)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          删除
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              加载中...
            </div>
          )}
        </div>
      </div>

      {pendingDelete ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            event.stopPropagation();
            if (!deletingId) setPendingDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="backtest-delete-title"
            className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-700 px-5 py-4">
              <h3
                id="backtest-delete-title"
                className="text-base font-bold text-white"
              >
                确认删除回测记录？
              </h3>
            </div>
            <div className="space-y-2 px-5 py-4 text-sm leading-relaxed text-gray-300">
              <p>
                将删除{" "}
                <span className="font-semibold text-white">
                  {pendingDelete.symbol}
                </span>{" "}
                · {timeframeLabel(pendingDelete)} 这场回测。
              </p>
              <p className="text-gray-400">删除后无法还原播放，此操作无法撤销。</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-700 px-5 py-4">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
