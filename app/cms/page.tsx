"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Wallet, Database, Search, ShieldCheck } from "lucide-react";
import { useFetch } from "@/context/FetchContext";
import { CMS_TABS } from "@/components/cms/config";
import {
  listAdminUsers,
  listAdminWallets,
  listAdminCreditLogs,
  listAdminTokenRecords,
} from "@/components/cms/api";
import { formatNumber } from "@/components/cms/format";

const MetricCard = ({
  label,
  value,
  loading,
  icon: Icon,
  href,
  colorClass,
}: {
  label: string;
  value: string;
  loading: boolean;
  icon: any;
  href: string;
  colorClass: string;
}) => (
  <Link href={href} className="group block">
    <div
      className={`p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}
    >
      <div
        className={`absolute top-0 right-0 p-4 opacity-5 translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-500`}
      >
        <Icon className="w-24 h-24" />
      </div>
      <div className="flex items-center gap-4">
        <div
          className={`h-14 w-14 rounded-2xl flex items-center justify-center ${colorClass}`}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  </Link>
);

export default function CMSOverview() {
  const { customFetch } = useFetch();

  const [stats, setStats] = useState({
    users: 0,
    wallets: 0,
    logs: 0,
    tokens: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [u, w, l, t] = await Promise.all([
          listAdminUsers(customFetch, 1, 1, {} as any),
          listAdminWallets(customFetch, 1, 1, {} as any),
          listAdminCreditLogs(customFetch, 1, 1, {} as any),
          listAdminTokenRecords(customFetch, 1, 1, {} as any),
        ]);
        setStats({
          users: u.pagination.total,
          wallets: w.pagination.total,
          logs: l.pagination.total,
          tokens: t.pagination.total,
        });
      } catch (error) {
        console.error("Failed to fetch CMS stats", error);
      } finally {
        setLoading(false);
      }
    };
    void fetchStats();
  }, [customFetch]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 mb-4">
          <ShieldCheck className="h-3.5 w-3.5" />
          Super Admin Console
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          后台数据概览
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          目前系统中的各个核心模块数据总计，如需详细管理，请从左侧导航栏进
          入各个子系统。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard
          label="系统用户总数"
          value={formatNumber(stats.users)}
          loading={loading}
          icon={Users}
          href="/cms/users"
          colorClass="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400"
        />
        <MetricCard
          label="创建钱包总数"
          value={formatNumber(stats.wallets)}
          loading={loading}
          icon={Wallet}
          href="/cms/wallets"
          colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
        />
        <MetricCard
          label="算力流水总量"
          value={formatNumber(stats.logs)}
          loading={loading}
          icon={Database}
          href="/cms/credit-logs"
          colorClass="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
        />
        <MetricCard
          label="API 调用日志"
          value={formatNumber(stats.tokens)}
          loading={loading}
          icon={Search}
          href="/cms/token-records"
          colorClass="bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
        />
      </div>

      <div className="mt-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
          快捷导航
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CMS_TABS.map((tab, idx) => {
            const keys = ["users", "wallets", "credit-logs", "token-records"];
            return (
              <Link
                key={tab.id}
                href={`/cms/${keys[idx]}`}
                className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700/50 hover:bg-sky-50/50 dark:hover:bg-sky-900/10 transition-all"
              >
                <div className="mt-1 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-600 dark:text-slate-300">
                  <tab.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    {tab.label}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {tab.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
