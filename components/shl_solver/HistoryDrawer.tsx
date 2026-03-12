"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  ChevronRight,
  User,
  Loader2,
} from "lucide-react";
import { SHLSolverHistoryItem } from "@/interfaces/history";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: SHLSolverHistoryItem) => void;
}

const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("default", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

export default function HistoryDrawer({
  isOpen,
  onClose,
  onSelect,
}: HistoryDrawerProps) {
  const [historyItems, setHistoryItems] = useState<SHLSolverHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchHistory = async (pageNum: number, isRefresh = false) => {
    if (loading) return; // Prevent duplicate requests
    try {
      setLoading(true);
      const res = await fetch(`/api/shl_history?page=${pageNum}&size=20`, {
        method: "GET",
      });
      const data = await res.json();

      if (res.ok && data.items) {
        if (isRefresh || pageNum === 1) {
          setHistoryItems(data.items);
        } else {
          setHistoryItems((prev) => [...prev, ...data.items]);
        }

        setTotal(data.total || 0);
        // If returned items are less than page size, no more data
        setHasMore(data.items.length === 20);
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setPage(1);
      setHasMore(true);
      fetchHistory(1, true);
    }
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    // Load more when scrolled to bottom (within 50px)
    if (scrollHeight - scrollTop - clientHeight < 50 && hasMore && !loading) {
      fetchHistory(page + 1);
    }
  };

  // Handle visibility for animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300); // 300ms matches transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`relative w-full md:w-100 h-full bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen
            ? "translate-x-0 translate-y-0"
            : "translate-y-full md:translate-y-0 translate-x-0 md:translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 safe-top">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              历史记录
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-black/20"
          onScroll={handleScroll}
        >
          {historyItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelect(item);
                if (window.innerWidth < 768) onClose(); // Auto close on mobile
              }}
              className="group cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl p-3 transition-all shadow-sm hover:shadow-md active:scale-[0.99] relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-20 font-semibold text-slate-700 dark:text-slate-300">
                    {item.username}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="flex items-start gap-3">
                {/* Thumbnail preview */}
                <div className="relative w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                  <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate leading-snug">
                    {item.result_json?.summary
                      ? item.result_json.summary
                      : item.error_message || "等待分析..."}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {item.token_count > 0 && (
                      <span>{item.token_count} toks</span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors self-center shrink-0" />
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}

          {!loading && historyItems.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
              <Clock className="w-10 h-10 opacity-20" />
              <p>暂无历史记录</p>
            </div>
          )}

          {!loading && !hasMore && historyItems.length > 0 && (
            <div className="text-center py-4 text-xs text-slate-400">
              已经到底了
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-center text-xs text-slate-400">
          共 {historyItems.length} 条记录
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" /> Success
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3" /> Failed
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
  }
}
