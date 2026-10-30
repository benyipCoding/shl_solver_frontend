"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import type {
  SheetView,
  TransformRequest,
  WorkbookCommand,
} from "@/interfaces/excel_workbench";
import { CommandPanel } from "@/components/excel_workbench/CommandPanel";
import { DataPanel } from "@/components/excel_workbench/DataPanel";
import { WorkbenchHeader } from "@/components/excel_workbench/WorkbenchHeader";
import { HistoryDrawer } from "@/components/excel_workbench/HistoryDrawer";
import { PrivacyModal } from "@/components/excel_workbench/PrivacyModal";
import { LocalImportArea } from "@/components/excel_workbench/LocalImportArea";
import { useWorkbook } from "@/components/excel_workbench/useWorkbook";
import { useFetch } from "@/context/FetchContext";
import styles from "@/components/excel_workbench/Workbench.module.css";

export default function ExcelWorkbench() {
  const { customFetch } = useFetch();
  const { request, dispose } = useWorkbook();
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [view, setView] = useState<SheetView | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const operation = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const payload: TransformRequest = {
    prompt,
    columns: view?.snapshot.columns || [],
    sample_row: view?.snapshot.data[0] || {},
    protocol_version: 2,
  };
  const reportError = (error: unknown) =>
    setError(error instanceof Error ? error.message : "处理失败，请重试。");

  const handleFileUpload = async (file: File) => {
    if (operation.current) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("请选择 .xlsx、.xls 或 .csv 文件。");
      return;
    }
    operation.current = true;
    setBusy("正在读取工作簿…");
    setError(null);
    try {
      const result = await request({
        type: "import",
        buffer: await file.arrayBuffer(),
        fileName: file.name,
      });
      setFileName(file.name);
      setSheetNames(result.sheetNames!);
      setView(result.view!);
      setPrompt("");
    } catch (error) {
      reportError(error);
    } finally {
      operation.current = false;
      setBusy("");
    }
  };

  const changeView = async (command: WorkbookCommand) => {
    if (operation.current) return;
    operation.current = true;
    setBusy("正在加载工作表…");
    setError(null);
    try {
      const result = await request(command);
      if (result.view) setView(result.view);
    } catch (error) {
      reportError(error);
    } finally {
      operation.current = false;
      setBusy("");
    }
  };

  const handleProcess = async () => {
    if (!prompt.trim() || !view || operation.current) return;
    operation.current = true;
    const controller = new AbortController();
    abort.current = controller;
    setProcessing(true);
    setBusy("AI 正在理解你的需求…");
    setError(null);
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await customFetch(
        "/api/excel_wb",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
        true,
      );
      const parsed = await response.json();
      if (!response.ok)
        throw new Error(parsed.error || parsed.message || "AI 处理失败。");
      if (typeof parsed.code !== "string")
        throw new Error("AI 未返回有效的处理逻辑，请重试。");
      if (controller.signal.aborted) return;
      clearTimeout(timeout);
      setBusy("正在本地应用数据与样式…");
      const result = await request({
        type: "transform",
        sheetName: view.sheetName,
        historyId: view.activeHistoryId,
        code: parsed.code,
        title: prompt.trim(),
        explanation: parsed.explanation,
      });
      setView(result.view!);
      setPrompt("");
    } catch (error) {
      if (controller.signal.aborted)
        setError("处理已取消或等待超时，已有数据和样式已保留。");
      else reportError(error);
    } finally {
      clearTimeout(timeout);
      abort.current = null;
      operation.current = false;
      setProcessing(false);
      setBusy("");
    }
  };

  const handleDownload = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy("正在生成含样式的工作簿…");
    setError(null);
    try {
      const result = await request({ type: "export" });
      const url = URL.createObjectURL(
        new Blob([result.buffer!], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName.replace(/\.[^/.]+$/, "")}_已处理.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      reportError(error);
    } finally {
      operation.current = false;
      setBusy("");
    }
  };

  return (
    <main
      className={`${styles.workbench} min-h-screen bg-[#f5f7fa] p-3 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 xl:p-8`}
    >
      <div className="mx-auto max-w-[1800px] space-y-5">
        <WorkbenchHeader
          hasHistory={Boolean(view)}
          disabled={Boolean(busy)}
          onDownload={handleDownload}
        />
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button aria-label="关闭提示" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {view ? (
          <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
            <CommandPanel
              fileName={fileName}
              sheetName={view.sheetName}
              displayDataLength={view.snapshot.data.length}
              onCloseFile={() => {
                if (operation.current) return;
                dispose();
                setView(null);
                setSheetNames([]);
                setFileName("");
                setHistoryOpen(false);
                setError(null);
              }}
              prompt={prompt}
              setPrompt={setPrompt}
              busy={busy}
              processing={processing}
              onProcess={handleProcess}
              onCancel={() => {
                abort.current?.abort();
                void request({ type: "cancel" });
              }}
              onShowPrivacy={() => setPrivacyOpen(true)}
            />
            <DataPanel
              view={view}
              sheetNames={sheetNames}
              busy={busy}
              onOpenHistory={() => setHistoryOpen(true)}
              onSheetChange={(sheetName) =>
                void changeView({ type: "select", sheetName })
              }
            />
          </div>
        ) : (
          <LocalImportArea onFileUpload={handleFileUpload} busy={busy} />
        )}
        <PrivacyModal
          isOpen={privacyOpen}
          onClose={() => setPrivacyOpen(false)}
          aiPayloadData={payload}
        />
        <HistoryDrawer
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          history={view?.history || []}
          activeHistoryId={view?.activeHistoryId || null}
          disabled={Boolean(busy)}
          onSelectHistory={(historyId) => {
            if (view)
              void changeView({
                type: "select",
                sheetName: view.sheetName,
                historyId,
              });
          }}
          onDeleteHistory={(historyId, event) => {
            event.stopPropagation();
            if (view)
              void changeView({
                type: "deleteHistory",
                sheetName: view.sheetName,
                historyId,
              });
          }}
        />
      </div>
    </main>
  );
}
