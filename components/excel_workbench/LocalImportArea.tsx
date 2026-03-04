import React, { useState, useRef } from "react";
import { FolderOpen, ShieldCheck } from "lucide-react";

interface LocalImportAreaProps {
  onFileUpload: (file: File) => void;
}

export const LocalImportArea: React.FC<LocalImportAreaProps> = ({
  onFileUpload,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) onFileUpload(e.dataTransfer.files[0]);
  };

  return (
    <div className="mt-12 flex flex-col items-center">
      <div
        className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center transition-all
          ${isDragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 scale-[1.02]" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800"}
          cursor-pointer shadow-sm hover:shadow-md`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx, .xls, .csv"
          onChange={(e) =>
            e.target.files &&
            e.target.files.length > 0 &&
            onFileUpload(e.target.files[0])
          }
        />

        <div className="bg-emerald-100 dark:bg-emerald-900/20 p-4 rounded-full mb-4">
          <FolderOpen className="w-12 h-12 text-emerald-500 mb-0.5" />
        </div>

        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          将 Excel 文件拖拽至此（支持空表格）
        </h3>

        {/* Trust Indicators */}
        <div className="flex flex-col items-center gap-2 mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl w-full transition-colors">
          <div className="flex items-center text-emerald-700 dark:text-emerald-400 font-medium text-sm">
            <ShieldCheck className="w-4 h-4 mr-1.5" />{" "}
            <span className="ml-1.5">您的完整文件不会上传至任何服务器</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            仅读取表头供 AI
            理解结构，几十万行数据计算完全在您浏览器的内存中运行。
          </p>
        </div>
      </div>
    </div>
  );
};
