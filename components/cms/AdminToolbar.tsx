"use client";

import { useState, type ReactNode } from "react";
import {
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "./config";
import { actionTypeOptions } from "./api";
import { formatActionTypeLabel } from "./format";
import type {
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
  "h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
const buttonClassName =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      {children}
    </label>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const filters =
    activeTab === "users"
      ? usersFilters
      : activeTab === "wallets"
        ? walletsFilters
        : activeTab === "creditLogs"
          ? creditLogFilters
          : tokenRecordFilters;
  const count = Object.entries(filters ?? {}).filter(
    ([key, value]) =>
      key !== "keyword" && value !== "all" && value !== "" && value !== false,
  ).length;
  // The shared list keeps all filter fields; count only those used by this view.
  const relevantKeys =
    activeTab === "users"
      ? ["isActive", "isStaff", "isSuperuser"]
      : activeTab === "wallets"
        ? ["onlyWithWallet"]
        : activeTab === "creditLogs"
          ? ["userId", "creditType", "actionType", "startAt", "endAt"]
          : ["userId", "model", "startAt", "endAt"];
  const activeCount = count
    ? Object.entries(filters ?? {}).filter(
        ([key, value]) =>
          relevantKeys.includes(key) &&
          value !== "all" &&
          value !== "" &&
          value !== false,
      ).length
    : 0;
  const changeKeyword = (keyword: string) => {
    if (activeTab === "users") onUsersFiltersChange?.({ keyword });
    if (activeTab === "wallets") onWalletFiltersChange?.({ keyword });
    if (activeTab === "creditLogs") onCreditLogFiltersChange?.({ keyword });
    if (activeTab === "tokenRecords") onTokenRecordFiltersChange?.({ keyword });
  };
  const logFilters =
    activeTab === "creditLogs" ? creditLogFilters : tokenRecordFilters;
  const changeDates = (updates: {
    startAt?: string;
    endAt?: string;
    userId?: string;
  }) => {
    if (activeTab === "creditLogs") onCreditLogFiltersChange?.(updates);
    else onTokenRecordFiltersChange?.(updates);
  };
  return (
    <section
      aria-label="搜索和筛选"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative w-full sm:w-auto sm:min-w-60 sm:flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400"
          />
          <input
            aria-label="搜索关键词"
            type="search"
            value={filters?.keyword ?? ""}
            onChange={(event) => changeKeyword(event.target.value)}
            placeholder={
              activeTab === "tokenRecords"
                ? "搜索用户、模型、IP 或路径"
                : "搜索用户名、邮箱或手机号"
            }
            className={`${controlClassName} pl-10`}
          />
        </div>
        <button
          aria-expanded={expanded}
          aria-controls="cms-filters"
          onClick={() => setExpanded(!expanded)}
          className={`${buttonClassName} ${activeCount ? "text-teal-700 dark:text-teal-300" : ""}`}
        >
          <SlidersHorizontal size={16} />
          筛选
          {activeCount > 0 && (
            <span className="rounded bg-teal-50 px-1.5 text-xs text-teal-700 dark:bg-teal-900 dark:text-teal-200">
              {activeCount}
            </span>
          )}
          <ChevronDown size={14} className={expanded ? "rotate-180" : ""} />
        </button>
        <button
          onClick={onReset}
          aria-label="重置筛选"
          title="重置筛选"
          className={buttonClassName}
        >
          <RotateCcw size={16} />
          <span className="hidden sm:inline">重置</span>
        </button>
        <button
          disabled={isRefreshing}
          onClick={onRefresh}
          className={`${buttonClassName} ml-auto bg-slate-50 dark:bg-slate-800`}
        >
          <RefreshCw size={16} />
          刷新
        </button>
      </div>
      {expanded && (
        <div
          id="cms-filters"
          className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800"
        >
          {activeTab === "users" && (
            <>
              <Field label="账号状态">
                <select
                  className={controlClassName}
                  value={usersFilters?.isActive}
                  onChange={(event) =>
                    onUsersFiltersChange?.({
                      isActive: event.target.value as UserFilters["isActive"],
                    })
                  }
                >
                  <option value="all">全部状态</option>
                  <option value="true">正常</option>
                  <option value="false">禁用</option>
                </select>
              </Field>
              <Field label="员工权限">
                <select
                  className={controlClassName}
                  value={usersFilters?.isStaff}
                  onChange={(event) =>
                    onUsersFiltersChange?.({
                      isStaff: event.target.value as UserFilters["isStaff"],
                    })
                  }
                >
                  <option value="all">全部</option>
                  <option value="true">仅工作人员</option>
                  <option value="false">排除工作人员</option>
                </select>
              </Field>
              <Field label="管理员权限">
                <select
                  className={controlClassName}
                  value={usersFilters?.isSuperuser}
                  onChange={(event) =>
                    onUsersFiltersChange?.({
                      isSuperuser: event.target
                        .value as UserFilters["isSuperuser"],
                    })
                  }
                >
                  <option value="all">全部</option>
                  <option value="true">仅超级管理员</option>
                  <option value="false">排除超级管理员</option>
                </select>
              </Field>
            </>
          )}
          {activeTab === "wallets" && (
            <label className="flex min-h-11 items-center gap-3 self-end text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-700"
                checked={walletsFilters?.onlyWithWallet ?? false}
                onChange={(event) =>
                  onWalletFiltersChange?.({
                    onlyWithWallet: event.target.checked,
                  })
                }
              />
              仅显示已开通钱包
            </label>
          )}
          {(activeTab === "creditLogs" || activeTab === "tokenRecords") && (
            <>
              <Field label="用户 ID">
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={controlClassName}
                  value={logFilters?.userId ?? ""}
                  onChange={(event) =>
                    changeDates({ userId: event.target.value })
                  }
                  placeholder="全部用户"
                />
              </Field>
              {activeTab === "creditLogs" ? (
                <>
                  <Field label="算力类型">
                    <select
                      className={controlClassName}
                      value={creditLogFilters?.creditType}
                      onChange={(event) =>
                        onCreditLogFiltersChange?.({
                          creditType: event.target
                            .value as CreditLogFilters["creditType"],
                        })
                      }
                    >
                      <option value="all">全部类型</option>
                      <option value="FREE">免费算力</option>
                      <option value="PAID">付费算力</option>
                    </select>
                  </Field>
                  <Field label="变动来源">
                    <select
                      className={controlClassName}
                      value={creditLogFilters?.actionType}
                      onChange={(event) =>
                        onCreditLogFiltersChange?.({
                          actionType: event.target
                            .value as CreditLogFilters["actionType"],
                        })
                      }
                    >
                      <option value="all">全部来源</option>
                      {actionTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {formatActionTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="模型名称">
                  <input
                    className={controlClassName}
                    value={tokenRecordFilters?.model ?? ""}
                    onChange={(event) =>
                      onTokenRecordFiltersChange?.({
                        model: event.target.value,
                      })
                    }
                    placeholder="精确匹配模型名称"
                  />
                </Field>
              )}
              <Field label="开始时间">
                <input
                  type="datetime-local"
                  max={logFilters?.endAt || undefined}
                  className={controlClassName}
                  value={logFilters?.startAt ?? ""}
                  onChange={(event) =>
                    changeDates({ startAt: event.target.value })
                  }
                />
              </Field>
              <Field label="结束时间">
                <input
                  type="datetime-local"
                  min={logFilters?.startAt || undefined}
                  className={controlClassName}
                  value={logFilters?.endAt ?? ""}
                  onChange={(event) =>
                    changeDates({ endAt: event.target.value })
                  }
                />
              </Field>
            </>
          )}
          <Field label="每页条数">
            <select
              className={controlClassName}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} 条
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </section>
  );
}
