"use client";

import { useState } from "react";
import { Coins, LoaderCircle, Plus, X } from "lucide-react";
import { AdminWalletSummary } from "@/interfaces/cms";
import { formatNumber } from "@/components/cms/format";

interface RechargeWalletModalProps {
  open: boolean;
  wallet: AdminWalletSummary | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void> | void;
}

const inputClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20";

export default function RechargeWalletModal({
  open,
  wallet,
  submitting,
  onClose,
  onSubmit,
}: RechargeWalletModalProps) {
  const [amount, setAmount] = useState("");

  if (!open || !wallet) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return;
    }

    await onSubmit(numericAmount);
  };

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_30px_100px_-30px_rgba(15,23,42,0.55)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <Coins className="h-3.5 w-3.5" />
              钱包充值
            </div>
            <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
              给 {wallet.username} 充值付费算力
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              当前总余额 {formatNumber(wallet.total_credits)}，将直接写入 Admin
              钱包充值接口。
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

        <div className="mt-6 grid gap-3 rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 md:grid-cols-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              免费点数
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              {formatNumber(wallet.free_credits)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              付费点数
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              {formatNumber(wallet.paid_credits)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              用户 ID
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              {wallet.user_id}
            </p>
          </div>
        </div>

        <form className="mt-6" onSubmit={handleSubmit}>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            本次充值点数
          </label>
          <input
            required
            min={1}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="例如 500"
            className={inputClassName}
          />

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              确认充值
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
