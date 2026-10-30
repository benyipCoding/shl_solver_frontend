import Link from "next/link";
import { ArrowDownToLine, ChevronLeft, FileSpreadsheet } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import styles from "./Workbench.module.css";

export function WorkbenchHeader({
  hasHistory,
  disabled,
  onDownload,
}: {
  hasHistory: boolean;
  disabled: boolean;
  onDownload: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-1">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href="/"
          aria-label="返回首页"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="hidden rounded-2xl bg-emerald-600 p-3 text-white shadow-sm sm:block">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Excel AI 数据工作台
            </h1>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-base font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
              AI
            </span>
          </div>
          <p className="mt-1 text-base text-slate-400">
            从数据整理到样式设计，让每一张表更出色。
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {hasHistory && (
          <button
            disabled={disabled}
            onClick={onDownload}
            title="导出所有工作表各自选中的版本，包含数据与样式"
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <ArrowDownToLine className="h-4 w-4" />
            导出工作簿
          </button>
        )}
        <ThemeToggle />
        <UserHeaderActions creditLogClassName={styles.workbench} />
      </div>
    </header>
  );
}
