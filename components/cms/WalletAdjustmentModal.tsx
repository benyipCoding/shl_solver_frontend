"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, X } from "lucide-react";
import type { AdminWalletSummary, CreditType } from "@/interfaces/cms";
import { formatNumber } from "./format";

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export default function WalletAdjustmentModal({
  wallet,
  mode,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  wallet: AdminWalletSummary;
  mode: "recharge" | "deduct";
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (
    amount: number,
    creditType: CreditType,
    reason: string,
  ) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState("");
  const [creditType, setCreditType] = useState<CreditType>(
    wallet.paid_credits > 0 ? "PAID" : "FREE",
  );
  const [reason, setReason] = useState("");
  const deduct = mode === "deduct";
  const label = deduct ? "扣减" : "充值";
  const available =
    creditType === "FREE" ? wallet.free_credits : wallet.paid_credits;
  const numeric = Number(amount);
  const validAmount =
    Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 2147483647;
  const exceeds = deduct && validAmount && numeric > available;
  const valid =
    validAmount && !exceeds && (!deduct || reason.trim().length > 0);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="wallet-adjustment-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <form
        className="flex max-h-[calc(100dvh-2rem)] flex-col"
        onSubmit={async (event) => {
          event.preventDefault();
          if (valid && !submitting)
            await onSubmit(
              numeric,
              deduct ? creditType : "PAID",
              reason.trim(),
            );
        }}
      >
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${deduct ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" : "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"}`}
            >
              {deduct ? (
                <ArrowDownLeft size={23} />
              ) : (
                <ArrowUpRight size={23} />
              )}
            </div>
            <button
              type="button"
              aria-label="关闭钱包操作"
              disabled={submitting}
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </div>
          <h2
            id="wallet-adjustment-title"
            className="mt-4 text-xl font-semibold"
          >
            {deduct ? "扣减用户算力" : "充值付费算力"}
          </h2>
          <p className="mt-2 wrap-anywhere text-sm text-slate-500">
            {wallet.username} · ID {wallet.user_id}
            <span className="mt-1 block text-xs">{wallet.email}</span>
          </p>
          <dl className="my-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
            <div>
              <dt className="text-xs text-slate-400">免费算力</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {formatNumber(wallet.free_credits)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">付费算力</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {formatNumber(wallet.paid_credits)}
              </dd>
            </div>
          </dl>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {error}
            </p>
          )}
          <fieldset disabled={submitting} className="space-y-4">
            {deduct && (
              <label className="block text-sm font-medium">
                扣减类型
                <select
                  className={`${inputClass} mt-2`}
                  value={creditType}
                  onChange={(event) =>
                    setCreditType(event.target.value as CreditType)
                  }
                >
                  <option value="PAID">付费算力</option>
                  <option value="FREE">免费算力</option>
                </select>
              </label>
            )}
            <label className="block text-sm font-medium">
              {label}数量
              <input
                autoFocus
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={deduct ? available : 2147483647}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="输入正整数"
                className={`${inputClass} mt-2`}
                aria-describedby="adjustment-hint"
              />
            </label>
            <p
              id="adjustment-hint"
              className={`text-xs ${exceeds ? "text-rose-600" : "text-slate-400"}`}
            >
              {deduct
                ? `所选类型最多可扣减 ${formatNumber(available)} 点，不影响另一类算力。`
                : "充值的算力将计入付费余额。"}
            </p>
            {deduct && (
              <label className="block text-sm font-medium">
                扣减原因
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="例如：撤回重复发放的活动算力"
                  className={`${inputClass} mt-2 h-auto resize-y py-3`}
                />
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  原因和操作人将保存在算力流水中。
                </span>
              </label>
            )}
          </fieldset>
          <div
            aria-live="polite"
            className="my-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
          >
            <span className="text-slate-500">预计操作后总余额</span>
            <strong className="text-lg tabular-nums">
              {validAmount && !exceeds
                ? formatNumber(
                    wallet.total_credits + (deduct ? -numeric : numeric),
                  )
                : "—"}
            </strong>
          </div>
          {deduct && (
            <p className="mb-4 text-xs leading-5 text-slate-500">
              提交后立即生效，请核对用户与数量。实际可扣余额以提交时为准。
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-12 flex-1 rounded-xl border border-slate-200 text-sm disabled:opacity-50 dark:border-slate-700"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!valid || submitting}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${deduct ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-700 hover:bg-teal-800"}`}
          >
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            {submitting ? "正在提交…" : `确认${label}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
