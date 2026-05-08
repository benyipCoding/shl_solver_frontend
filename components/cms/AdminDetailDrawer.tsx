"use client";

import { Edit2, LoaderCircle, NotebookText, Plus, X } from "lucide-react";
import {
  AdminDetailState,
  AdminUserDetail,
  AdminUserSummary,
  AdminWalletSummary,
  AdminCreditLogItem,
  AdminTokenRecordItem,
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
} from "@/components/cms/format";

interface AdminDetailDrawerProps {
  state: AdminDetailState;
  onClose: () => void;
  onEditUser: (user: AdminUserSummary | AdminUserDetail) => void;
  onRechargeWallet: (wallet: AdminWalletSummary) => void;
}

const DetailItem = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-sm text-slate-700 dark:text-slate-100 ${
          mono ? "font-mono text-[13px]" : "font-medium"
        }`}
      >
        {value}
      </p>
    </div>
  );
};

export default function AdminDetailDrawer({
  state,
  onClose,
  onEditUser,
  onRechargeWallet,
}: AdminDetailDrawerProps) {
  if (!state.tab) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-70 bg-slate-950/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-white/70 bg-white/95 p-5 shadow-[0_24px_100px_-38px_rgba(15,23,42,0.5)] backdrop-blur md:p-6 dark:border-slate-800 dark:bg-slate-900/95"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <NotebookText className="h-3.5 w-3.5" />
              明细面板
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              {state.tab === "users" && "用户详情"}
              {state.tab === "wallets" && "钱包详情"}
              {state.tab === "creditLogs" && "消费记录详情"}
              {state.tab === "tokenRecords" && "Token 记录详情"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              选中列表数据后按需拉取详情接口，方便快速核对后台状态。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state.loading && (
          <div className="mt-10 flex min-h-80 items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              正在拉取详情数据...
            </div>
          </div>
        )}

        {!state.loading && !state.data && (
          <div className="mt-10 rounded-[28px] border border-dashed border-slate-200 bg-slate-50/90 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
            当前没有可展示的详情数据。
          </div>
        )}

        {!state.loading &&
          state.data &&
          state.tab === "users" &&
          (() => {
            const user = state.data as AdminUserDetail;
            const role = getUserRole(user);
            const status = getActiveStatus(user.is_active);

            return (
              <div className="mt-6 space-y-5">
                <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                        {user.username}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {user.email}
                      </p>
                    </div>
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
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onEditUser(user)}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                    >
                      <Edit2 className="h-4 w-4" />
                      编辑用户
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem label="用户 ID" value={String(user.id)} />
                  <DetailItem label="手机号" value={user.mobile_phone || "-"} />
                  <DetailItem
                    label="免费点数"
                    value={formatNumber(user.free_credits)}
                  />
                  <DetailItem
                    label="付费点数"
                    value={formatNumber(user.paid_credits)}
                  />
                  <DetailItem
                    label="总算力"
                    value={formatNumber(user.wallet_total_credits)}
                  />
                  <DetailItem
                    label="累计 Token"
                    value={formatNumber(user.total_token_count)}
                  />
                  <DetailItem
                    label="消费流水数"
                    value={formatNumber(user.credit_log_count)}
                  />
                  <DetailItem
                    label="Token 记录数"
                    value={formatNumber(user.token_record_count)}
                  />
                  <DetailItem
                    label="创建时间"
                    value={formatDateTime(user.created_at)}
                  />
                  <DetailItem
                    label="更新时间"
                    value={formatDateTime(user.updated_at)}
                  />
                </div>
              </div>
            );
          })()}

        {!state.loading &&
          state.data &&
          state.tab === "wallets" &&
          (() => {
            const wallet = state.data as AdminWalletSummary;

            return (
              <div className="mt-6 space-y-5">
                <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                        {wallet.username}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {wallet.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRechargeWallet(wallet)}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
                    >
                      <Plus className="h-4 w-4" />
                      充值钱包
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem
                    label="钱包 ID"
                    value={wallet.wallet_id ? String(wallet.wallet_id) : "-"}
                  />
                  <DetailItem label="用户 ID" value={String(wallet.user_id)} />
                  <DetailItem
                    label="手机号"
                    value={wallet.mobile_phone || "-"}
                  />
                  <DetailItem
                    label="免费点数"
                    value={formatNumber(wallet.free_credits)}
                  />
                  <DetailItem
                    label="付费点数"
                    value={formatNumber(wallet.paid_credits)}
                  />
                  <DetailItem
                    label="钱包总额"
                    value={formatNumber(wallet.total_credits)}
                  />
                  <DetailItem
                    label="最近重置"
                    value={formatDate(wallet.last_reset_date)}
                  />
                  <DetailItem
                    label="创建时间"
                    value={formatDateTime(wallet.wallet_created_at)}
                  />
                  <DetailItem
                    label="更新时间"
                    value={formatDateTime(wallet.wallet_updated_at)}
                  />
                </div>
              </div>
            );
          })()}

        {!state.loading &&
          state.data &&
          state.tab === "creditLogs" &&
          (() => {
            const log = state.data as AdminCreditLogItem;

            return (
              <div className="mt-6 space-y-5">
                <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                        流水 #{log.id}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {log.username || "未知用户"} / {log.email || "-"}
                      </p>
                    </div>
                    <span
                      className={`text-lg font-semibold ${getAmountTone(log.amount)}`}
                    >
                      {log.amount > 0 ? "+" : ""}
                      {formatNumber(log.amount)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem label="用户 ID" value={String(log.user_id)} />
                  <DetailItem
                    label="点数类型"
                    value={formatCreditTypeLabel(log.credit_type)}
                  />
                  <DetailItem
                    label="动作类型"
                    value={formatActionTypeLabel(log.action_type)}
                  />
                  <DetailItem
                    label="变动后余额"
                    value={formatNumber(log.balance_after)}
                  />
                  <DetailItem
                    label="创建时间"
                    value={formatDateTime(log.created_at)}
                  />
                  <DetailItem
                    label="更新时间"
                    value={formatDateTime(log.updated_at)}
                  />
                </div>
              </div>
            );
          })()}

        {!state.loading &&
          state.data &&
          state.tab === "tokenRecords" &&
          (() => {
            const record = state.data as AdminTokenRecordItem;

            return (
              <div className="mt-6 space-y-5">
                <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                        Token 记录 #{record.id}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {record.username || "未知用户"} / {record.email || "-"}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      {formatNumber(record.token_count)} tokens
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem label="用户 ID" value={String(record.user_id)} />
                  <DetailItem label="模型名称" value={record.model || "-"} />
                  <DetailItem
                    label="请求路径"
                    value={record.request_path || "-"}
                    mono
                  />
                  <DetailItem label="来源 IP" value={record.ip} mono />
                  <DetailItem
                    label="创建时间"
                    value={formatDateTime(record.created_at)}
                  />
                  <DetailItem
                    label="更新时间"
                    value={formatDateTime(record.updated_at)}
                  />
                </div>
              </div>
            );
          })()}
      </aside>
    </div>
  );
}
