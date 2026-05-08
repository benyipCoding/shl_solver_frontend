"use client";

import { useState } from "react";
import { LoaderCircle, Save, ShieldCheck, X } from "lucide-react";
import {
  AdminUserDetail,
  AdminUserSummary,
  AdminUserUpdateRequest,
} from "@/interfaces/cms";

interface EditUserModalProps {
  open: boolean;
  user: AdminUserSummary | AdminUserDetail | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: AdminUserUpdateRequest) => Promise<void> | void;
}

const inputClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-500/20";

export default function EditUserModal({
  open,
  user,
  submitting,
  onClose,
  onSubmit,
}: EditUserModalProps) {
  const [username, setUsername] = useState(() => user?.username || "");
  const [email, setEmail] = useState(() => user?.email || "");
  const [mobilePhone, setMobilePhone] = useState(
    () => user?.mobile_phone || ""
  );
  const [isActive, setIsActive] = useState(() =>
    String(user?.is_active ?? true)
  );
  const [isStaff, setIsStaff] = useState(() => String(user?.is_staff ?? false));
  const [isSuperuser, setIsSuperuser] = useState(() =>
    String(user?.is_superuser ?? false)
  );

  if (!open || !user) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      username: username.trim(),
      email: email.trim(),
      mobile_phone: mobilePhone.trim() || null,
      is_active: isActive === "true",
      is_staff: isStaff === "true",
      is_superuser: isSuperuser === "true",
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/70 bg-white p-6 shadow-[0_30px_100px_-30px_rgba(15,23,42,0.55)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              用户权限编辑
            </div>
            <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
              编辑 {user.username}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              直接调用 Admin 用户更新接口，修改资料与后台权限字段。
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

        <form
          className="mt-6 grid gap-4 md:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              用户名
            </label>
            <input
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              邮箱
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              手机号
            </label>
            <input
              value={mobilePhone}
              onChange={(event) => setMobilePhone(event.target.value)}
              placeholder="为空则写入 null"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              账号状态
            </label>
            <select
              value={isActive}
              onChange={(event) => setIsActive(event.target.value)}
              className={inputClassName}
            >
              <option value="true">正常</option>
              <option value="false">禁用</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Staff 权限
            </label>
            <select
              value={isStaff}
              onChange={(event) => setIsStaff(event.target.value)}
              className={inputClassName}
            >
              <option value="true">开启</option>
              <option value="false">关闭</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              超级管理员权限
            </label>
            <select
              value={isSuperuser}
              onChange={(event) => setIsSuperuser(event.target.value)}
              className={inputClassName}
            >
              <option value="true">开启</option>
              <option value="false">关闭</option>
            </select>
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 md:col-span-2">
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
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              保存修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
