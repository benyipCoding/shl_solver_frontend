"use client";

import Link from "@/components/cms/CmsLink";
import { useCallback, useEffect } from "react";
import {
  ArrowUpRight,
  LayoutDashboard,
  LayoutTemplate,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useFetch } from "@/context/FetchContext";
import { useAuth } from "@/context/AuthContext";
import {
  CMS_TABS,
  DEFAULT_USER_FILTERS,
  DEFAULT_WALLET_FILTERS,
  DEFAULT_CREDIT_LOG_FILTERS,
  DEFAULT_TOKEN_RECORD_FILTERS,
} from "@/components/cms/config";
import {
  listAdminUsers,
  listAdminWallets,
  listAdminCreditLogs,
  listAdminTokenRecords,
} from "@/components/cms/api";
import { useCmsResource, useCmsStore } from "@/components/cms/CmsDataProvider";
import PageHeading from "@/components/cms/PageHeading";
import { formatNumber } from "@/components/cms/format";

type Stats = {
  users: number;
  wallets: number;
  creditLogs: number;
  tokenRecords: number;
};
const paths = ["users", "wallets", "credit-logs", "token-records"];
const metricLabels = ["注册用户", "已开通钱包", "算力流水", "模型调用记录"];

export default function CMSOverview() {
  const { customFetch } = useFetch();
  const { user } = useAuth();
  const store = useCmsStore();
  const { data, loading, error } = useCmsResource<Stats>("overview");
  const reload = useCallback(
    (force = false) =>
      store.load(
        "overview",
        "totals",
        async () => {
          const [users, wallets, logs, tokens] = await Promise.all([
            listAdminUsers(customFetch, 1, 1, DEFAULT_USER_FILTERS),
            listAdminWallets(customFetch, 1, 1, {
              ...DEFAULT_WALLET_FILTERS,
              onlyWithWallet: true,
            }),
            listAdminCreditLogs(customFetch, 1, 1, DEFAULT_CREDIT_LOG_FILTERS),
            listAdminTokenRecords(
              customFetch,
              1,
              1,
              DEFAULT_TOKEN_RECORD_FILTERS,
            ),
          ]);
          return {
            users: users.pagination.total,
            wallets: wallets.pagination.total,
            creditLogs: logs.pagination.total,
            tokenRecords: tokens.pagination.total,
          };
        },
        force,
      ),
    [customFetch, store],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-7">
      <PageHeading
        title="工作概览"
        description="用户、算力与内容，都在这里有序管理。"
        icon={LayoutDashboard}
      >
        <button
          onClick={() => void reload(true)}
          disabled={loading}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <RefreshCw
            size={15}
            className={loading ? "motion-safe:animate-spin" : ""}
          />
          刷新概览
        </button>
      </PageHeading>
      <div className="relative overflow-hidden rounded-2xl bg-teal-900 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="mb-3 flex items-center gap-2 text-xs tracking-wider text-teal-200">
              <ShieldCheck size={14} />
              管理员工作空间
            </p>
            <h2 className="wrap-anywhere text-xl font-medium sm:text-2xl">
              欢迎回来，{user?.username || "管理员"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-teal-100/75">
              从账号维护到算力调整，快速处理日常运营。
              <br className="hidden sm:block" />
              每一次算力变动，都有记录可查。
            </p>
          </div>
          <Link
            href="/cms/wallets"
            className="inline-flex h-11 items-center gap-3 rounded-xl bg-white px-4 text-sm font-medium text-teal-900 hover:bg-teal-50"
          >
            <Wallet size={16} />
            管理算力
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <span>
            {data ? "刷新失败，显示上次统计。" : "统计暂时不可用。"}
            {error}
          </span>
          <button
            disabled={loading}
            onClick={() => void reload(true)}
            className="min-h-10 underline underline-offset-4"
          >
            重试
          </button>
        </div>
      )}
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4"
        aria-busy={loading}
      >
        {CMS_TABS.map((tab, index) => (
          <Link
            key={tab.id}
            href={`/cms/${paths[index]}`}
            className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-300 sm:p-5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
          >
            <div className="mb-5 flex items-center justify-between">
              <tab.icon size={19} className="text-slate-400" />
              <ArrowUpRight
                size={14}
                className="text-slate-300 group-hover:text-teal-600"
              />
            </div>
            <p className="text-xs text-slate-500 sm:text-sm">
              {metricLabels[index]}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
              {data ? formatNumber(data[tab.id]) : "—"}
            </p>
            <p className="mt-3 text-[11px] text-slate-400">
              {loading ? "正在更新…" : "查看全部记录"}
            </p>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">常用管理</h2>
            <span className="text-xs text-slate-400">日常运营</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {CMS_TABS.map((tab, index) => (
              <Link
                key={tab.id}
                href={`/cms/${paths[index]}`}
                className="group flex items-center gap-3 py-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-teal-50 group-hover:text-teal-700 dark:bg-slate-800 dark:group-hover:bg-teal-900 dark:group-hover:text-teal-200">
                  <tab.icon size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{tab.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {tab.description}
                  </p>
                </div>
                <ArrowUpRight
                  size={16}
                  className="ml-auto shrink-0 text-slate-300 group-hover:text-teal-600"
                />
              </Link>
            ))}
          </div>
        </section>
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <LayoutTemplate
            size={24}
            strokeWidth={1.5}
            className="mb-6 text-teal-700 dark:text-teal-400"
          />
          <p className="text-xs tracking-widest text-slate-400">内容与展示</p>
          <h2 className="mt-2 text-xl font-semibold">让首页保持新鲜</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
            预览不同首页风格，再选择对访客展示的版本。保留已有版本，随时切换。
          </p>
          <Link
            href="/cms/homepage"
            className="mt-6 flex min-h-12 items-center justify-between rounded-xl bg-slate-50 px-4 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-800 dark:bg-slate-800 dark:text-slate-200"
          >
            管理首页版本
            <ArrowUpRight size={16} />
          </Link>
          <div className="mt-auto pt-7 text-xs leading-6 text-slate-400">
            运营提示
            <br />
            调整用户算力后，可在「算力流水」核对变动来源与余额。
          </div>
        </section>
      </div>
    </div>
  );
}
