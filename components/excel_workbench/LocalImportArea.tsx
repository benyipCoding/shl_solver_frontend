import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  Layers3,
  Loader2,
  Palette,
  ShieldCheck,
  Upload,
  WandSparkles,
} from "lucide-react";

export function LocalImportArea({
  onFileUpload,
  busy,
}: {
  onFileUpload: (file: File) => void;
  busy: string;
}) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="mx-auto max-w-3xl py-10 sm:py-16">
      <div className="mb-8 text-center">
        <p className="mb-3 text-base font-semibold tracking-[0.2em] text-emerald-600">
          YOUR SPREADSHEET, REIMAGINED
        </p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          好用的表格，从这里开始
        </h2>
        <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
          导入一份工作簿，把繁琐的整理和美化交给 AI。
        </p>
      </div>
      <button
        disabled={Boolean(busy)}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !busy) onFileUpload(file);
        }}
        className={`flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition ${dragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-900/5 dark:border-slate-700 dark:bg-slate-900"}`}
      >
        <span className="mb-6 rounded-2xl bg-emerald-50 p-5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          {busy ? (
            <Loader2 className="h-9 w-9 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-9 w-9" />
          )}
        </span>
        <span className="text-base font-medium">
          {busy || "拖入 Excel 文件，或点击选择"}
        </span>
        <span className="mt-2 text-base text-slate-400">
          支持 .xlsx、.xls、.csv · 多工作表与空表格
        </span>
        <span className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-base font-medium text-white">
          <Upload className="h-4 w-4" />
          选择本地文件
        </span>
      </button>
      <input
        aria-label="选择 Excel 文件"
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        disabled={Boolean(busy)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileUpload(file);
          event.target.value = "";
        }}
      />
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: WandSparkles,
            title: "一句话整理",
            detail: "清洗、汇总、生成数据",
          },
          { icon: Palette, title: "让重点醒目", detail: "条件染色与字体美化" },
          {
            icon: Layers3,
            title: "多表自由切换",
            detail: "独立历史，带样式导出",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <item.icon className="mb-3 h-5 w-5 text-emerald-600" />
            <p className="text-base font-medium">{item.title}</p>
            <p className="mt-1.5 text-base leading-6 text-slate-400">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-6 flex items-start justify-center gap-2 text-base text-slate-400">
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
        完整文件留在本地，仅指令、列名和首行示例发送给 AI
      </p>
    </section>
  );
}
