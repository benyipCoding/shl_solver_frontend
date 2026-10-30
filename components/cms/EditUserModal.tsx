"use client";

import { useState } from "react";
import ModalFrame from "./ModalFrame";
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
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: AdminUserUpdateRequest) => Promise<void> | void;
}

const inputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-500/20";

export default function EditUserModal({
  open,
  user,
  submitting,
  error,
  onClose,
  onSubmit,
}: EditUserModalProps) {
  const [username, setUsername] = useState(() => user?.username || "");
  const [email, setEmail] = useState(() => user?.email || "");
  const [mobilePhone, setMobilePhone] = useState(
    () => user?.mobile_phone || "",
  );
  const [isActive, setIsActive] = useState(() =>
    String(user?.is_active ?? true),
  );
  const [isStaff, setIsStaff] = useState(() => String(user?.is_staff ?? false));
  const [isSuperuser, setIsSuperuser] = useState(() =>
    String(user?.is_superuser ?? false),
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
    <ModalFrame
      open={open}
      label="编辑用户资料"
      busy={submitting}
      onClose={onClose}
    >
      <div className="w-full bg-white p-5 sm:p-6 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              用户权限编辑
            </div>
            <h3 className="mt-3 wrap-anywhere text-xl font-semibold text-slate-900 dark:text-white">
              编辑 {user.username}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              更新账号资料、启用状态与管理权限。
            </p>
          </div>

          <button
            type="button"
            aria-label="关闭编辑"
            disabled={submitting}
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X aria-label="关闭编辑" className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {error}
          </p>
        )}
        <form
          className="mt-6 grid gap-4 md:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div>
            <label
              htmlFor="edit-username"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
            >
              用户名
            </label>
            <input
              required
              id="edit-username"
              disabled={submitting}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="edit-email"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
            >
              邮箱
            </label>
            <input
              required
              type="email"
              id="edit-email"
              disabled={submitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="edit-mobilePhone"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
            >
              手机号
            </label>
            <input
              id="edit-mobilePhone"
              disabled={submitting}
              value={mobilePhone}
              onChange={(event) => setMobilePhone(event.target.value)}
              placeholder="可选，留空即可清除"
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="edit-isActive"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
            >
              账号状态
            </label>
            <select
              id="edit-isActive"
              disabled={submitting}
              value={isActive}
              onChange={(event) => setIsActive(event.target.value)}
              className={inputClassName}
            >
              <option value="true">正常</option>
              <option value="false">禁用</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="edit-isStaff"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
            >
              工作人员权限
            </label>
            <select
              id="edit-isStaff"
              disabled={submitting}
              value={isStaff}
              onChange={(event) => setIsStaff(event.target.value)}
              className={inputClassName}
            >
              <option value="true">开启</option>
              <option value="false">关闭</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="edit-isSuperuser"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
            >
              超级管理员权限
            </label>
            <select
              id="edit-isSuperuser"
              disabled={submitting}
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
              disabled={submitting}
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
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
    </ModalFrame>
  );
}
