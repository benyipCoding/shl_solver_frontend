"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  CheckCircle2,
  ArrowLeftCircle,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import ValidatedInput from "@/components/auth/ValidatedInput";
import toast from "react-hot-toast";
import { ThemeToggle } from "@/components/common/ThemeToggle";

const ResetPasswordContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateField = (name: string, value: string) => {
    let errorMsg = "";
    if (!value) return "此项不能为空";

    if (name === "password" && value.length < 6) {
      errorMsg = "密码长度至少需要6位";
    }
    if (name === "confirmPassword" && value !== formData.password) {
      errorMsg = "两次输入的密码不一致";
    }
    return errorMsg;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("重置链接无效，请重新申请");
      return;
    }

    const newErrors: { [key: string]: string } = {};
    let hasError = false;

    // Validate all fields
    const pError = validateField("password", formData.password);
    if (pError) {
      newErrors.password = pError;
      hasError = true;
    }

    const cError =
      formData.confirmPassword !== formData.password
        ? "两次输入的密码不一致"
        : "";
    if (cError) {
      newErrors.confirmPassword = cError;
      hasError = true;
    }

    setErrors(newErrors);
    if (hasError) return;

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          new_password: formData.password,
          confirm_password: formData.confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "重置密码失败");
        return;
      }

      toast.success("密码重置成功，请使用新密码登录");
      router.push("/auth");
    } catch (error) {
      toast.error("网络请求失败，请检查网络");
    }
  };

  if (!token) {
    return (
      <div className="h-dvh w-full bg-slate-50 flex items-center justify-center p-4 font-sans dark:bg-slate-950 transition-colors duration-500">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl text-center border border-slate-100 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            链接无效
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            未找到重置令牌，请重新申请重置密码。
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            返回登录页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full bg-slate-50 flex items-center justify-center p-4 font-sans selection:bg-blue-100 relative overflow-hidden dark:bg-slate-950 dark:selection:bg-blue-900 transition-colors duration-500">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Decorative elements - copied from auth page for consistency */}
      <div className="absolute top-0 left-0 w-full h-64 bg-linear-to-b from-blue-50 to-transparent pointer-events-none dark:from-blue-950/20 transition-colors duration-500"></div>
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none dark:bg-blue-900/10 dark:opacity-30 transition-colors duration-500"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none dark:bg-indigo-900/10 dark:opacity-30 transition-colors duration-500"></div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8 relative z-10 flex flex-col dark:bg-slate-900/80 dark:backdrop-blur-xl dark:border-slate-800 dark:shadow-2xl transition-all duration-300">
        <div className="text-center mb-6">
          <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            重置新密码
          </h2>
          <p className="text-slate-500 text-sm mt-1.5 dark:text-slate-400">
            请为您的账号设置一个新的安全密码
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ValidatedInput
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            error={errors.password}
            placeholder="新密码"
            icon={Lock}
            required
          />

          <ValidatedInput
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            error={errors.confirmPassword}
            placeholder="确认新密码"
            icon={CheckCircle2}
            required
          />

          <button
            type="submit"
            className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center mt-6"
          >
            确认重置
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-100 pt-6">
          <button
            onClick={() => router.push("/auth")}
            className="text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors flex items-center justify-center mx-auto"
          >
            <ArrowLeftCircle className="w-4 h-4 mr-1.5" /> 返回登录页
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
