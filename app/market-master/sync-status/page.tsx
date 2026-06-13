// @ts-nocheck
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useFetch } from "@/context/FetchContext";
import { Activity, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

export default function SyncStatusPage() {
  const { customFetch } = useFetch();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const res = await customFetch("/api_v1/market_master/sync/status");
      const payload = await res.json();
      if (payload.data) {
        setData(payload.data);
      }
    } catch (e) {
      console.error("Failed to load sync status", e);
    } finally {
      setLoading(false);
    }
  }, [customFetch]);

  useEffect(() => {
    loadStatus();
    // Set up polling every 2 seconds to make it feel real-time
    const timer = setInterval(loadStatus, 2000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  if (!data && loading) {
    return (
      <div className="p-8 text-center text-gray-500">正在初始化监控面板...</div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-red-500">
        无法加载同步系统状态，请检查后端网络连接。
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <Activity className="w-8 h-8 text-blue-500" />
            <span>FXCM 调度器实时监控台</span>
          </h1>
          <button
            onClick={loadStatus}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>手动刷新</span>
          </button>
        </div>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 mb-1">注册标的总数</div>
            <div className="text-3xl font-semibold">
              {data.status.instrument_count}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 mb-1">已落盘 K 线总量</div>
            <div className="text-3xl font-semibold">
              {data.status.bar_count.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-amber-600 dark:text-amber-500 mb-1">
              队列排队中 (待同步)
            </div>
            <div className="text-3xl font-semibold text-amber-600 dark:text-amber-500">
              {data.status.due_state_count}{" "}
              <span className="text-lg text-gray-500">
                / {data.status.enabled_state_count}
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-red-500 mb-1">异常失败状态</div>
            <div className="text-3xl font-semibold text-red-500">
              {data.status.failed_state_count}
            </div>
          </div>
        </div>

        {/* Running Tasks Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-500" />
              <span>
                当前活跃作业通道 (并发配额 10) |{" "}
                {data.running_tasks?.length || 0} 个激活中
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">交易品种</th>
                  <th className="px-6 py-3 font-medium">周期</th>
                  <th className="px-6 py-3 font-medium">任务模式</th>
                  <th className="px-6 py-3 font-medium">回补状态</th>
                  <th className="px-6 py-3 font-medium">可回溯历史界限</th>
                  <th className="px-6 py-3 font-medium">最新 K 线界定</th>
                  <th className="px-6 py-3 font-medium">最后尝试时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.running_tasks?.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      暂无正在运行的任务... (所有可用资源可能均处于 15 秒 IDLE
                      休眠状态)
                    </td>
                  </tr>
                )}
                {data.running_tasks?.map((task) => (
                  <tr
                    key={`${task.instrument_id}-${task.interval}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition whitespace-nowrap"
                  >
                    <td className="px-6 py-4 font-semibold text-blue-600 dark:text-blue-400">
                      {task.provider_symbol}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-2 py-1 rounded">
                        {task.interval}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          task.sync_mode === "BACKFILL"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {task.sync_mode}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center space-x-2">
                      {task.backfill_completed ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400">
                            完备 (实时)
                          </span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                          <span className="text-sm text-blue-600 dark:text-blue-400">
                            回溯填充中...
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400 text-xs">
                      {task.earliest_synced_bar_time
                        ? new Date(
                            task.earliest_synced_bar_time
                          ).toLocaleString()
                        : "未初始化"}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400 text-xs">
                      {task.latest_synced_bar_time
                        ? new Date(task.latest_synced_bar_time).toLocaleString()
                        : "未初始化"}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {task.last_attempt_at
                        ? new Date(task.last_attempt_at).toLocaleTimeString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
