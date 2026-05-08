"use client";

import { Eye, PencilLine, Plus, RefreshCw } from "lucide-react";
import {
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
  truncateText,
} from "@/components/cms/format";

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
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

const tableHeadClassName =
  "whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400";

const tableCellClassName =
  "px-5 py-4 text-sm text-slate-700 dark:text-slate-100";

const actionButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

const stopPropagation = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.stopPropagation();
};

const PaginationBar = ({
  pagination,
  onPageChange,
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}) => {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:text-slate-400">
      <p>
        第 {pagination.page} / {pagination.total_pages} 页，共{" "}
        {formatNumber(pagination.total)} 条记录
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={pagination.page <= 1}
          className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          上一页
        </button>
        <button
          type="button"
          onClick={() =>
            onPageChange(Math.min(pagination.total_pages, pagination.page + 1))
          }
          disabled={pagination.page >= pagination.total_pages}
          className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          下一页
        </button>
      </div>
    </div>
  );
};

const LoadingState = () => {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800"
        />
      ))}
    </div>
  );
};

const ErrorState = ({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        拉取失败
      </div>
      <p className="max-w-lg text-sm text-slate-500 dark:text-slate-400">
        {error}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
      >
        <RefreshCw className="h-4 w-4" />
        重新获取
      </button>
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => {
  return (
    <div className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
      当前筛选条件下没有 {label} 数据。
    </div>
  );
};

export default function AdminTable({
  activeTab,
  users,
  wallets,
  creditLogs,
  tokenRecords,
  pagination,
  loading,
  error,
  selectedDetailId,
  onSelectRow,
  onEditUser,
  onRechargeWallet,
  onPageChange,
  onRetry,
}: AdminTableProps) {
  const hasPagination = pagination.total_pages > 1 || pagination.total > 0;

  const renderContent = () => {
    if (loading) {
      return <LoadingState />;
    }

    if (error) {
      return <ErrorState error={error} onRetry={onRetry} />;
    }

    if (activeTab === "users" && (!users || users.length === 0)) {
      return <EmptyState label="用户" />;
    }

    if (activeTab === "wallets" && (!wallets || wallets.length === 0)) {
      return <EmptyState label="钱包" />;
    }

    if (
      activeTab === "creditLogs" &&
      (!creditLogs || creditLogs.length === 0)
    ) {
      return <EmptyState label="消费记录" />;
    }

    if (
      activeTab === "tokenRecords" &&
      (!tokenRecords || tokenRecords.length === 0)
    ) {
      return <EmptyState label="Token 记录" />;
    }

    return (
      <>
        <div className="grid gap-3 p-4 md:hidden">
          {activeTab === "users" &&
            users?.map((user) => {
              const role = getUserRole(user);
              const status = getActiveStatus(user.is_active);

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSelectRow(user.id)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    selectedDetailId === user.id
                      ? "border-sky-300 bg-sky-50/80 shadow-sm dark:border-sky-500/40 dark:bg-sky-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {user.username}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {user.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          stopPropagation(event);
                          onEditUser?.(user);
                        }}
                        className={actionButtonClassName}
                      >
                        <PencilLine className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          stopPropagation(event);
                          onSelectRow(user.id);
                        }}
                        className={actionButtonClassName}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${role.className}`}
                    >
                      {role.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <div>
                      <p>钱包总额</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {formatNumber(user.wallet_total_credits)}
                      </p>
                    </div>
                    <div>
                      <p>累计 Token</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {formatNumber(user.total_token_count)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

          {activeTab === "wallets" &&
            wallets?.map((wallet) => (
              <button
                key={wallet.user_id}
                type="button"
                onClick={() => onSelectRow(wallet.user_id)}
                className={`rounded-3xl border p-4 text-left transition ${
                  selectedDetailId === wallet.user_id
                    ? "border-emerald-300 bg-emerald-50/80 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {wallet.username}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {wallet.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        stopPropagation(event);
                        onRechargeWallet?.(wallet);
                      }}
                      className={actionButtonClassName}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        stopPropagation(event);
                        onSelectRow(wallet.user_id);
                      }}
                      className={actionButtonClassName}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <div>
                    <p>免费</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {formatNumber(wallet.free_credits)}
                    </p>
                  </div>
                  <div>
                    <p>付费</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {formatNumber(wallet.paid_credits)}
                    </p>
                  </div>
                  <div>
                    <p>总额</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {formatNumber(wallet.total_credits)}
                    </p>
                  </div>
                </div>
              </button>
            ))}

          {activeTab === "creditLogs" &&
            creditLogs?.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => onSelectRow(log.id)}
                className={`rounded-3xl border p-4 text-left transition ${
                  selectedDetailId === log.id
                    ? "border-amber-300 bg-amber-50/80 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {log.username || `用户 #${log.user_id}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {formatActionTypeLabel(log.action_type)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      stopPropagation(event);
                      onSelectRow(log.id);
                    }}
                    className={actionButtonClassName}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <div>
                    <p>变动额度</p>
                    <p
                      className={`mt-1 font-semibold ${getAmountTone(log.amount)}`}
                    >
                      {log.amount > 0 ? "+" : ""}
                      {formatNumber(log.amount)}
                    </p>
                  </div>
                  <div>
                    <p>变动后余额</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {formatNumber(log.balance_after)}
                    </p>
                  </div>
                </div>
              </button>
            ))}

          {activeTab === "tokenRecords" &&
            tokenRecords?.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelectRow(record.id)}
                className={`rounded-3xl border p-4 text-left transition ${
                  selectedDetailId === record.id
                    ? "border-violet-300 bg-violet-50/80 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {record.username || `用户 #${record.user_id}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {record.model || "未记录模型"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      stopPropagation(event);
                      onSelectRow(record.id);
                    }}
                    className={actionButtonClassName}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <div>
                    <p>Token 数</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {formatNumber(record.token_count)}
                    </p>
                  </div>
                  <div>
                    <p>来源 IP</p>
                    <p className="mt-1 font-mono text-[13px] text-slate-900 dark:text-white">
                      {record.ip}
                    </p>
                  </div>
                </div>
              </button>
            ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          {activeTab === "users" && (
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={tableHeadClassName}>用户</th>
                  <th className={tableHeadClassName}>状态 / 角色</th>
                  <th className={tableHeadClassName}>钱包总额</th>
                  <th className={tableHeadClassName}>累计 Token</th>
                  <th className={tableHeadClassName}>创建时间</th>
                  <th className={`${tableHeadClassName} text-right`}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => {
                  const role = getUserRole(user);
                  const status = getActiveStatus(user.is_active);

                  return (
                    <tr
                      key={user.id}
                      onClick={() => onSelectRow(user.id)}
                      className={`cursor-pointer transition ${
                        selectedDetailId === user.id
                          ? "bg-sky-50/80 dark:bg-sky-500/10"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <td className={tableCellClassName}>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {user.username}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {user.email}
                        </p>
                      </td>
                      <td className={tableCellClassName}>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${role.className}`}
                          >
                            {role.label}
                          </span>
                        </div>
                      </td>
                      <td className={tableCellClassName}>
                        {formatNumber(user.wallet_total_credits)}
                      </td>
                      <td className={tableCellClassName}>
                        {formatNumber(user.total_token_count)}
                      </td>
                      <td className={tableCellClassName}>
                        {formatDateTime(user.created_at)}
                      </td>
                      <td className={`${tableCellClassName} text-right`}>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              stopPropagation(event);
                              onEditUser?.(user);
                            }}
                            className={actionButtonClassName}
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              stopPropagation(event);
                              onSelectRow(user.id);
                            }}
                            className={actionButtonClassName}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === "wallets" && (
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={tableHeadClassName}>用户</th>
                  <th className={tableHeadClassName}>免费点数</th>
                  <th className={tableHeadClassName}>付费点数</th>
                  <th className={tableHeadClassName}>钱包总额</th>
                  <th className={tableHeadClassName}>最近重置</th>
                  <th className={`${tableHeadClassName} text-right`}>操作</th>
                </tr>
              </thead>
              <tbody>
                {wallets?.map((wallet) => (
                  <tr
                    key={wallet.user_id}
                    onClick={() => onSelectRow(wallet.user_id)}
                    className={`cursor-pointer transition ${
                      selectedDetailId === wallet.user_id
                        ? "bg-emerald-50/80 dark:bg-emerald-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <td className={tableCellClassName}>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {wallet.username}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {wallet.email}
                      </p>
                    </td>
                    <td className={tableCellClassName}>
                      {formatNumber(wallet.free_credits)}
                    </td>
                    <td className={tableCellClassName}>
                      {formatNumber(wallet.paid_credits)}
                    </td>
                    <td className={tableCellClassName}>
                      {formatNumber(wallet.total_credits)}
                    </td>
                    <td className={tableCellClassName}>
                      {formatDate(wallet.last_reset_date)}
                    </td>
                    <td className={`${tableCellClassName} text-right`}>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            stopPropagation(event);
                            onRechargeWallet?.(wallet);
                          }}
                          className={actionButtonClassName}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            stopPropagation(event);
                            onSelectRow(wallet.user_id);
                          }}
                          className={actionButtonClassName}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "creditLogs" && (
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={tableHeadClassName}>用户</th>
                  <th className={tableHeadClassName}>变动额度</th>
                  <th className={tableHeadClassName}>点数类型</th>
                  <th className={tableHeadClassName}>动作类型</th>
                  <th className={tableHeadClassName}>余额</th>
                  <th className={tableHeadClassName}>时间</th>
                  <th className={`${tableHeadClassName} text-right`}>查看</th>
                </tr>
              </thead>
              <tbody>
                {creditLogs?.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => onSelectRow(log.id)}
                    className={`cursor-pointer transition ${
                      selectedDetailId === log.id
                        ? "bg-amber-50/80 dark:bg-amber-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <td className={tableCellClassName}>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {log.username || `用户 #${log.user_id}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {log.email || "-"}
                      </p>
                    </td>
                    <td
                      className={`${tableCellClassName} font-semibold ${getAmountTone(log.amount)}`}
                    >
                      {log.amount > 0 ? "+" : ""}
                      {formatNumber(log.amount)}
                    </td>
                    <td className={tableCellClassName}>
                      {formatCreditTypeLabel(log.credit_type)}
                    </td>
                    <td className={tableCellClassName}>
                      {formatActionTypeLabel(log.action_type)}
                    </td>
                    <td className={tableCellClassName}>
                      {formatNumber(log.balance_after)}
                    </td>
                    <td className={tableCellClassName}>
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className={`${tableCellClassName} text-right`}>
                      <button
                        type="button"
                        onClick={(event) => {
                          stopPropagation(event);
                          onSelectRow(log.id);
                        }}
                        className={actionButtonClassName}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "tokenRecords" && (
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={tableHeadClassName}>用户</th>
                  <th className={tableHeadClassName}>模型</th>
                  <th className={tableHeadClassName}>请求路径</th>
                  <th className={tableHeadClassName}>Token 数</th>
                  <th className={tableHeadClassName}>来源 IP</th>
                  <th className={tableHeadClassName}>时间</th>
                  <th className={`${tableHeadClassName} text-right`}>查看</th>
                </tr>
              </thead>
              <tbody>
                {tokenRecords?.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => onSelectRow(record.id)}
                    className={`cursor-pointer transition ${
                      selectedDetailId === record.id
                        ? "bg-violet-50/80 dark:bg-violet-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <td className={tableCellClassName}>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {record.username || `用户 #${record.user_id}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.email || "-"}
                      </p>
                    </td>
                    <td className={tableCellClassName}>
                      {record.model || "-"}
                    </td>
                    <td className={tableCellClassName}>
                      <span className="font-mono text-[13px]">
                        {truncateText(record.request_path, 40)}
                      </span>
                    </td>
                    <td className={tableCellClassName}>
                      {formatNumber(record.token_count)}
                    </td>
                    <td
                      className={`${tableCellClassName} font-mono text-[13px]`}
                    >
                      {record.ip}
                    </td>
                    <td className={tableCellClassName}>
                      {formatDateTime(record.created_at)}
                    </td>
                    <td className={`${tableCellClassName} text-right`}>
                      <button
                        type="button"
                        onClick={(event) => {
                          stopPropagation(event);
                          onSelectRow(record.id);
                        }}
                        className={actionButtonClassName}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.32)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
      {renderContent()}
      {hasPagination && !loading && !error && (
        <PaginationBar pagination={pagination} onPageChange={onPageChange} />
      )}
    </section>
  );
}
