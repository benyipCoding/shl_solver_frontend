// @ts-nocheck
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFetch } from "@/context/FetchContext";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Filter,
  History,
  RefreshCw,
  Search,
  XCircle,
  Zap,
} from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const CATEGORY_LABELS: Record<string, string> = {
  forex: "外汇",
  index: "指数",
  commodity: "大宗商品",
  crypto: "加密货币",
  other: "其他",
};

const STATUS_STYLES: Record<string, string> = {
  IDLE: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  SKIPPED:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  SUCCESS:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

type FilterKey =
  | "all"
  | "due"
  | "failed"
  | "running"
  | "skipped"
  | "today"
  | "incremental"
  | "backfill"
  | "disabled";
type NextSyncSort = "asc" | "desc";

function isIncrementalState(state: {
  backfill_completed?: boolean;
  sync_mode?: string;
}): boolean {
  if (typeof state.backfill_completed === "boolean") {
    return state.backfill_completed;
  }
  return String(state.sync_mode || "").toUpperCase() === "INCREMENTAL";
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "已到期";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (days === 0 && hours === 0) parts.push(`${secs}秒`);
  return parts.join(" ");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ||
    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${style}`}
    >
      {status}
    </span>
  );
}

export default function SyncStatusPage() {
  const { customFetch } = useFetch();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientNow, setClientNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [nextSyncSort, setNextSyncSort] = useState<NextSyncSort>("asc");
  const [expandedErrors, setExpandedErrors] = useState<Record<number, boolean>>(
    {}
  );

  const loadStatus = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const res = await customFetch("/api/market_master/sync/status");
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(
            payload?.error || payload?.message || `请求失败 (${res.status})`
          );
        }
        if (payload.data) {
          setData(payload.data);
          setClientNow(Date.now());
        } else {
          throw new Error("接口返回数据为空");
        }
      } catch (e) {
        console.error("Failed to load sync status", e);
      } finally {
        setLoading(false);
        if (manual) setRefreshing(false);
      }
    },
    [customFetch]
  );

  useEffect(() => {
    loadStatus();
    const pollTimer = setInterval(() => loadStatus(), POLL_INTERVAL_MS);
    const clockTimer = setInterval(() => setClientNow(Date.now()), 1000);
    return () => {
      clearInterval(pollTimer);
      clearInterval(clockTimer);
    };
  }, [loadStatus]);

  const serverTimeOffset = useMemo(() => {
    if (!data?.rotation?.server_time) return 0;
    return new Date(data.rotation.server_time).getTime() - clientNow;
  }, [data?.rotation?.server_time, clientNow]);

  const effectiveNow = clientNow + serverTimeOffset;

  const filteredStates = useMemo(() => {
    if (!data?.states) return [];
    const keyword = search.trim().toLowerCase();

    return data.states.filter((state) => {
      if (keyword) {
        const haystack = [
          state.symbol,
          state.provider_symbol,
          state.interval,
          state.last_status,
          state.last_error,
          state.asset_category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }

      switch (filter) {
        case "due":
          return state.enabled && getIsDue(state, effectiveNow);
        case "failed":
          return state.last_status === "FAILED";
        case "running":
          return state.last_status === "RUNNING";
        case "skipped":
          return state.last_status === "SKIPPED";
        case "today":
          return state.allowed_today;
        case "incremental":
          return state.allowed_today && state.enabled && isIncrementalState(state);
        case "backfill":
          return (
            state.allowed_today && state.enabled && !isIncrementalState(state)
          );
        case "disabled":
          return !state.enabled;
        default:
          return true;
      }
    });
  }, [data?.states, search, filter, effectiveNow]);

  const sortedFilteredStates = useMemo(() => {
    const items = [...filteredStates];
    items.sort((a, b) => compareNextSyncFrom(a, b, nextSyncSort));
    return items;
  }, [filteredStates, nextSyncSort]);

  const groupedBySymbol = useMemo(() => {
    const groups = new Map();
    for (const state of filteredStates) {
      const key = state.symbol || state.provider_symbol;
      if (!groups.has(key)) {
        groups.set(key, {
          symbol: key,
          provider_symbol: state.provider_symbol,
          asset_category: state.asset_category,
          allowed_today: state.allowed_today,
          asset_type: state.asset_type,
          states: [],
        });
      }
      groups.get(key).states.push(state);
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.symbol.localeCompare(b.symbol)
    );
  }, [filteredStates]);

  const stats = useMemo(() => {
    const states = data?.states || [];
    const todayEnabled = states.filter((s) => s.allowed_today && s.enabled);
    const todayIncremental = todayEnabled.filter((s) => isIncrementalState(s));
    const todayBackfill = todayEnabled.filter((s) => !isIncrementalState(s));
    return {
      total: states.length,
      due: states.filter((s) => s.enabled && getIsDue(s, effectiveNow)).length,
      failed: states.filter((s) => s.last_status === "FAILED").length,
      running: states.filter((s) => s.last_status === "RUNNING").length,
      todayAllowed: todayEnabled.length,
      todayIncremental: todayIncremental.length,
      todayBackfill: todayBackfill.length,
      todayIncrementalPct:
        todayEnabled.length === 0
          ? 0
          : Math.round((todayIncremental.length / todayEnabled.length) * 100),
    };
  }, [data?.states, effectiveNow]);

  const todayBackfillBySymbol = useMemo(() => {
    const states = (data?.states || []).filter(
      (s) => s.allowed_today && s.enabled && !isIncrementalState(s)
    );
    const groups = new Map();
    for (const state of states) {
      const key = state.symbol || state.provider_symbol;
      if (!groups.has(key)) {
        groups.set(key, {
          symbol: key,
          provider_symbol: state.provider_symbol,
          asset_category: state.asset_category,
          intervals: [],
        });
      }
      groups.get(key).intervals.push(state);
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        intervals: group.intervals.sort((a, b) =>
          String(a.interval).localeCompare(String(b.interval))
        ),
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [data?.states]);

  const todayIncrementalByInterval = useMemo(() => {
    const counts = new Map();
    for (const state of data?.states || []) {
      if (!state.allowed_today || !state.enabled) continue;
      const key = state.interval || "unknown";
      if (!counts.has(key)) {
        counts.set(key, { interval: key, incremental: 0, backfill: 0, total: 0 });
      }
      const row = counts.get(key);
      row.total += 1;
      if (isIncrementalState(state)) row.incremental += 1;
      else row.backfill += 1;
    }
    return Array.from(counts.values()).sort((a, b) =>
      String(a.interval).localeCompare(String(b.interval))
    );
  }, [data?.states]);

  if (!data && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        正在加载 MarketBarSyncState 监控面板...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        无法加载同步状态，请检查后端连接。
      </div>
    );
  }

  const rotation = data.rotation;
  const todayRotation = rotation?.today;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Activity className="w-7 h-7 text-blue-500" />
              MarketBarSyncState 监控
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              查看轮换日策略、增量/历史补全进度、各品种下次执行倒计时与失败原因
            </p>
          </div>
          <button
            onClick={() => loadStatus(true)}
            className="inline-flex items-center gap-2 self-start bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            手动刷新
          </button>
        </header>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold">每日品类轮换</h2>
          </div>

          <div className="mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-4 py-3">
            <div className="text-sm text-indigo-700 dark:text-indigo-300">
              今天是 {WEEKDAY_LABELS[rotation.weekday]}，轮换采集品类：
              <span className="font-semibold ml-1">
                {todayRotation
                  ? `${todayRotation.label} (${todayRotation.category})`
                  : "全部"}
              </span>
            </div>
            <div className="text-xs text-indigo-600/80 dark:text-indigo-400 mt-1">
              非今日轮换品类会被标记为 SKIPPED，next_sync_from 推迟到次日 00:05
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {rotation.schedule.map((day) => {
              const isToday = day.weekday === rotation.weekday;
              return (
                <div
                  key={day.weekday}
                  className={`rounded-xl border px-3 py-3 text-center transition ${
                    isToday
                      ? "border-indigo-500 bg-indigo-500 text-white shadow-md scale-[1.02]"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
                  }`}
                >
                  <div
                    className={`text-xs ${isToday ? "text-indigo-100" : "text-slate-500"}`}
                  >
                    {WEEKDAY_LABELS[day.weekday]}
                  </div>
                  <div className="font-semibold text-sm mt-1">{day.label}</div>
                  <div
                    className={`text-[11px] mt-0.5 ${isToday ? "text-indigo-100" : "text-slate-400"}`}
                  >
                    {day.category}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8 gap-3">
          <StatCard label="状态行总数" value={stats.total} />
          <StatCard label="已到期/待执行" value={stats.due} accent="amber" />
          <StatCard
            label="今日轮换内"
            value={stats.todayAllowed}
            accent="indigo"
          />
          <StatCard
            label="今日已增量"
            value={stats.todayIncremental}
            accent="emerald"
          />
          <StatCard
            label="今日待补全"
            value={stats.todayBackfill}
            accent="orange"
          />
          <StatCard label="执行中" value={stats.running} accent="blue" />
          <StatCard label="失败" value={stats.failed} accent="red" />
          <StatCard
            label="已落盘 K 线"
            value={data.status.bar_count.toLocaleString()}
          />
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-500" />
                <h2 className="text-lg font-semibold">今日轮换 · 增量 vs 历史补全</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                仅统计今日轮换品类且已启用的状态行。历史回补完成（backfill_completed）后进入增量采集。
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-semibold text-teal-600 dark:text-teal-400">
                {stats.todayIncrementalPct}%
              </div>
              <div className="text-xs text-slate-500">增量完成率</div>
            </div>
          </div>

          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
              style={{ width: `${stats.todayIncrementalPct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">今日轮换状态行</div>
              <div className="text-xl font-semibold">{stats.todayAllowed}</div>
            </div>
            <button
              type="button"
              onClick={() => setFilter("incremental")}
              className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 text-left hover:border-emerald-400 transition"
            >
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 mb-1">
                <Zap className="w-3.5 h-3.5" />
                已进入增量采集
              </div>
              <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                {stats.todayIncremental}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFilter("backfill")}
              className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/20 px-4 py-3 text-left hover:border-orange-400 transition"
            >
              <div className="flex items-center gap-1.5 text-xs text-orange-700 dark:text-orange-300 mb-1">
                <History className="w-3.5 h-3.5" />
                仍需补全历史
              </div>
              <div className="text-xl font-semibold text-orange-700 dark:text-orange-300">
                {stats.todayBackfill}
              </div>
            </button>
          </div>

          {todayIncrementalByInterval.length > 0 && (
            <div className="mb-5">
              <div className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                按周期分布
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {todayIncrementalByInterval.map((row) => {
                  const pct =
                    row.total === 0
                      ? 0
                      : Math.round((row.incremental / row.total) * 100);
                  return (
                    <div
                      key={row.interval}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                    >
                      <div className="font-mono text-xs font-semibold">
                        {row.interval}
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        增量 {row.incremental}
                      </div>
                      <div className="text-[11px] text-orange-600 dark:text-orange-400">
                        补全 {row.backfill}
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                仍需补全历史的品种（{todayBackfillBySymbol.length}）
              </div>
              {stats.todayBackfill > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter("backfill")}
                  className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                >
                  在明细中筛选
                </button>
              )}
            </div>
            {todayBackfillBySymbol.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-6 text-center text-sm text-emerald-700 dark:text-emerald-300">
                今日轮换品类的所有启用周期均已进入增量采集
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {todayBackfillBySymbol.map((group) => (
                  <div
                    key={group.symbol}
                    className="rounded-xl border border-orange-200/80 dark:border-orange-900/60 bg-orange-50/30 dark:bg-orange-950/10 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          {group.symbol}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {CATEGORY_LABELS[group.asset_category] ||
                            group.asset_category}
                          {group.provider_symbol &&
                            group.provider_symbol !== group.symbol &&
                            ` · ${group.provider_symbol}`}
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        {group.intervals.length} 周期
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.intervals.map((state) => (
                        <span
                          key={state.id}
                          className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-1 rounded border border-orange-200 dark:border-orange-800 bg-white/70 dark:bg-slate-900/40"
                          title={
                            state.earliest_synced_bar_time
                              ? `最早水位: ${formatDateTime(state.earliest_synced_bar_time)}`
                              : "尚无最早水位"
                          }
                        >
                          {state.interval}
                          {state.last_status === "FAILED" && (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                          {state.last_status === "RUNNING" && (
                            <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="font-semibold">同步状态明细</span>
              <span className="text-xs text-slate-500">
                显示 {sortedFilteredStates.length} / {data.states.length} 行
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索品种、周期、错误..."
                  className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full sm:w-64"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterKey)}
                className="py-2 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="all">全部</option>
                <option value="today">今日轮换内</option>
                <option value="incremental">今日已增量</option>
                <option value="backfill">今日待补全</option>
                <option value="due">已到期</option>
                <option value="running">执行中</option>
                <option value="failed">失败</option>
                <option value="skipped">已跳过</option>
                <option value="disabled">已禁用</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">品种</th>
                  <th className="px-4 py-3 font-medium">品类 / 轮换</th>
                  <th className="px-4 py-3 font-medium">周期</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        setNextSyncSort((prev) =>
                          prev === "asc" ? "desc" : "asc"
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      title={
                        nextSyncSort === "asc"
                          ? "按下次执行时间升序（最早在前），点击切换"
                          : "按下次执行时间降序（最晚在前），点击切换"
                      }
                    >
                      <span>下次执行</span>
                      {nextSyncSort === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">倒计时</th>
                  <th className="px-4 py-3 font-medium">最近尝试</th>
                  <th className="px-4 py-3 font-medium">最近成功</th>
                  <th className="px-4 py-3 font-medium">重试</th>
                  <th className="px-4 py-3 font-medium min-w-[240px]">
                    错误信息
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedFilteredStates.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      没有符合筛选条件的状态行
                    </td>
                  </tr>
                )}
                {sortedFilteredStates.map((state) => {
                  const due = getIsDue(state, effectiveNow);
                  const secondsLeft = getSecondsUntil(state, effectiveNow);
                  const rowKey = `${state.id}`;
                  const errorExpanded = expandedErrors[state.id];

                  return (
                    <tr
                      key={rowKey}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        state.last_status === "FAILED"
                          ? "bg-red-50/40 dark:bg-red-950/20"
                          : due && state.enabled
                            ? "bg-amber-50/40 dark:bg-amber-950/10"
                            : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          {state.symbol}
                        </div>
                        <div className="text-xs text-slate-500">
                          {state.provider_symbol}
                        </div>
                        {!state.enabled && (
                          <span className="text-[10px] text-slate-400">
                            已禁用
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          {CATEGORY_LABELS[state.asset_category] ||
                            state.asset_category}
                        </div>
                        {state.allowed_today ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            <CheckCircle2 className="w-3 h-3" />
                            今日可采集
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                            <Clock3 className="w-3 h-3" />
                            非轮换日
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {state.interval}
                        </span>
                        <div className="mt-1">
                          <SyncModeBadge
                            incremental={isIncrementalState(state)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={state.last_status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                        {formatDateTime(state.next_sync_from)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <CountdownBadge
                          due={due && state.enabled}
                          secondsLeft={secondsLeft}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        {formatDateTime(state.last_attempt_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        {formatDateTime(state.last_success_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {state.retry_count || 0}
                      </td>
                      <td className="px-4 py-3">
                        {state.last_error ? (
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedErrors((prev) => ({
                                  ...prev,
                                  [state.id]: !prev[state.id],
                                }))
                              }
                              className="inline-flex items-start gap-1 text-left text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span
                                className={errorExpanded ? "" : "line-clamp-2"}
                              >
                                {state.last_error}
                              </span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-slate-500" />
              按品种汇总（{groupedBySymbol.length} 个品种）
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {groupedBySymbol.map((group) => {
              const dueCount = group.states.filter(
                (s) => s.enabled && getIsDue(s, effectiveNow)
              ).length;
              const failedCount = group.states.filter(
                (s) => s.last_status === "FAILED"
              ).length;
              const backfillCount = group.states.filter(
                (s) => s.enabled && !isIncrementalState(s)
              ).length;
              const incrementalCount = group.states.filter(
                (s) => s.enabled && isIncrementalState(s)
              ).length;
              const nextState = group.states
                .filter((s) => s.enabled && s.next_sync_from)
                .sort(
                  (a, b) =>
                    new Date(a.next_sync_from).getTime() -
                    new Date(b.next_sync_from).getTime()
                )[0];

              return (
                <div key={group.symbol} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {group.symbol}
                    </span>
                    <span className="text-xs text-slate-500">
                      {CATEGORY_LABELS[group.asset_category] ||
                        group.asset_category}
                    </span>
                    {group.allowed_today ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        今日轮换
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        非轮换日
                      </span>
                    )}
                    {incrementalCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                        {incrementalCount} 增量
                      </span>
                    )}
                    {backfillCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        {backfillCount} 待补全
                      </span>
                    )}
                    {dueCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {dueCount} 个周期已到期
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        {failedCount} 个失败
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.states.map((state) => {
                      const due = getIsDue(state, effectiveNow);
                      const secondsLeft = getSecondsUntil(state, effectiveNow);
                      return (
                        <div
                          key={state.id}
                          className={`rounded-lg border px-3 py-2 text-xs min-w-[150px] ${
                            state.last_status === "FAILED"
                              ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                              : due && state.enabled
                                ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                                : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="font-mono font-medium">
                            {state.interval}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <StatusBadge status={state.last_status} />
                            <SyncModeBadge
                              incremental={isIncrementalState(state)}
                              compact
                            />
                          </div>
                          <div className="mt-1 text-slate-500">
                            {state.enabled ? (
                              <CountdownBadge
                                due={due}
                                secondsLeft={secondsLeft}
                                compact
                              />
                            ) : (
                              "已禁用"
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {nextState && (
                    <div className="text-xs text-slate-500 mt-2">
                      最近下次执行：{formatDateTime(nextState.next_sync_from)}（
                      {nextState.interval}）
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {(data.running_tasks?.length || 0) > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30">
              <h2 className="font-semibold text-blue-700 dark:text-blue-300">
                当前执行中任务（{data.running_tasks.length}）
              </h2>
            </div>
            <div className="p-5 flex flex-wrap gap-3">
              {data.running_tasks.map((task) => (
                <div
                  key={`${task.instrument_id}-${task.interval}`}
                  className="rounded-lg border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm"
                >
                  <div className="font-semibold">{task.provider_symbol}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {task.interval} · {task.sync_mode}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    开始于 {formatDateTime(task.last_attempt_at)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function getNextSyncSortValue(
  nextSyncFrom: string | null | undefined
): number | null {
  if (!nextSyncFrom) return null;
  return new Date(nextSyncFrom).getTime();
}

function compareNextSyncFrom(
  a: { next_sync_from: string | null },
  b: { next_sync_from: string | null },
  sort: NextSyncSort
): number {
  const aValue = getNextSyncSortValue(a.next_sync_from);
  const bValue = getNextSyncSortValue(b.next_sync_from);

  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return sort === "asc" ? -1 : 1;
  if (bValue === null) return sort === "asc" ? 1 : -1;

  return sort === "asc" ? aValue - bValue : bValue - aValue;
}

function getIsDue(
  state: { enabled: boolean; next_sync_from: string | null },
  nowMs: number
) {
  if (!state.enabled) return false;
  if (!state.next_sync_from) return true;
  return new Date(state.next_sync_from).getTime() <= nowMs;
}

function getSecondsUntil(
  state: { next_sync_from: string | null; seconds_until_next_sync?: number },
  nowMs: number
) {
  if (!state.next_sync_from) return 0;
  const diff = Math.floor(
    (new Date(state.next_sync_from).getTime() - nowMs) / 1000
  );
  return Math.max(0, diff);
}

function CountdownBadge({
  due,
  secondsLeft,
  compact = false,
}: {
  due: boolean;
  secondsLeft: number;
  compact?: boolean;
}) {
  if (due) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        <Clock3 className="w-3 h-3" />
        已到期
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-mono ${
        compact ? "text-[11px]" : "text-xs"
      }`}
    >
      <Clock3 className="w-3 h-3 text-slate-400" />
      {formatDuration(secondsLeft)}
    </span>
  );
}

function SyncModeBadge({
  incremental,
  compact = false,
}: {
  incremental: boolean;
  compact?: boolean;
}) {
  if (incremental) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        <Zap className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        增量
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 ${
        compact ? "text-[10px]" : "text-[11px]"
      }`}
    >
      <History className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
      补全历史
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "amber" | "indigo" | "blue" | "red" | "emerald" | "orange";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : accent === "indigo"
        ? "text-indigo-600 dark:text-indigo-400"
        : accent === "blue"
          ? "text-blue-600 dark:text-blue-400"
          : accent === "red"
            ? "text-red-600 dark:text-red-400"
            : accent === "emerald"
              ? "text-emerald-600 dark:text-emerald-400"
              : accent === "orange"
                ? "text-orange-600 dark:text-orange-400"
                : "text-slate-900 dark:text-slate-100";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}
