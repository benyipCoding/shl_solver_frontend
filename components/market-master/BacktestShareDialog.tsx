"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useFetch } from "@/context/FetchContext";
import { createBacktestPersistClient } from "./backtest-persistence";
import type { BacktestSessionListItem } from "./backtest-replay";
import { buildBacktestShareUrl } from "./backtest-sharing";

export function BacktestShareDialog({ item, onClose, onVisibilityChange }: {
  item: BacktestSessionListItem;
  onClose: () => void;
  onVisibilityChange: (publicId: string, visibility: "PRIVATE" | "UNLISTED") => void;
}) {
  const { customFetch } = useFetch();
  const clientRef = useRef(createBacktestPersistClient());
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { if (link) inputRef.current?.focus(); }, [link]);

  useEffect(() => {
    const controller = new AbortController();
    clientRef.current.configure({ enabled: true, fetchFn: (input, init) => customFetch(input, init, true) });
    const createLink = async () => {
      setError("");
      try {
        const result = await clientRef.current.shareSession(item.public_id, controller.signal);
        if (controller.signal.aborted) return;
        setLink(buildBacktestShareUrl(window.location.origin, result.public_id));
        onVisibilityChange(item.public_id, "UNLISTED");
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "生成分享链接失败");
      }
    };
    void createLink();
    return () => controller.abort();
  }, [item.public_id, customFetch, onVisibilityChange, attempt]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !revoking) { event.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onClose, revoking]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("分享链接已复制");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      toast("请复制已选中的分享链接");
    }
  };

  const revoke = async () => {
    setRevoking(true);
    try {
      await clientRef.current.revokeShare(item.public_id);
      onVisibilityChange(item.public_id, "PRIVATE");
      toast.success("已停止分享，其他用户将无法回放这条记录");
      onClose();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "停止分享失败");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4" onClick={event => { event.stopPropagation(); if (!revoking) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="backtest-share-title" className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 id="backtest-share-title" className="font-bold text-white">分享回测记录 · {item.symbol}</h3>
          <button type="button" disabled={revoking} aria-label="关闭分享" onClick={onClose} className="rounded p-1 text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-gray-400">获得链接的人无需登录即可从起点回放，登录后还会自动收藏到回测记录。</p>
        {error ? (
          <div role="alert" className="text-sm text-red-400">{error}<button type="button" className="ml-3 text-blue-400" onClick={() => setAttempt(value => value + 1)}>重试</button></div>
        ) : !link ? (
          <p role="status" className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" />正在生成分享链接…</p>
        ) : (
          <>
            <input ref={inputRef} aria-label="回测分享链接" readOnly value={link} onFocus={event => event.target.select()} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500" />
            <button type="button" onClick={() => void copyLink()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Copy size={16} />复制链接</button>
            {!item.is_shared && <>
              <p className="mt-4 text-xs leading-relaxed text-gray-500">停止分享或删除原记录后，其他用户的收藏将不可播放。再次分享会恢复此链接。</p>
              <button type="button" disabled={revoking} onClick={() => void revoke()} className="mt-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50">{revoking ? "正在停止分享…" : "停止分享"}</button>
            </>}
          </>
        )}
      </div>
    </div>
  );
}
