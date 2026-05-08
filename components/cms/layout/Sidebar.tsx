"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Wallet, Database, ShieldCheck, Home } from "lucide-react";
import { CMS_TABS } from "@/components/cms/config";

export default function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/cms", label: "概览看板", icon: Home },
    { href: "/cms/users", label: CMS_TABS[0].label, icon: Users },
    { href: "/cms/wallets", label: CMS_TABS[1].label, icon: Wallet },
    { href: "/cms/credit-logs", label: CMS_TABS[2].label, icon: Database },
    { href: "/cms/token-records", label: CMS_TABS[3].label, icon: Database },
  ];

  return (
    <aside
      className={`w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0 ${className ?? "hidden md:flex"}`}
    >
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
        <ShieldCheck className="h-6 w-6 text-sky-500 mr-3" />
        <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
          Super Admin
        </span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <div className="mb-4 px-2">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            数据管理
          </p>
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-slate-900 text-white shadow-md dark:bg-sky-500 dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <item.icon className="h-5 w-5 mr-3" />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="bg-sky-50 dark:bg-sky-500/10 p-4 rounded-2xl border border-sky-100 dark:border-sky-500/20">
          <p className="text-xs text-sky-800 dark:text-sky-300 leading-relaxed text-center">
            欢迎来到超级管理后台，您拥有所有系统数据的最高读写权限。
          </p>
        </div>
      </div>
    </aside>
  );
}
