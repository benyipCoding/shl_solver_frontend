import { useRef } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Table2,
} from "lucide-react";
import type { SheetView } from "@/interfaces/excel_workbench";
import { VirtualSheet } from "./VirtualSheet";

interface DataPanelProps {
  view: SheetView;
  sheetNames: string[];
  busy: string;
  onOpenHistory: () => void;
  onSheetChange: (name: string) => void;
}

export function DataPanel({
  view,
  sheetNames,
  busy,
  onOpenHistory,
  onSheetChange,
}: DataPanelProps) {
  const tabs = useRef<HTMLDivElement>(null);
  const active = view.history.find(
    (record) => record.id === view.activeHistoryId,
  )!;
  const index = sheetNames.indexOf(view.sheetName);
  const moveTab = (next: number) => {
    const i = (next + sheetNames.length) % sheetNames.length;
    onSheetChange(sheetNames[i]);
    const tab =
      tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[i];
    tab?.focus();
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  return (
    <section
      aria-label="工作簿预览"
      className="flex h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:h-[calc(100dvh-170px)] lg:min-h-[480px]"
    >
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <h2 className="truncate text-base font-semibold">
              {view.sheetName}
            </h2>
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-base text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {active.isOriginal ? "原始数据" : "已更新"}
            </span>
          </div>
          <p className="mt-1 truncate text-base text-slate-400">
            {view.snapshot.data.length.toLocaleString()} 行 ·{" "}
            {view.snapshot.columns.length.toLocaleString()} 列
          </p>
        </div>
        <button
          disabled={Boolean(busy)}
          onClick={onOpenHistory}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <History className="h-4 w-4" />
          操作记录{" "}
          <span className="tabular-nums text-slate-400">
            {view.history.length}
          </span>
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        role="tabpanel"
        id="sheet-panel"
        aria-labelledby={`sheet-tab-${index}`}
        aria-busy={Boolean(busy)}
      >
        {view.snapshot.columns.length > 0 ? (
          <VirtualSheet
            key={`${view.sheetName}:${view.activeHistoryId}`}
            snapshot={view.snapshot}
            sheetName={view.sheetName}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
            <Table2 className="h-10 w-10 text-emerald-300" />
            <p className="text-base">从一张空表开始</p>
            <p className="text-base">在左侧描述需要的数据，AI 会帮你创建。</p>
          </div>
        )}
        {view.snapshot.columns.length > 0 &&
          view.snapshot.data.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-base text-slate-400">
              已保留表头，当前没有数据行
            </div>
          )}
        {busy && (
          <div
            role="status"
            className="absolute bottom-4 left-1/2 z-30 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-4 py-2 text-base text-emerald-700 shadow-lg backdrop-blur dark:border-emerald-800 dark:bg-slate-900/95 dark:text-emerald-300"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            {busy}
          </div>
        )}
      </div>
      <div className="flex items-stretch gap-1 border-t border-slate-200 bg-slate-50/70 px-2 dark:border-slate-800 dark:bg-slate-950/40">
        <button
          aria-label="向左滚动工作表标签"
          className="shrink-0 px-1 text-slate-400 hover:text-emerald-600"
          onClick={() =>
            tabs.current?.scrollBy({ left: -240, behavior: "smooth" })
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={tabs}
          role="tablist"
          aria-label="工作表"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 [scrollbar-width:thin]"
        >
          {sheetNames.map((name, i) => (
            <button
              key={name}
              id={`sheet-tab-${i}`}
              role="tab"
              aria-selected={name === view.sheetName}
              aria-controls="sheet-panel"
              tabIndex={name === view.sheetName ? 0 : -1}
              disabled={Boolean(busy)}
              onClick={() => onSheetChange(name)}
              onKeyDown={(event) => {
                if (busy) return;
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  moveTab(
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? sheetNames.length - 1
                        : i + (event.key === "ArrowRight" ? 1 : -1),
                  );
                }
              }}
              className={`flex max-w-60 shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-base font-medium transition disabled:opacity-60 ${name === view.sheetName ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-emerald-300 dark:ring-slate-700" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
              title={name}
            >
              <Table2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
        <button
          aria-label="向右滚动工作表标签"
          className="shrink-0 px-1 text-slate-400 hover:text-emerald-600"
          onClick={() =>
            tabs.current?.scrollBy({ left: 240, behavior: "smooth" })
          }
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 px-4 py-2 text-base text-slate-400 dark:border-slate-800">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          {sheetNames.length} 个工作表 · 数据与样式一并导出
        </span>
        <span>滚动查看全部行列</span>
      </div>
    </section>
  );
}
