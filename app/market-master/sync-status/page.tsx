"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/context/FetchContext";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  Filter,
  History,
  ListPlus,
  ListX,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  X,
  XCircle,
  Zap,
} from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const CANDIDATE_SEARCH_DEBOUNCE_MS = 300;

const CATEGORY_LABELS: Record<string, string> = {
  forex: "外汇",
  index: "指数",
  commodity: "大宗商品",
  crypto: "加密货币",
  other: "其他",
};
const CATEGORY_ORDER = ["forex", "index", "commodity", "crypto", "other"];

const STATUS_STYLES: Record<string, string> = {
  IDLE: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  SKIPPED:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  SUCCESS:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

type SyncState = {
  id: number;
  instrument_id: number;
  symbol: string;
  provider_symbol: string;
  asset_type: string | null;
  asset_category: string;
  in_queue: boolean;
  interval: string;
  enabled: boolean;
  sync_mode: string;
  backfill_completed: boolean;
  earliest_synced_bar_time: string | null;
  latest_synced_bar_time: string | null;
  next_sync_from: string | null;
  last_status: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  retry_count: number | null;
  last_error: string | null;
};

type QueueItem = {
  instrument_id: number;
  symbol: string;
  provider_symbol: string;
  name: string | null;
  asset_type: string | null;
  asset_category: string;
  is_active: boolean;
  added_at: string | null;
};

type Candidate = {
  instrument_id: number | null;
  symbol: string;
  provider_symbol: string;
  name: string | null;
  asset_type: string | null;
  asset_category: string;
  source: "local" | "fxcm";
};

type CycleResult = {
  reason?: string;
  skipped?: boolean;
  metadata_synced?: boolean;
  processed_states?: number;
  succeeded_states?: number;
  failed_states?: number;
  rows_upserted?: number;
  errors?: string[];
  finished_at?: string | null;
};

type SchedulerSnapshot = {
  running: boolean;
  blocked_reason: string | null;
  started_at: string | null;
  cycle_count: number;
  current_cycle_started_at: string | null;
  last_cycle: CycleResult | null;
  poll_interval_seconds: number;
};

type RunningTask = {
  instrument_id: number;
  symbol: string;
  provider_symbol: string;
  interval: string;
  sync_mode: string;
  last_attempt_at: string | null;
};

type SyncStatusPayload = {
  status: { bar_count: number; bar_intervals: string[] };
  scheduler: SchedulerSnapshot;
  queue: QueueItem[];
  running_tasks: RunningTask[];
  states: SyncState[];
  server_time: string;
};

type SymbolProgress = {
  instrumentId: number;
  symbol: string;
  providerSymbol: string;
  category: string;
  states: SyncState[];
  total: number;
  incremental: number;
  backfill: number;
  running: number;
  failed: number;
  due: number;
  pct: number;
  lastSuccessAt: string | null;
};

type DetailScope = "queue" | "candidate" | "all";
type FilterKey =
  | "all"
  | "due"
  | "failed"
  | "running"
  | "skipped"
  | "incremental"
  | "backfill"
  | "disabled";
type NextSyncSort = "asc" | "desc";

function isIncrementalState(state: SyncState): boolean {
  if (typeof state.backfill_completed === "boolean") {
    return state.backfill_completed;
  }
  return String(state.sync_mode || "").toUpperCase() === "INCREMENTAL";
}

function getIsDue(state: SyncState, nowMs: number) {
  if (!state.enabled) return false;
  if (!state.next_sync_from) return true;
  return new Date(state.next_sync_from).getTime() <= nowMs;
}

function getSecondsUntil(state: SyncState, nowMs: number) {
  if (!state.next_sync_from) return 0;
  const diff = Math.floor(
    (new Date(state.next_sync_from).getTime() - nowMs) / 1000
  );
  return Math.max(0, diff);
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

function formatElapsed(from: string | null, nowMs: number): string {
  if (!from) return "-";
  const seconds = Math.max(
    0,
    Math.floor((nowMs - new Date(from).getTime()) / 1000)
  );
  return seconds === 0 ? "刚刚" : formatDuration(seconds);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category;
}

function candidateKey(candidate: Candidate) {
  return candidate.instrument_id != null
    ? `id:${candidate.instrument_id}`
    : `fxcm:${candidate.symbol}`;
}

function summarizeByInstrument(
  states: SyncState[],
  nowMs: number
): Map<number, SymbolProgress> {
  const groups = new Map<number, SymbolProgress>();
  for (const state of states) {
    let group = groups.get(state.instrument_id);
    if (!group) {
      group = {
        instrumentId: state.instrument_id,
        symbol: state.symbol,
        providerSymbol: state.provider_symbol,
        category: state.asset_category,
        states: [],
        total: 0,
        incremental: 0,
        backfill: 0,
        running: 0,
        failed: 0,
        due: 0,
        pct: 0,
        lastSuccessAt: null,
      };
      groups.set(state.instrument_id, group);
    }
    group.states.push(state);
    if (state.last_status === "RUNNING") group.running += 1;
    if (state.last_status === "FAILED") group.failed += 1;
    if (
      state.last_success_at &&
      (!group.lastSuccessAt || state.last_success_at > group.lastSuccessAt)
    ) {
      group.lastSuccessAt = state.last_success_at;
    }
    if (!state.enabled) continue;
    group.total += 1;
    if (isIncrementalState(state)) group.incremental += 1;
    else group.backfill += 1;
    if (getIsDue(state, nowMs)) group.due += 1;
  }
  for (const group of groups.values()) {
    group.pct =
      group.total === 0
        ? 0
        : Math.round((group.incremental / group.total) * 100);
  }
  return groups;
}

async function readJson(res: Response) {
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      payload?.message || payload?.error || `请求失败 (${res.status})`
    );
  }
  return payload;
}

