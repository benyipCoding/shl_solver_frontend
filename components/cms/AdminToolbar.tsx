"use client";

import { RefreshCw, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "@/components/cms/config";
import { actionTypeOptions } from "@/components/cms/api";
import {
  AdminTabId,
  CreditLogFilters,
  TokenRecordFilters,
  UserFilters,
  WalletFilters,
} from "@/interfaces/cms";

interface AdminToolbarProps {
  activeTab: AdminTabId;
  isRefreshing: boolean;
  pageSize: number;
  usersFilters?: UserFilters;
  walletsFilters?: WalletFilters;
  creditLogFilters?: CreditLogFilters;
  tokenRecordFilters?: TokenRecordFilters;
  onUsersFiltersChange?: (updates: Partial<UserFilters>) => void;
  onWalletFiltersChange?: (updates: Partial<WalletFilters>) => void;
  onCreditLogFiltersChange?: (updates: Partial<CreditLogFilters>) => void;
  onTokenRecordFiltersChange?: (updates: Partial<TokenRecordFilters>) => void;
  onPageSizeChange: (value: number) => void;
  onRefresh: () => void;
  onReset: () => void;
}

const controlClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-500/20";

const labelClassName =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400";

const SectionLabel = ({ title }: { title: string }) => {
  return <label className={labelClassName}>{title}</label>;
};

const PageSizeSelect = ({
  pageSize,
  onPageSizeChange,
}: {
  pageSize: number;
  onPageSizeChange: (value: number) => void;
}) => {
  return (
    <div>
      <SectionLabel title="每页条数" />
      <select
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        className={controlClassName}
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size} 条
          </option>
        ))}
      </select>
    </div>
  );
};

