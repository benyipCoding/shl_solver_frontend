"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/context/FetchContext";
import { getAdminMe } from "@/components/cms/api";
import { AdminSessionUser } from "@/interfaces/cms";

type AccessState = "checking" | "granted" | "denied";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { customFetch } = useFetch();

  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  const redirectToAuth = () => {
    const params = new URLSearchParams();
    params.set("callbackUrl", "/cms");
    router.replace(`/auth?${params.toString()}`);
  };

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      redirectToAuth();
      return;
    }

    let active = true;

    const verifyAdmin = async () => {
      setAccessState("checking");
      try {
        const currentUser = await getAdminMe(customFetch);
        if (!active) return;

        if (!currentUser.is_superuser) {
          setAccessState("denied");
          setAccessMessage(
            "当前账号不是超级管理员，无法访问后台数据管理页面。"
          );
          return;
        }

        setAccessMessage(null);
        setAccessState("granted");
      } catch (error: unknown) {
        if (!active) return;

        const message =
          error instanceof Error ? error.message : "无法校验管理员身份";
        if (
          message.includes("401") ||
          message.includes("Unauthorized") ||
          message.includes("获取用户信息失败")
        ) {
          redirectToAuth();
          return;
        }

        setAccessState("denied");
        setAccessMessage(message);
      }
    };

    void verifyAdmin();

    return () => {
      active = false;
    };
  }, [customFetch, isLoading, router, user]);

  if (isLoading || accessState === "checking") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoaderCircle className="h-10 w-10 animate-spin text-sky-500 mb-4" />
        <p className="text-slate-500 text-sm">正在验证最高管理员权限...</p>
      </div>
    );
  }

  if (accessState === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 mb-6">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">
            无权访问
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            {accessMessage}
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => router.replace("/")}
              className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 font-medium transition"
            >
              返回首页
            </button>
            <button
              onClick={redirectToAuth}
              className="px-6 py-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 font-medium shadow-sm transition"
            >
              重新登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