export default function SyncStatusPage() {
  const { customFetch } = useFetch();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSuperuser = !isAuthLoading && Boolean(user?.is_superuser);
  const [data, setData] = useState<SyncStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [clientNow, setClientNow] = useState(Date.now());
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [candidateKeyword, setCandidateKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [candidateCategory, setCandidateCategory] = useState("all");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set()
  );

  const [queueSearch, setQueueSearch] = useState("");
  const [selectedQueue, setSelectedQueue] = useState<Set<number>>(new Set());
  const [expandedQueue, setExpandedQueue] = useState<Record<number, boolean>>(
    {}
  );

  const [scope, setScope] = useState<DetailScope>("queue");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [nextSyncSort, setNextSyncSort] = useState<NextSyncSort>("asc");
  const [expandedErrors, setExpandedErrors] = useState<
    Record<number, boolean>
  >({});

  const loadStatus = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const res = await customFetch("/api/market_master/sync/status");
        const payload = await readJson(res);
        if (!payload?.data) throw new Error("接口返回数据为空");
        setData(payload.data);
        if (payload.data.server_time) {
          setServerOffsetMs(
            new Date(payload.data.server_time).getTime() - Date.now()
          );
        }
      } catch (e) {
        console.error("Failed to load sync status", e);
        if (manual) toast.error((e as Error).message);
      } finally {
        setLoading(false);
        if (manual) setRefreshing(false);
      }
    },
    [customFetch]
  );

  const loadCandidates = useCallback(
    async (keyword: string) => {
      setCandidatesLoading(true);
      try {
        const params = new URLSearchParams();
        if (keyword) params.set("keyword", keyword);
        const res = await customFetch(
          `/api/market_master/sync/candidates?${params.toString()}`
        );
        const payload = await readJson(res);
        setCandidates(payload?.data?.items || []);
        setRemoteError(payload?.data?.remote_error || null);
      } catch (e) {
        console.error("Failed to load sync candidates", e);
        toast.error((e as Error).message);
      } finally {
        setCandidatesLoading(false);
      }
    },
    [customFetch]
  );

  useEffect(() => {
    // 上一次请求返回后再排下一次，避免后端变慢时请求堆积。
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await loadStatus();
      if (!cancelled) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
    const clockTimer = setInterval(() => setClientNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
      clearInterval(clockTimer);
    };
  }, [loadStatus]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedKeyword(candidateKeyword.trim()),
      CANDIDATE_SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [candidateKeyword]);

  useEffect(() => {
    loadCandidates(debouncedKeyword);
  }, [debouncedKeyword, loadCandidates]);

  const postJson = useCallback(
    async (url: string, body?: unknown) => {
      const res = await customFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return readJson(res);
    },
    [customFetch]
  );

  const runAction = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setPendingAction(key);
      try {
        await action();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setPendingAction(null);
      }
    },
    []
  );

  const toggleScheduler = () => {
    const running = data?.scheduler.running;
    if (
      running &&
      !window.confirm("停止后正在进行的采集轮次会被中断（未提交的写入回滚），确定停止？")
    ) {
      return;
    }
    runAction("scheduler", async () => {
      await postJson(
        `/api/market_master/sync/scheduler/${running ? "stop" : "start"}`
      );
      toast.success(running ? "定时采集已停止" : "定时采集已开启");
      await loadStatus();
    });
  };

  const addToQueue = (items: Candidate[]) => {
    if (items.length === 0) return;
    runAction("add", async () => {
      const payload = await postJson("/api/market_master/sync/queue", {
        instrument_ids: items
          .filter((item) => item.instrument_id != null)
          .map((item) => item.instrument_id),
        symbols: items
          .filter((item) => item.instrument_id == null)
          .map((item) => item.symbol),
      });
      const result = payload?.data || {};
      const added: string[] = result.added || [];
      const notFound: string[] = result.not_found || [];
      if (added.length > 0) toast.success(`已加入队列：${added.join("、")}`);
      if (notFound.length > 0) toast.error(`未找到品种：${notFound.join("、")}`);
      if (added.length === 0 && notFound.length === 0) {
        toast("所选品种已在队列中");
      }
      setSelectedCandidates(new Set());
      await Promise.all([loadStatus(), loadCandidates(debouncedKeyword)]);
    });
  };

  const removeFromQueue = (instrumentIds: number[]) => {
    if (instrumentIds.length === 0) return;
    runAction("remove", async () => {
      const payload = await postJson("/api/market_master/sync/queue/remove", {
        instrument_ids: instrumentIds,
      });
      toast.success(`已移出 ${payload?.data?.removed ?? 0} 个品种，已采集数据保留`);
      setSelectedQueue(new Set());
      await Promise.all([loadStatus(), loadCandidates(debouncedKeyword)]);
    });
  };

  const effectiveNow = clientNow + serverOffsetMs;
  const states = useMemo(() => data?.states ?? [], [data?.states]);
  const queue = useMemo(() => data?.queue ?? [], [data?.queue]);

  const progressByInstrument = useMemo(
    () => summarizeByInstrument(states, effectiveNow),
    [states, effectiveNow]
  );

  const queueRows = useMemo(() => {
    const keyword = queueSearch.trim().toLowerCase();
    return queue
      .filter((item) => {
        if (!keyword) return true;
        return [item.symbol, item.provider_symbol, item.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .map((item) => ({
        item,
        progress: progressByInstrument.get(item.instrument_id),
      }));
  }, [queue, queueSearch, progressByInstrument]);

  const queueStats = useMemo(() => {
    const queueStates = states.filter((s) => s.in_queue && s.enabled);
    const incremental = queueStates.filter((s) => isIncrementalState(s));
    return {
      instruments: queue.length,
      total: queueStates.length,
      incremental: incremental.length,
      backfill: queueStates.length - incremental.length,
      running: queueStates.filter((s) => s.last_status === "RUNNING").length,
      failed: queueStates.filter((s) => s.last_status === "FAILED").length,
      due: queueStates.filter((s) => getIsDue(s, effectiveNow)).length,
      pct:
        queueStates.length === 0
          ? 0
          : Math.round((incremental.length / queueStates.length) * 100),
    };
  }, [states, queue.length, effectiveNow]);

  const queueByInterval = useMemo(() => {
    const counts = new Map<
      string,
      { interval: string; incremental: number; backfill: number; total: number }
    >();
    for (const state of states) {
      if (!state.in_queue || !state.enabled) continue;
      const key = state.interval || "unknown";
      if (!counts.has(key)) {
        counts.set(key, { interval: key, incremental: 0, backfill: 0, total: 0 });
      }
      const row = counts.get(key)!;
      row.total += 1;
      if (isIncrementalState(state)) row.incremental += 1;
      else row.backfill += 1;
    }
    const order = data?.status.bar_intervals ?? [];
    return Array.from(counts.values()).sort(
      (a, b) => order.indexOf(a.interval) - order.indexOf(b.interval)
    );
  }, [states, data?.status.bar_intervals]);

  const candidateCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const candidate of candidates) {
      counts[candidate.asset_category] =
        (counts[candidate.asset_category] || 0) + 1;
    }
    return counts;
  }, [candidates]);

  const visibleCandidates = useMemo(
    () =>
      candidates.filter(
        (c) => candidateCategory === "all" || c.asset_category === candidateCategory
      ),
    [candidates, candidateCategory]
  );

  const candidateProgressRows = useMemo(
    () =>
      Array.from(progressByInstrument.values())
        .filter((group) => !group.states.some((s) => s.in_queue))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [progressByInstrument]
  );

  const detailRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const items = states.filter((state) => {
      if (scope === "queue" && !state.in_queue) return false;
      if (scope === "candidate" && state.in_queue) return false;
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
          return getIsDue(state, effectiveNow);
        case "failed":
          return state.last_status === "FAILED";
        case "running":
          return state.last_status === "RUNNING";
        case "skipped":
          return state.last_status === "SKIPPED";
        case "incremental":
          return state.enabled && isIncrementalState(state);
        case "backfill":
          return state.enabled && !isIncrementalState(state);
        case "disabled":
          return !state.enabled;
        default:
          return true;
      }
    });
    items.sort((a, b) => compareNextSyncFrom(a, b, nextSyncSort));
    return items;
  }, [states, scope, search, filter, effectiveNow, nextSyncSort]);

  if (!data && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        正在加载历史数据采集控制台...
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

  if (!data.scheduler || !data.queue) {
    return (
      <div className="min-h-screen flex items-center justify-center text-amber-600 text-center px-6">
        后端尚未支持采集队列接口，请更新后端、执行 alembic upgrade head 并重启服务。
      </div>
    );
  }

  const scheduler = data.scheduler;
  const allVisibleCandidatesSelected =
    visibleCandidates.length > 0 &&
    visibleCandidates.every((c) => selectedCandidates.has(candidateKey(c)));
  const allQueueSelected =
    queueRows.length > 0 &&
    queueRows.every(({ item }) => selectedQueue.has(item.instrument_id));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Activity className="w-7 h-7 text-blue-500" />
              历史数据采集控制台
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              管理历史数据定时采集的启停与采集队列。实时模式不受此页面影响。
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            {isSuperuser && (
              <Link
                href="/market-master"
                className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 px-4 py-2 rounded-lg shadow-sm transition"
              >
                <ArrowLeft className="w-4 h-4" />
                返回行情主页
              </Link>
            )}
            <button
              onClick={() => loadStatus(true)}
              className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 px-4 py-2 rounded-lg shadow-sm transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              刷新
            </button>
          </div>
        </header>

        <SchedulerPanel
          scheduler={scheduler}
          runningTasks={data.running_tasks}
          queueSize={queue.length}
          nowMs={effectiveNow}
          pending={pendingAction === "scheduler"}
          onToggle={toggleScheduler}
        />

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-500" />
                <h2 className="text-lg font-semibold">队列采集进度</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                仅统计采集队列内品种的启用周期。历史回补完成（backfill_completed）后进入增量采集。
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-semibold text-teal-600 dark:text-teal-400">
                {queueStats.pct}%
              </div>
              <div className="text-xs text-slate-500">增量完成率</div>
            </div>
          </div>

          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
              style={{ width: `${queueStats.pct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
            <StatCard label="队列品种" value={queueStats.instruments} />
            <StatCard label="队列状态行" value={queueStats.total} />
            <StatCard
              label="已进入增量"
              value={queueStats.incremental}
              accent="emerald"
            />
            <StatCard
              label="仍需补全历史"
              value={queueStats.backfill}
              accent="orange"
            />
            <StatCard label="已到期/待执行" value={queueStats.due} accent="amber" />
            <StatCard label="执行中" value={queueStats.running} accent="blue" />
            <StatCard label="失败" value={queueStats.failed} accent="red" />
            <StatCard
              label="已落盘 K 线（全表估算）"
              value={data.status.bar_count.toLocaleString()}
            />
          </div>

          {queueByInterval.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                按周期分布
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
                {queueByInterval.map((row) => {
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
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-0">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold flex items-center gap-2">
                  <ListPlus className="w-4 h-4 text-blue-500" />
                  采集队列（{queue.length}）
                </h2>
                <button
                  type="button"
                  disabled={selectedQueue.size === 0 || pendingAction !== null}
                  onClick={() => removeFromQueue(Array.from(selectedQueue))}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  {pendingAction === "remove" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ListX className="w-4 h-4" />
                  )}
                  移出所选{selectedQueue.size > 0 ? `（${selectedQueue.size}）` : ""}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allQueueSelected}
                  onChange={() =>
                    setSelectedQueue(
                      allQueueSelected
                        ? new Set()
                        : new Set(queueRows.map(({ item }) => item.instrument_id))
                    )
                  }
                  className="w-4 h-4 accent-blue-600"
                  title="全选"
                />
                <SearchInput
                  value={queueSearch}
                  onChange={setQueueSearch}
                  placeholder="在队列中搜索..."
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[620px] divide-y divide-slate-100 dark:divide-slate-800">
              {queueRows.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                  {queue.length === 0
                    ? "队列为空。从右侧候选品种中选择要采集的品种加入队列。"
                    : "没有匹配的队列品种"}
                </div>
              )}
              {queueRows.map(({ item, progress }) => (
                <QueueRow
                  key={item.instrument_id}
                  item={item}
                  progress={progress}
                  nowMs={effectiveNow}
                  selected={selectedQueue.has(item.instrument_id)}
                  expanded={Boolean(expandedQueue[item.instrument_id])}
                  disabled={pendingAction !== null}
                  onToggleSelect={() =>
                    setSelectedQueue((prev) => toggleInSet(prev, item.instrument_id))
                  }
                  onToggleExpand={() =>
                    setExpandedQueue((prev) => ({
                      ...prev,
                      [item.instrument_id]: !prev[item.instrument_id],
                    }))
                  }
                  onRemove={() => removeFromQueue([item.instrument_id])}
                />
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-0">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-500" />
                  候选品种（{candidates.length}）
                  {candidatesLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  )}
                </h2>
                <button
                  type="button"
                  disabled={selectedCandidates.size === 0 || pendingAction !== null}
                  onClick={() =>
                    addToQueue(
                      candidates.filter((c) =>
                        selectedCandidates.has(candidateKey(c))
                      )
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  {pendingAction === "add" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  加入所选
                  {selectedCandidates.size > 0
                    ? `（${selectedCandidates.size}）`
                    : ""}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allVisibleCandidatesSelected}
                  onChange={() =>
                    setSelectedCandidates((prev) => {
                      const next = new Set(prev);
                      for (const c of visibleCandidates) {
                        if (allVisibleCandidatesSelected) next.delete(candidateKey(c));
                        else next.add(candidateKey(c));
                      }
                      return next;
                    })
                  }
                  className="w-4 h-4 accent-blue-600"
                  title="全选当前列表"
                />
                <SearchInput
                  value={candidateKeyword}
                  onChange={setCandidateKeyword}
                  placeholder="搜索品种，同时检索 FXCM 未落库品种..."
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["all", ...CATEGORY_ORDER].map((category) => {
                  const count =
                    category === "all"
                      ? candidates.length
                      : candidateCategoryCounts[category] || 0;
                  if (category !== "all" && count === 0) return null;
                  const active = candidateCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setCandidateCategory(category)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        active
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {category === "all" ? "全部" : categoryLabel(category)}{" "}
                      {count}
                    </button>
                  );
                })}
              </div>
              {remoteError && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  FXCM 检索失败，仅显示本地品种：{remoteError}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto max-h-[620px] divide-y divide-slate-100 dark:divide-slate-800">
              {visibleCandidates.length === 0 && !candidatesLoading && (
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                  没有可加入的候选品种
                </div>
              )}
              {visibleCandidates.map((candidate) => {
                const key = candidateKey(candidate);
                const progress =
                  candidate.instrument_id != null
                    ? progressByInstrument.get(candidate.instrument_id)
                    : undefined;
                return (
                  <div
                    key={key}
                    className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCandidates.has(key)}
                      onChange={() =>
                        setSelectedCandidates((prev) => toggleInSet(prev, key))
                      }
                      className="w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {candidate.symbol}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {categoryLabel(candidate.asset_category)}
                        </span>
                        {candidate.source === "fxcm" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            FXCM 未落库
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {candidate.name || candidate.provider_symbol}
                        {progress && progress.total > 0 && (
                          <span className="ml-2 text-slate-500">
                            · 已有进度 {progress.incremental}/{progress.total} 增量
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => addToQueue([candidate])}
                      className="shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-40 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      加入
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <details className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer list-none flex items-center justify-between gap-2 select-none">
            <span className="font-semibold flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-400 transition group-open:rotate-90" />
              候选品种已有进度（{candidateProgressRows.length}）
            </span>
            <span className="text-xs text-slate-500">
              不在队列中、但以前采集过或按需拉取过的品种，不会被定时任务继续采集
            </span>
          </summary>
          <div className="border-t border-slate-200 dark:border-slate-800">
            {candidateProgressRows.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                暂无队列外的同步状态
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800">
                {candidateProgressRows.map((group) => (
                  <div
                    key={group.instrumentId}
                    className="bg-white dark:bg-slate-900 px-5 py-3 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{group.symbol}</span>
                        <span className="text-[11px] text-slate-500">
                          {categoryLabel(group.category)}
                        </span>
                      </div>
                      <ProgressBar
                        pct={group.pct}
                        label={`${group.incremental}/${group.total} 增量`}
                        muted
                      />
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        最近成功 {formatDateTime(group.lastSuccessAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() =>
                        addToQueue([
                          {
                            instrument_id: group.instrumentId,
                            symbol: group.symbol,
                            provider_symbol: group.providerSymbol,
                            name: null,
                            asset_type: null,
                            asset_category: group.category,
                            source: "local",
                          },
                        ])
                      }
                      className="shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-40 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      续采
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                同步状态明细
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs">
                {(
                  [
                    ["queue", "队列"],
                    ["candidate", "候选"],
                    ["all", "全部"],
                  ] as [DetailScope, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScope(value)}
                    className={`px-3 py-1 rounded-md transition ${
                      scope === value
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                显示 {detailRows.length} / {states.length} 行
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="sm:w-64">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="搜索品种、周期、错误..."
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterKey)}
                className="py-2 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="all">全部状态</option>
                <option value="incremental">已增量</option>
                <option value="backfill">待补全</option>
                <option value="due">已到期</option>
                <option value="running">执行中</option>
                <option value="failed">失败</option>
                <option value="skipped">已跳过</option>
                <option value="disabled">已禁用</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">品种</th>
                  <th className="px-4 py-3 font-medium">品类 / 队列</th>
                  <th className="px-4 py-3 font-medium">周期</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">历史水位</th>
                  <th className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        setNextSyncSort((prev) => (prev === "asc" ? "desc" : "asc"))
                      }
                      className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      title="点击切换下次执行时间排序"
                    >
                      <span>下次执行</span>
                      {nextSyncSort === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">最近尝试</th>
                  <th className="px-4 py-3 font-medium">最近成功</th>
                  <th className="px-4 py-3 font-medium">重试</th>
                  <th className="px-4 py-3 font-medium min-w-[240px]">
                    错误信息
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {detailRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      没有符合筛选条件的状态行
                    </td>
                  </tr>
                )}
                {detailRows.map((state) => {
                  const due = getIsDue(state, effectiveNow);
                  const errorExpanded = expandedErrors[state.id];
                  return (
                    <tr
                      key={state.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        state.last_status === "FAILED"
                          ? "bg-red-50/40 dark:bg-red-950/20"
                          : due && state.in_queue
                            ? "bg-amber-50/40 dark:bg-amber-950/10"
                            : ""
                      } ${state.in_queue ? "" : "opacity-70"}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          {state.symbol}
                        </div>
                        <div className="text-xs text-slate-500">
                          {state.provider_symbol}
                        </div>
                        {!state.enabled && (
                          <span className="text-[10px] text-slate-400">已禁用</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>{categoryLabel(state.asset_category)}</div>
                        {state.in_queue ? (
                          <span className="inline-flex text-[11px] mt-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            队列中
                          </span>
                        ) : (
                          <span className="inline-flex text-[11px] mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            候选
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {state.interval}
                        </span>
                        <div className="mt-1">
                          <SyncModeBadge incremental={isIncrementalState(state)} />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={state.last_status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                        <div>{formatDate(state.earliest_synced_bar_time)}</div>
                        <div>→ {formatDate(state.latest_synced_bar_time)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs">
                          {formatDateTime(state.next_sync_from)}
                        </div>
                        {state.in_queue && state.enabled && (
                          <CountdownBadge
                            due={due}
                            secondsLeft={getSecondsUntil(state, effectiveNow)}
                            compact
                          />
                        )}
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
                            <span className={errorExpanded ? "" : "line-clamp-2"}>
                              {state.last_error}
                            </span>
                          </button>
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
      </div>
    </div>
  );
}

function toggleInSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function compareNextSyncFrom(
  a: { next_sync_from: string | null },
  b: { next_sync_from: string | null },
  sort: NextSyncSort
): number {
  const aValue = a.next_sync_from ? new Date(a.next_sync_from).getTime() : null;
  const bValue = b.next_sync_from ? new Date(b.next_sync_from).getTime() : null;

  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return sort === "asc" ? -1 : 1;
  if (bValue === null) return sort === "asc" ? 1 : -1;

  return sort === "asc" ? aValue - bValue : bValue - aValue;
}

function SchedulerPanel({
  scheduler,
  runningTasks,
  queueSize,
  nowMs,
  pending,
  onToggle,
}: {
  scheduler: SchedulerSnapshot;
  runningTasks: RunningTask[];
  queueSize: number;
  nowMs: number;
  pending: boolean;
  onToggle: () => void;
}) {
  const [errorsOpen, setErrorsOpen] = useState(false);
  const last = scheduler.last_cycle;
  const lastErrors = last?.errors || [];
  const blocked = !scheduler.running && Boolean(scheduler.blocked_reason);

  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${
        scheduler.running
          ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-4 lg:w-[320px] shrink-0">
          <span className="relative flex h-3.5 w-3.5">
            {scheduler.running && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                scheduler.running ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
          </span>
          <div>
            <div className="text-lg font-semibold">
              历史数据定时采集 · {scheduler.running ? "运行中" : "已停止"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {scheduler.running
                ? scheduler.current_cycle_started_at
                  ? `本轮进行中，已持续 ${formatElapsed(scheduler.current_cycle_started_at, nowMs)}`
                  : `空闲，最长 ${scheduler.poll_interval_seconds} 秒后进入下一轮`
                : "服务重启后默认停止，需要在此手动开启"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          <MiniStat
            label="已运行"
            value={scheduler.running ? formatElapsed(scheduler.started_at, nowMs) : "-"}
          />
          <MiniStat label="已完成轮次" value={scheduler.cycle_count} />
          <MiniStat
            label="上一轮处理 / 失败"
            value={
              last
                ? `${last.processed_states ?? 0} / ${last.failed_states ?? 0}`
                : "-"
            }
          />
          <MiniStat
            label="上一轮写入 K 线"
            value={last ? (last.rows_upserted ?? 0).toLocaleString() : "-"}
            hint={last?.finished_at ? `完成于 ${formatDateTime(last.finished_at)}` : undefined}
          />
        </div>

        <div className="shrink-0 flex flex-col items-start lg:items-end gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            disabled={pending || blocked}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white shadow transition disabled:opacity-50 disabled:pointer-events-none ${
              scheduler.running
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : scheduler.running ? (
              <Square className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {scheduler.running ? "停止采集" : "开启采集"}
          </button>
          {blocked && (
            <div className="text-xs text-amber-600 dark:text-amber-400 max-w-[260px] lg:text-right">
              {scheduler.blocked_reason}
            </div>
          )}
        </div>
      </div>

      {scheduler.running && queueSize === 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          采集队列为空，调度器正在空转。请把要采集的品种加入队列。
        </div>
      )}

      {(runningTasks.length > 0 || lastErrors.length > 0) && (
        <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 flex flex-col gap-3">
          {runningTasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">正在执行：</span>
              {runningTasks.map((task) => (
                <span
                  key={`${task.instrument_id}-${task.interval}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 text-blue-700 dark:text-blue-300"
                  title={`开始于 ${formatDateTime(task.last_attempt_at)}`}
                >
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {task.symbol} · {task.interval}
                </span>
              ))}
            </div>
          )}
          {lastErrors.length > 0 && (
            <div className="text-xs">
              <button
                type="button"
                onClick={() => setErrorsOpen((open) => !open)}
                className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline"
              >
                {errorsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                上一轮有 {lastErrors.length} 条错误
              </button>
              {errorsOpen && (
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-red-600/90 dark:text-red-400/90 max-h-40 overflow-y-auto">
                  {lastErrors.map((error, index) => (
                    <li key={index} className="break-all">
                      {error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function QueueRow({
  item,
  progress,
  nowMs,
  selected,
  expanded,
  disabled,
  onToggleSelect,
  onToggleExpand,
  onRemove,
}: {
  item: QueueItem;
  progress: SymbolProgress | undefined;
  nowMs: number;
  selected: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onRemove: () => void;
}) {
  const states = progress?.states.filter((s) => s.enabled) ?? [];
  return (
    <div className={selected ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}>
      <div className="px-5 py-3 flex items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="w-4 h-4 accent-blue-600 shrink-0"
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="min-w-0 flex-1 text-left flex items-center gap-3"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <div className="w-36 shrink-0">
            <div className="font-semibold text-blue-600 dark:text-blue-400 truncate">
              {item.symbol}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {categoryLabel(item.asset_category)}
              {item.provider_symbol !== item.symbol && ` · ${item.provider_symbol}`}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {progress && progress.total > 0 ? (
              <ProgressBar
                pct={progress.pct}
                label={`${progress.incremental}/${progress.total} 周期已增量`}
              />
            ) : (
              <span className="text-xs text-slate-400">尚未生成同步状态</span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 w-40 justify-end">
            {!item.is_active && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                已停用
              </span>
            )}
            {(progress?.running ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <RefreshCw className="w-3 h-3 animate-spin" />
                采集中
              </span>
            )}
            {(progress?.failed ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <XCircle className="w-3 h-3" />
                {progress!.failed}
              </span>
            )}
            {(progress?.due ?? 0) > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {progress!.due} 待执行
              </span>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="移出队列（保留已采集数据）"
          className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <div className="px-5 pb-4 pl-[4.25rem]">
          {states.length === 0 ? (
            <div className="text-xs text-slate-400">暂无启用的同步周期</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {states.map((state) => {
                const due = getIsDue(state, nowMs);
                return (
                  <div
                    key={state.id}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      state.last_status === "FAILED"
                        ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                        : due
                          ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                          : "border-slate-200 dark:border-slate-700"
                    }`}
                    title={state.last_error || undefined}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-medium">{state.interval}</span>
                      <StatusBadge status={state.last_status} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <SyncModeBadge incremental={isIncrementalState(state)} compact />
                      <CountdownBadge
                        due={due}
                        secondsLeft={getSecondsUntil(state, nowMs)}
                        compact
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400 font-mono">
                      {formatDate(state.earliest_synced_bar_time)} →{" "}
                      {formatDate(state.latest_synced_bar_time)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full"
      />
    </div>
  );
}

function ProgressBar({
  pct,
  label,
  muted = false,
}: {
  pct: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all ${
            muted ? "bg-slate-400 dark:bg-slate-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-500 whitespace-nowrap">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ||
    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {status}
    </span>
  );
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

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "amber" | "blue" | "red" | "emerald" | "orange";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-600 dark:text-amber-400"
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}
