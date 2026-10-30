import { useState } from "react";
import {
  ArrowUpRight,
  FileSpreadsheet,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { SHORTCUTS, STYLE_SHORTCUTS } from "@/constants/excel_workbench";

interface CommandPanelProps {
  fileName: string;
  sheetName: string;
  displayDataLength: number;
  onCloseFile: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  busy: string;
  processing: boolean;
  onProcess: () => void;
  onCancel: () => void;
  onShowPrivacy: () => void;
}

export function CommandPanel({
  fileName,
  sheetName,
  displayDataLength,
  onCloseFile,
  prompt,
  setPrompt,
  busy,
  processing,
  onProcess,
  onCancel,
  onShowPrivacy,
}: CommandPanelProps) {
  const [category, setCategory] = useState<"data" | "style">("style");
  return (
    <aside className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold" title={fileName}>
            {fileName}
          </p>
          <p className="mt-1 truncate text-base text-slate-400">
            {displayDataLength.toLocaleString()} 行 · {sheetName}
          </p>
        </div>
        <button
          disabled={Boolean(busy)}
          aria-label="关闭文件"
          title="关闭文件"
          onClick={onCloseFile}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-5 dark:border-slate-800 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900">
          <span className="mb-3 inline-flex rounded-lg bg-emerald-600 p-2 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold">让表格，听懂你的想法</h2>
          <p className="mt-1.5 text-base leading-6 text-slate-500 dark:text-slate-400">
            清洗数据、突出重点、美化报表。
            <br />
            一句话，在当前工作表完成。
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div
            className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
            aria-label="指令示例分类"
          >
            {(
              [
                { key: "style", label: "样式美化", icon: Palette },
                { key: "data", label: "数据处理", icon: WandSparkles },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                aria-pressed={category === item.key}
                onClick={() => setCategory(item.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-base transition ${category === item.key ? "bg-white font-medium text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {(category === "style" ? STYLE_SHORTCUTS : SHORTCUTS).map(
              (shortcut) => (
                <button
                  key={shortcut.label}
                  disabled={Boolean(busy)}
                  onClick={() => setPrompt(shortcut.prompt)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-base text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-emerald-950"
                >
                  {shortcut.label}
                </button>
              ),
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus-within:ring-emerald-950">
            <label htmlFor="excel-command" className="sr-only">
              处理指令
            </label>
            <textarea
              id="excel-command"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={Boolean(busy)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  onProcess();
                }
              }}
              placeholder={
                "例如：将销售额大于 10000 的行设为红色背景并加粗，同时按销售额降序排列。"
              }
              className="min-h-40 w-full resize-y bg-transparent p-3 text-base leading-6 outline-none placeholder:text-slate-400 disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2 text-base text-slate-400">
              <span>支持数据 + 样式组合指令</span>
              <span>Ctrl / ⌘ ↵</span>
            </div>
          </div>
          <button
            onClick={processing ? onCancel : onProcess}
            disabled={!processing && (Boolean(busy) || !prompt.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                取消处理
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                生成并应用
                <ArrowUpRight className="h-4 w-4" />
              </>
            )}
          </button>
          <p
            aria-live="polite"
            className="text-center text-base leading-6 text-slate-400"
          >
            {busy || "每次修改均可在操作记录中回退"}
          </p>
        </div>
      </div>
      <button
        onClick={onShowPrivacy}
        className="flex items-start gap-2.5 rounded-xl px-2 py-1 text-left text-base leading-6 text-slate-400 hover:text-emerald-600"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          文件在本地处理。AI 会接收指令、列名及首行示例。
          <span className="ml-1 underline underline-offset-2">
            查看发送内容
          </span>
        </span>
      </button>
    </aside>
  );
}
