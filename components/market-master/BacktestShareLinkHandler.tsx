"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/context/FetchContext";
import { createBacktestPersistClient } from "./backtest-persistence";
import type { BacktestSessionDetail } from "./backtest-replay";
import { BACKTEST_SHARE_PARAM, removeBacktestShareParam } from "./backtest-sharing";

export function BacktestShareLinkHandler({ onReplay, isReplayMode }: {
  onReplay: (detail: BacktestSessionDetail) => void;
  isReplayMode: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareId = searchParams.get(BACKTEST_SHARE_PARAM);
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  const { customFetch } = useFetch();
  const onReplayRef = useRef(onReplay);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loadedShareId, setLoadedShareId] = useState<string | null>(null);
  const [dismissedShareId, setDismissedShareId] = useState<string | null>(null);

  useEffect(() => { onReplayRef.current = onReplay; }, [onReplay]);

  useEffect(() => {
    if (shareId == null || isLoading) return;

    const controller = new AbortController();
    const client = createBacktestPersistClient();
    // An expired login clears the user in customFetch; the next effect then
    // loads the public preview instead of interrupting viewing with a redirect.
    client.configure({ enabled: true, fetchFn: (input, init) => customFetch(input, init, false) });
    const restore = async () => {
      setError("");
      setLoadedShareId(null);
      try {
        if (!/^[\w-]{1,36}$/.test(shareId)) throw new Error("分享链接格式不正确");
        const isGuest = userId == null;
        const result = isGuest
          ? { session: await client.getSharedSession(shareId, controller.signal), already_saved: false }
          : await client.saveSharedSession(shareId, controller.signal);
        if (controller.signal.aborted) return;
        if (!result?.session?.public_id) throw new Error("分享记录不存在");
        onReplayRef.current(result.session);
        setLoadedShareId(shareId);
        if (!isGuest) {
          toast.success(result.already_saved ? "已打开回测记录" : "已收藏到回测记录，可随时再次回看");
          router.replace(removeBacktestShareParam(window.location.href), { scroll: false });
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : "加载分享记录失败");
        }
      }
    };
    void restore();
    return () => controller.abort();
  }, [shareId, isLoading, userId, customFetch, router, attempt]);

  if (shareId == null || isLoading) return null;
  if (loadedShareId === shareId && !error) {
    if (userId != null || !isReplayMode || dismissedShareId === shareId) return null;
    return (
      <div role="status" className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-gray-700 bg-gray-900/95 p-4 text-sm text-gray-200 shadow-xl">
        <p className="pr-6">正在以游客身份回放</p>
        <p className="mt-1 pr-6 text-xs text-gray-400">登录后可收藏这条记录，方便下次回看。</p>
        <button type="button" onClick={() => {
          const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          router.push(`/auth?${new URLSearchParams({ callbackUrl })}`);
        }} className="mt-3 text-blue-400 hover:text-blue-300">登录并收藏</button>
        <button type="button" aria-label="关闭游客提示" onClick={() => setDismissedShareId(shareId)} className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:text-white"><X size={16} /></button>
      </div>
    );
  }
  return (
    <div role={error ? "alert" : "status"} className="fixed right-4 top-20 z-200 max-w-sm rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-200 shadow-xl">
      {error ? (
        <>
          <p className="pr-6">{error}</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 text-blue-400 hover:text-blue-300">重试</button>
        </>
      ) : (
        <p className="flex items-center gap-2 pr-6"><Loader2 size={16} className="animate-spin" />{userId == null ? "正在加载分享回放…" : "正在收藏并加载分享回放…"}</p>
      )}
      <button type="button" aria-label="关闭分享回放提示" onClick={() => router.replace(removeBacktestShareParam(window.location.href), { scroll: false })} className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:text-white"><X size={16} /></button>
    </div>
  );
}
