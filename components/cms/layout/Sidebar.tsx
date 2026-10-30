"use client";

import Link from "../CmsLink";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  LayoutDashboard,
  LayoutTemplate,
  ShieldCheck,
  X,
} from "lucide-react";
import { CMS_TABS } from "../config";

export const CMS_NAV = [
  { href: "/cms", label: "工作概览", icon: LayoutDashboard },
  ...CMS_TABS.map((tab, index) => ({
    ...tab,
    href: `/cms/${["users", "wallets", "credit-logs", "token-records"][index]}`,
  })),
  { href: "/cms/homepage", label: "首页版本", icon: LayoutTemplate },
];

export default function Sidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside
      className={`${mobile ? "flex w-full" : "sticky top-0 hidden w-60 xl:w-64 lg:flex"} h-dvh shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}
    >
      <div className="flex h-20 shrink-0 items-center gap-3 px-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white dark:bg-teal-600">
          <ShieldCheck size={22} />
        </span>
        <div>
          <p className="font-semibold tracking-tight">AI Hub</p>
          <p className="mt-0.5 text-[11px] tracking-[.18em] text-slate-400">
            管理控制台
          </p>
        </div>
        {mobile && (
          <button
            aria-label="关闭菜单"
            onClick={onNavigate}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <nav
        aria-label="后台导航"
        className="flex-1 space-y-1 overflow-y-auto px-4 py-6"
      >
        <p className="mb-3 px-3 text-[11px] font-medium tracking-widest text-slate-400">
          工作空间
        </p>
        {CMS_NAV.map((item, index) => {
          const active =
            pathname === item.href ||
            (item.href !== "/cms" && pathname.startsWith(item.href + "/"));
          return (
            <div
              key={item.href}
              className={
                index === 5
                  ? "mt-7 border-t border-slate-100 pt-5 dark:border-slate-800"
                  : ""
              }
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? "bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"}`}
              >
                <item.icon size={19} strokeWidth={active ? 2 : 1.7} />
                {item.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-slate-800">
        <Link
          href="/"
          className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          打开前台
          <ArrowUpRight size={16} />
        </Link>
        <p className="mt-3 px-3 text-[11px] text-slate-400">
          AI Hub · 运营管理
        </p>
      </div>
    </aside>
  );
}
