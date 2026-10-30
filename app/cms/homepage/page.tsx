"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Eye,
  LayoutTemplate,
  Loader2,
  Orbit,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useFetch } from "@/context/FetchContext";
import {
  HOME_VERSIONS,
  type HomepageConfig,
  type HomepageVersion,
} from "@/components/home/versions";
import {
  getAdminHomepage,
  publishAdminHomepage,
} from "@/components/home/version-api";

export default function HomepageManagement() {
  const { customFetch } = useFetch();
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState<HomepageVersion>(2);
  const dialog = useRef<HTMLDialogElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setConfig(await getAdminHomepage(customFetch));
    } catch (cause) {
      setConfig(null);
      setError(cause instanceof Error ? cause.message : "无法加载首页版本");
    } finally {
      setLoading(false);
    }
  }, [customFetch]);

  useEffect(() => {
    let active = true;
    getAdminHomepage(customFetch)
      .then((value) => {
        if (active) {
          setConfig(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setConfig(null);
          setError(cause instanceof Error ? cause.message : "无法加载首页版本");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customFetch]);

  const publish = async () => {
    if (!config || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await publishAdminHomepage(
        customFetch,
        selected,
        config.revision,
      );
      setConfig(updated);
      setSuccess(
        `第 ${updated.active_version} 版已启用。访客下次打开或刷新首页时将看到此版本。`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布失败，请重试");
      // Reconcile after conflicts or ambiguous network failures before another publish.
      try {
        setConfig(await getAdminHomepage(customFetch));
      } catch {
        setConfig(null);
      }
    } finally {
      setSaving(false);
      dialog.current?.close();
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 text-xs font-medium tracking-wider text-sky-600 dark:text-sky-400">
            <LayoutTemplate size={15} /> HOMEPAGE VERSIONS
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            首页版本管理
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
            先预览，再决定。每个版本都独立保留，随时切换全站首页。
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          查看线上首页 <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="mb-7 flex flex-wrap items-center gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-5 dark:border-sky-500/20 dark:bg-sky-500/5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
          <ShieldCheck size={23} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {loading
              ? "正在读取线上配置…"
              : config
                ? `当前线上：第 ${config.active_version} 版 · ${HOME_VERSIONS.find((v) => v.version === config.active_version)?.name}`
                : "尚未读取到线上配置"}
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
            {config
              ? `最近更新：${new Date(config.updated_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（北京时间）`
              : "配置存储于服务器，对所有访客生效。"}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading || saving}
          className="rounded-lg p-2 text-slate-500 hover:bg-sky-100 disabled:opacity-40 dark:hover:bg-sky-500/10"
          aria-label="刷新线上版本"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
          <button
            type="button"
            onClick={reload}
            disabled={loading || saving}
            className="ml-4 underline disabled:opacity-40"
          >
            重新加载
          </button>
        </div>
      )}
      {success && (
        <div
          role="status"
          className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <CheckCircle2 size={18} className="shrink-0" />
          {success}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {HOME_VERSIONS.map((version) => (
          <article
            key={version.version}
            className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ${config?.active_version === version.version ? "border-sky-400 ring-1 ring-sky-400/30 dark:border-sky-500" : "border-slate-200 dark:border-slate-800"}`}
          >
            <div
              aria-hidden="true"
              className={`relative flex h-56 flex-col items-center justify-center overflow-hidden border-b ${version.version === 1 ? "border-slate-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50" : "border-white/5 bg-[#0c100d]"}`}
            >
              <div
                className={`absolute left-5 top-4 text-[9px] font-semibold tracking-widest ${version.version === 1 ? "text-indigo-500" : "text-lime-200/60"}`}
              >
                AI HUB / {version.subtitle}
              </div>
              {version.version === 1 ? (
                <>
                  <div className="mb-3 text-[10px] text-indigo-400">
                    不仅是工具，更是你的智能生活助手
                  </div>
                  <div className="text-2xl font-bold text-slate-800">
                    探索 <span className="text-indigo-600">AI</span> 的无限可能
                  </div>
                  <div className="mt-5 rounded bg-indigo-600 px-5 py-2 text-[9px] text-white">
                    立即体验 ↓
                  </div>
                  <div className="mt-5 flex gap-2">
                    {[
                      "#818cf8",
                      "#34d399",
                      "#60a5fa",
                      "#fbbf24",
                      "#22d3ee",
                    ].map((color) => (
                      <span
                        key={color}
                        className="flex h-9 w-12 items-center justify-center rounded border border-slate-100 bg-white shadow-sm"
                      >
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ background: color }}
                        />
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute -right-8 top-0 h-64 w-64 rounded-full bg-lime-200/5 blur-3xl" />
                  <div className="flex w-full items-center justify-around gap-4 px-7">
                    <div>
                      <p className="mb-3 text-[7px] tracking-[.2em] text-lime-200/50">
                        YOUR NEXT POSSIBILITY
                      </p>
                      <div className="text-3xl font-semibold leading-snug text-[#e9ece5]">
                        无限可能，
                        <br />
                        <span className="text-[#c3f57b]">即刻接入。</span>
                      </div>
                      <div className="mt-4 inline-block rounded bg-[#c3f57b] px-3 py-2 text-[8px] text-lime-950">
                        探索工作空间 ↗
                      </div>
                    </div>
                    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full border border-dashed border-lime-200/20">
                      <Orbit
                        size={110}
                        strokeWidth={0.55}
                        className="text-lime-200/70"
                      />
                      <span className="absolute text-xl font-light text-lime-100">
                        AI
                      </span>
                    </div>
                  </div>
                </>
              )}
              <span
                className={`absolute bottom-3 right-4 text-[8px] ${version.version === 1 ? "text-slate-400" : "text-lime-200/40"}`}
              >
                风格示意 · 点击预览查看完整页面
              </span>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  第 {version.version} 版{" "}
                  <span className="ml-2 text-base font-normal text-slate-500 dark:text-slate-400">
                    {version.name}
                  </span>
                </h2>
                {config?.active_version === version.version && (
                  <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Check size={12} />
                    线上使用中
                  </span>
                )}
              </div>
              <p className="mb-6 mt-3 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {version.description}
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/cms/homepage/preview/${version.version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Eye size={16} />
                  预览此版本
                </Link>
                <button
                  type="button"
                  disabled={
                    !config ||
                    loading ||
                    saving ||
                    config.active_version === version.version
                  }
                  onClick={() => {
                    setSelected(version.version);
                    dialog.current?.showModal();
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  {config?.active_version === version.version
                    ? "已启用"
                    : "设为线上版本"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs leading-7 text-slate-500 dark:text-slate-400">
        预览不会改变线上首页。发布后新访问或刷新页面即可看到所选版本；第一版始终保留。只有超级管理员可以发布。
      </p>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        aria-labelledby="publish-title"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="publish-title" className="text-xl font-semibold">
            启用第 {selected} 版首页？
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={() => dialog.current?.close()}
            aria-label="取消发布"
          >
            <X size={19} />
          </button>
        </div>
        <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">
          这将更改所有访客看到的首页。你可以随时在此处切回其他版本。
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => dialog.current?.close()}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={publish}
            className="flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "正在发布…" : "确认启用"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
