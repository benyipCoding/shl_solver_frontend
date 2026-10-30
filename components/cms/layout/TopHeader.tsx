"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, ChevronRight } from "lucide-react";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import Sidebar, { CMS_NAV } from "./Sidebar";

export default function TopHeader() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const title =
    CMS_NAV.find((item) => item.href === pathname)?.label ?? "首页预览";
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (media.matches) dialog.current?.close();
    };
    media.addEventListener("change", close);
    return () => {
      media.removeEventListener("change", close);
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-9 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <button
          aria-label="打开导航菜单"
          onClick={() => {
            dialog.current?.showModal();
            document.body.style.overflow = "hidden";
          }}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
        >
          <Menu size={20} />
        </button>
        <span className="hidden text-slate-400 sm:inline">管理中心</span>
        <ChevronRight className="hidden text-slate-300 sm:block" size={14} />
        <span className="whitespace-nowrap font-medium">{title}</span>
      </div>
      <UserHeaderActions simpleMode />
      <dialog
        ref={dialog}
        aria-label="后台导航菜单"
        onClose={() => {
          document.body.style.overflow = "";
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-950/40"
      >
        <div className="h-dvh w-[min(20rem,88vw)] text-slate-900 shadow-xl dark:text-slate-100">
          <Sidebar mobile onNavigate={() => dialog.current?.close()} />
        </div>
      </dialog>
    </header>
  );
}
