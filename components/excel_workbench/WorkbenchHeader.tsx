import React from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck, Download } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import UserHeaderActions from "@/components/common/UserHeaderActions";

interface WorkbenchHeaderProps {
  hasHistory: boolean;
  onDownload: () => void;
}

export const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({
  hasHistory,
  onDownload,
}) => {
  return (
    <header className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors">
          <Link
            href="/"
            className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm"
          >
            <Sparkles className="w-5 h-5" />
          </Link>
          Excel AI 数据工作台{" "}
          <span className="text-xs font-normal px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full ml-2 hidden md:inline-flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            纯本地处理
          </span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm transition-colors">
          无需上传服务器，保护核心商业数据。使用 AI
          生成逻辑，本地瞬间完成数据清洗、处理或模拟生成。
        </p>
      </div>
      <div className="flex items-center gap-3">
        {hasHistory && (
          <button
            onClick={onDownload}
            className="flex items-center px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            保存当前视图
          </button>
        )}
        <ThemeToggle />
        <UserHeaderActions />
      </div>
    </header>
  );
};
