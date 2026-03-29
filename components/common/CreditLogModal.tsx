"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Coins, X, Loader2 } from "lucide-react";
import { useFetch } from "@/context/FetchContext";

interface CreditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreditLogModal: React.FC<CreditLogModalProps> = ({ isOpen, onClose }) => {
  const { customFetch } = useFetch();
  const [creditLogs, setCreditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);

  const fetchCreditLogs = useCallback(
    async (currentSkip: number, append = false) => {
      if (isLoadingRef.current) return;

      setIsLoadingLogs(true);
      isLoadingRef.current = true;

      try {
        const res = await customFetch(
          `/api/user/credit-logs?skip=${currentSkip}&limit=${limit}`
        );
        if (res.ok) {
          const data = await res.json();
          const newLogs = data.data || [];

          if (append) {
            setCreditLogs((prev) => [...prev, ...newLogs]);
          } else {
            setCreditLogs(newLogs);
          }

          if (newLogs.length < limit) {
            setHasMore(false);
          } else {
            setHasMore(true);
          }
        }
      } catch (error) {
        console.error("Error fetching credit logs:", error);
      } finally {
        setIsLoadingLogs(false);
        isLoadingRef.current = false;
      }
    },
    [customFetch, limit]
  );

  useEffect(() => {
    if (isOpen) {
      setSkip(0);
      setHasMore(true);
      setCreditLogs([]);
      fetchCreditLogs(0, false);
    }
  }, [isOpen, fetchCreditLogs]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    // 如果距离底部不足 50px，且还有更多数据，且当前没有在加载，则加载下一页
    if (
      scrollHeight - scrollTop - clientHeight < 50 &&
      hasMore &&
      !isLoadingRef.current
    ) {
      const nextSkip = skip + limit;
      setSkip(nextSkip);
      fetchCreditLogs(nextSkip, true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center">
            <Coins className="w-5 h-5 mr-2 text-yellow-500" /> 算力使用记录
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900 relative"
        >
          {creditLogs.length === 0 && !isLoadingLogs ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
              <Coins className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-sm">暂无算力使用记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {creditLogs.map((log: any, index: number) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {log.action_type || "使用算力"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {new Date(log.created_at).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div
                    className={`text-base font-semibold ${
                      log.amount < 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-green-500 dark:text-green-400"
                    }`}
                  >
                    {log.amount > 0 ? "+" : ""}
                    {log.amount}
                  </div>
                </div>
              ))}

              {isLoadingLogs && (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="animate-spin text-slate-400 dark:text-slate-500 h-6 w-6" />
                </div>
              )}

              {!hasMore && creditLogs.length > 0 && (
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">
                  没有更多记录了
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditLogModal;
