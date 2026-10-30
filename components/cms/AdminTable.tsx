"use client";

import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  PencilLine,
} from "lucide-react";
import type {
  AdminCreditLogItem,
  AdminTabId,
  AdminTokenRecordItem,
  AdminUserSummary,
  AdminWalletSummary,
  PaginationMeta,
} from "@/interfaces/cms";
import {
  formatActionTypeLabel,
  formatCreditTypeLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  getActiveStatus,
  getAmountTone,
  getUserRole,
} from "./format";

interface AdminTableProps {
  activeTab: AdminTabId;
  users?: AdminUserSummary[];
  wallets?: AdminWalletSummary[];
  creditLogs?: AdminCreditLogItem[];
  tokenRecords?: AdminTokenRecordItem[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
  selectedDetailId: number | null;
  onSelectRow: (id: number) => void;
  onEditUser?: (user: AdminUserSummary) => void;
  onRechargeWallet?: (wallet: AdminWalletSummary) => void;
  onDeductWallet?: (wallet: AdminWalletSummary) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}
interface Row {
  id: number;
  name: string;
  email: string | null;
  userId: number;
  fields: { label: string; value: ReactNode }[];
  actions?: ReactNode;
}
const actionClass =
  "inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-teal-300";
const number = (value: number) => (
  <span className="font-medium tabular-nums">{formatNumber(value)}</span>
);
const badge = (value: { label: string; className: string }) => (
  <span
    className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${value.className}`}
  >
    {value.label}
  </span>
);

export default function AdminTable(props: AdminTableProps) {
  const {
    activeTab,
    pagination,
    loading,
    error,
    selectedDetailId,
    onSelectRow,
    onPageChange,
    onRetry,
  } = props;
  let rows: Row[] = [];
  if (activeTab === "users")
    rows = (props.users ?? []).map((user) => ({
      id: user.id,
      userId: user.id,
      name: user.username,
      email: user.email,
      fields: [
        {
          label: "状态 / 角色",
          value: (
            <div className="flex flex-wrap gap-1.5">
              {badge(getActiveStatus(user.is_active))}
              {badge(getUserRole(user))}
            </div>
          ),
        },
        { label: "算力余额", value: number(user.wallet_total_credits) },
        { label: "累计 Token", value: number(user.total_token_count) },
        { label: "注册时间", value: formatDateTime(user.created_at) },
      ],
      actions: (
        <button
          className={actionClass}
          onClick={() => props.onEditUser?.(user)}
        >
          <PencilLine size={14} />
          编辑
        </button>
      ),
    }));
  if (activeTab === "wallets")
    rows = (props.wallets ?? []).map((wallet) => ({
      id: wallet.user_id,
      userId: wallet.user_id,
      name: wallet.username,
      email: wallet.email,
      fields: [
        { label: "免费算力", value: number(wallet.free_credits) },
        { label: "付费算力", value: number(wallet.paid_credits) },
        {
          label: "总余额",
          value: (
            <span className="text-teal-700 dark:text-teal-300">
              {number(wallet.total_credits)}
            </span>
          ),
        },
        { label: "最近重置", value: formatDate(wallet.last_reset_date) },
      ],
      actions: (
        <>
          <button
            className={actionClass}
            onClick={() => props.onRechargeWallet?.(wallet)}
          >
            <ArrowUpRight size={14} />
            充值
          </button>
          <button
            className={`${actionClass} hover:border-rose-300 hover:text-rose-600`}
            onClick={() => props.onDeductWallet?.(wallet)}
            disabled={wallet.total_credits <= 0}
          >
            <ArrowDownLeft size={14} />
            扣减
          </button>
        </>
      ),
    }));
  if (activeTab === "creditLogs")
    rows = (props.creditLogs ?? []).map((log) => ({
      id: log.id,
      userId: log.user_id,
      name: log.username || `用户 #${log.user_id}`,
      email: log.email,
      fields: [
        {
          label: "变动算力",
          value: (
            <span
              className={`font-semibold tabular-nums ${getAmountTone(log.amount)}`}
            >
              {log.amount > 0 ? "+" : ""}
              {formatNumber(log.amount)}
            </span>
          ),
        },
        { label: "算力类型", value: formatCreditTypeLabel(log.credit_type) },
        { label: "变动来源", value: formatActionTypeLabel(log.action_type) },
        { label: "变动后余额", value: number(log.balance_after) },
        { label: "时间", value: formatDateTime(log.created_at) },
      ],
    }));
  if (activeTab === "tokenRecords")
    rows = (props.tokenRecords ?? []).map((record) => ({
      id: record.id,
      userId: record.user_id,
      name: record.username || `用户 #${record.user_id}`,
      email: record.email,
      fields: [
        { label: "模型", value: record.model || "—" },
        {
          label: "请求路径",
          value: (
            <span
              className="block max-w-56 truncate font-mono text-xs"
              title={record.request_path ?? undefined}
            >
              {record.request_path || "—"}
            </span>
          ),
        },
        { label: "Token 数", value: number(record.token_count) },
        {
          label: "来源 IP",
          value: <span className="font-mono text-xs">{record.ip}</span>,
        },
        { label: "调用时间", value: formatDateTime(record.created_at) },
      ],
    }));
  const identity = (row: Row) => (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
      >
        {row.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <button
          onClick={() => onSelectRow(row.id)}
          className="block max-w-full truncate text-left text-sm font-semibold text-slate-800 hover:text-teal-700 dark:text-slate-100"
        >
          {row.name}
        </button>
        <p
          className="mt-1 max-w-60 truncate text-xs text-slate-400"
          title={row.email ?? undefined}
        >
          {row.email || `ID ${row.userId}`}
        </p>
      </div>
    </div>
  );
  const actions = (row: Row) => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {row.actions}
      <button
        aria-label={`查看 ${row.name} 的详情`}
        onClick={() => onSelectRow(row.id)}
        className={actionClass}
      >
        <Eye size={14} />
        <span className="xl:hidden">详情</span>
      </button>
    </div>
  );

  return (
    <section
      aria-label="查询结果"
      aria-busy={loading}
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-medium">
          查询结果
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {pagination.total ? formatNumber(pagination.total) : "—"}
          </span>
        </div>
        <span className="text-xs text-slate-400">
          点击用户或详情查看完整信息
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <span>
            {rows.length ? "更新失败，当前显示上次结果。" : ""}
            {error}
          </span>
          <button
            onClick={onRetry}
            disabled={loading}
            className="min-h-10 shrink-0 font-semibold underline underline-offset-4"
          >
            重新加载
          </button>
        </div>
      )}
      {!rows.length ? (
        <div className="min-h-80">
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-5 text-center">
            <Inbox size={32} strokeWidth={1.2} className="text-slate-300" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {error ? "暂时无法加载数据" : "没有找到匹配的记录"}
            </p>
            <p className="text-xs text-slate-400">
              {error ? "请稍后重新加载" : "试试其他关键词，或重置筛选条件"}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {rows.map((row) => (
              <article
                key={row.id}
                className={`min-w-0 p-4 ${selectedDetailId === row.id ? "bg-teal-50/50 dark:bg-teal-500/5" : ""}`}
              >
                {identity(row)}
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
                  {row.fields.map((field) => (
                    <div key={field.label} className="min-w-0">
                      <dt className="text-xs text-slate-400">{field.label}</dt>
                      <dd className="mt-1.5 wrap-anywhere text-sm text-slate-700 dark:text-slate-200">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {actions(row)}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-950/30">
                <tr>
                  {[
                    "用户",
                    ...rows[0].fields.map((field) => field.label),
                    "操作",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap px-5 py-3 text-xs font-medium text-slate-500 last:text-right"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      selectedDetailId === row.id
                        ? "bg-teal-50/50 dark:bg-teal-500/5"
                        : "hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    }
                  >
                    <td className="px-5 py-4">{identity(row)}</td>
                    {row.fields.map((field) => (
                      <td
                        key={field.label}
                        className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300"
                      >
                        {field.value}
                      </td>
                    ))}
                    <td className="px-5 py-4">{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5 dark:border-slate-800">
        <p>
          共 {formatNumber(pagination.total)} 条 · 第 {pagination.page} /{" "}
          {Math.max(1, pagination.total_pages)} 页
        </p>
        <div className="flex gap-2">
          <button
            aria-label="上一页"
            disabled={loading || pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className={actionClass}
          >
            <ChevronLeft size={16} />
            上一页
          </button>
          <button
            aria-label="下一页"
            disabled={loading || pagination.page >= pagination.total_pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className={actionClass}
          >
            下一页
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