export default function AdminToolbar({
  activeTab,
  isRefreshing,
  pageSize,
  usersFilters,
  walletsFilters,
  creditLogFilters,
  tokenRecordFilters,
  onUsersFiltersChange,
  onWalletFiltersChange,
  onCreditLogFiltersChange,
  onTokenRecordFiltersChange,
  onPageSizeChange,
  onRefresh,
  onReset,
}: AdminToolbarProps) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.32)] backdrop-blur xl:p-6 dark:border-slate-800 dark:bg-slate-900/75">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            查询工作台
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
            快速筛选、分页和回溯后台数据
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            所有列表均直接对接 Admin 接口，支持组合过滤后即时刷新。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            重置筛选
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            刷新当前标签
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        {activeTab === "users" && (
          <>
            <div className="xl:col-span-2">
              <SectionLabel title="关键字" />
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={usersFilters?.keyword}
                  onChange={(event) =>
                    onUsersFiltersChange?.({ keyword: event.target.value })
                  }
                  placeholder="用户名 / 邮箱 / 手机号"
                  className={`${controlClassName} pl-11`}
                />
              </div>
            </div>

            <div>
              <SectionLabel title="账号状态" />
              <select
                value={usersFilters?.isActive}
                onChange={(event) =>
                  onUsersFiltersChange?.({
                    isActive: event.target.value as UserFilters["isActive"],
                  })
                }
                className={controlClassName}
              >
                <option value="all">全部</option>
                <option value="true">正常</option>
                <option value="false">禁用</option>
              </select>
            </div>

            <div>
              <SectionLabel title="员工权限" />
              <select
                value={usersFilters?.isStaff}
                onChange={(event) =>
                  onUsersFiltersChange?.({
                    isStaff: event.target.value as UserFilters["isStaff"],
                  })
                }
                className={controlClassName}
              >
                <option value="all">全部</option>
                <option value="true">仅 Staff</option>
                <option value="false">排除 Staff</option>
              </select>
            </div>

            <div>
              <SectionLabel title="超管权限" />
              <select
                value={usersFilters?.isSuperuser}
                onChange={(event) =>
                  onUsersFiltersChange?.({
                    isSuperuser: event.target
                      .value as UserFilters["isSuperuser"],
                  })
                }
                className={controlClassName}
              >
                <option value="all">全部</option>
                <option value="true">仅超级管理员</option>
                <option value="false">排除超级管理员</option>
              </select>
            </div>

            <PageSizeSelect
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}

        {activeTab === "wallets" && (
          <>
            <div className="xl:col-span-3">
              <SectionLabel title="关键字" />
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={walletsFilters?.keyword}
                  onChange={(event) =>
                    onWalletFiltersChange?.({ keyword: event.target.value })
                  }
                  placeholder="用户名 / 邮箱 / 手机号"
                  className={`${controlClassName} pl-11`}
                />
              </div>
            </div>

            <div className="flex items-end xl:col-span-1">
              <label className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                <span className="font-medium">仅看已开通钱包</span>
                <input
                  type="checkbox"
                  checked={walletsFilters?.onlyWithWallet}
                  onChange={(event) =>
                    onWalletFiltersChange?.({
                      onlyWithWallet: event.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                />
              </label>
            </div>

            <PageSizeSelect
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}

        {activeTab === "creditLogs" && (
          <>
            <div className="xl:col-span-2">
              <SectionLabel title="关键字" />
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={creditLogFilters?.keyword}
                  onChange={(event) =>
                    onCreditLogFiltersChange?.({ keyword: event.target.value })
                  }
                  placeholder="邮箱 / 用户名"
                  className={`${controlClassName} pl-11`}
                />
              </div>
            </div>

            <div>
              <SectionLabel title="用户 ID" />
              <input
                value={creditLogFilters?.userId}
                onChange={(event) =>
                  onCreditLogFiltersChange?.({ userId: event.target.value })
                }
                placeholder="例如 12"
                className={controlClassName}
              />
            </div>

            <div>
              <SectionLabel title="点数类型" />
              <select
                value={creditLogFilters?.creditType}
                onChange={(event) =>
                  onCreditLogFiltersChange?.({
                    creditType: event.target
                      .value as CreditLogFilters["creditType"],
                  })
                }
                className={controlClassName}
              >
                <option value="all">全部</option>
                <option value="FREE">FREE</option>
                <option value="PAID">PAID</option>
              </select>
            </div>

            <div>
              <SectionLabel title="动作类型" />
              <select
                value={creditLogFilters?.actionType}
                onChange={(event) =>
                  onCreditLogFiltersChange?.({
                    actionType: event.target
                      .value as CreditLogFilters["actionType"],
                  })
                }
                className={controlClassName}
              >
                <option value="all">全部</option>
                {actionTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <SectionLabel title="开始时间" />
              <input
                type="datetime-local"
                value={creditLogFilters?.startAt}
                onChange={(event) =>
                  onCreditLogFiltersChange?.({ startAt: event.target.value })
                }
                className={controlClassName}
              />
            </div>

            <div>
              <SectionLabel title="结束时间" />
              <input
                type="datetime-local"
                value={creditLogFilters?.endAt}
                onChange={(event) =>
                  onCreditLogFiltersChange?.({ endAt: event.target.value })
                }
                className={controlClassName}
              />
            </div>

            <PageSizeSelect
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}

        {activeTab === "tokenRecords" && (
          <>
            <div className="xl:col-span-2">
              <SectionLabel title="关键字" />
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={tokenRecordFilters?.keyword}
                  onChange={(event) =>
                    onTokenRecordFiltersChange?.({ keyword: event.target.value })
                  }
                  placeholder="邮箱 / 用户名 / IP / 路径 / 模型"
                  className={`${controlClassName} pl-11`}
                />
              </div>
            </div>

            <div>
              <SectionLabel title="用户 ID" />
              <input
                value={tokenRecordFilters?.userId}
                onChange={(event) =>
                  onTokenRecordFiltersChange?.({ userId: event.target.value })
                }
                placeholder="例如 12"
                className={controlClassName}
              />
            </div>

            <div>
              <SectionLabel title="模型名称" />
              <input
                value={tokenRecordFilters?.model}
                onChange={(event) =>
                  onTokenRecordFiltersChange?.({ model: event.target.value })
                }
                placeholder="例如 gpt-4o"
                className={controlClassName}
              />
            </div>

            <div>
              <SectionLabel title="开始时间" />
              <input
                type="datetime-local"
                value={tokenRecordFilters?.startAt}
                onChange={(event) =>
                  onTokenRecordFiltersChange?.({ startAt: event.target.value })
                }
                className={controlClassName}
              />
            </div>

            <div>
              <SectionLabel title="结束时间" />
              <input
                type="datetime-local"
                value={tokenRecordFilters?.endAt}
                onChange={(event) =>
                  onTokenRecordFiltersChange?.({ endAt: event.target.value })
                }
                className={controlClassName}
              />
            </div>

            <PageSizeSelect
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>
    </section>
  );
}
