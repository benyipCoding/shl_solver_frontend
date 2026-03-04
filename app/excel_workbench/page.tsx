"use client";
import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { HistoryRecord } from "@/interfaces/excel_workbench";
import { CommandPanel } from "@/components/excel_workbench/CommandPanel";
import { DataPanel } from "@/components/excel_workbench/DataPanel";
import { WorkbenchHeader } from "@/components/excel_workbench/WorkbenchHeader";
import { HistoryDrawer } from "@/components/excel_workbench/HistoryDrawer";
import { PrivacyModal } from "@/components/excel_workbench/PrivacyModal";
import { LocalImportArea } from "@/components/excel_workbench/LocalImportArea";
import { useFetch } from "@/context/FetchContext";
import toast from "react-hot-toast";

export default function App() {
  const { customFetch } = useFetch();

  // Data State
  const [fileName, setFileName] = useState("");
  const [history, setHistory] = useState<HistoryRecord[]>([]); // Array of operation records
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false); // 控制抽屉开关
  const [isNewRecordAdded, setIsNewRecordAdded] = useState(false); // 控制新记录动画

  // AI State
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Privacy Transparency State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Derived active state
  const activeRecord =
    history.find((h) => h.id === activeHistoryId) || history[0];
  const displayData = activeRecord?.data || [];
  const displayColumns = activeRecord?.columns || [];

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const isExcel = file.name.match(/\.(xlsx|xls|csv)$/i);
    if (!isExcel) {
      setError("不支持的格式，请选择 .xlsx, .xls 或 .csv 文件");
      return;
    }

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: "",
        });

        // 移除了空数据拦截，允许上传空的 Excel 文件

        const initialRecord = {
          id: Date.now().toString(),
          title: "原始导入数据",
          data: jsonData as any[],
          columns:
            jsonData.length > 0 ? Object.keys((jsonData as any[])[0]) : [], // 防御性处理空数据
          timestamp: new Date().toLocaleTimeString(),
          isOriginal: true,
        };
        setHistory([initialRecord]);
        setActiveHistoryId(initialRecord.id);
      } catch (err: any) {
        setError("解析时发生错误：" + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- AI Processing with Payload Construction ---
  const aiPayloadData = {
    columns: displayColumns,
    sampleRow: displayData[0] || {},
  };

  const handleProcess = async () => {
    if (!prompt.trim()) return; // 移除了 displayData.length === 0 的拦截
    setIsLoading(true);
    setError(null);

    try {
      const res = await customFetch(
        "/api/excel_wb",
        {
          method: "POST",
          body: JSON.stringify({
            prompt,
            columns: aiPayloadData.columns,
            sample_row: aiPayloadData.sampleRow,
          }),
        },
        true
      );
      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || errData.message || "AI 处理失败");
      }

      const parsed = await res.json();

      // Sandbox execution
      const executionWrapper = new Function(
        "data",
        `${parsed.code}\n return transform(data);`
      );
      const dataCopy = JSON.parse(JSON.stringify(displayData));
      const transformedData = executionWrapper(dataCopy);
      if (!Array.isArray(transformedData))
        throw new Error("处理结果格式异常，期望返回数组。");
      // Auto-detect new columns
      const keySet = new Set<string>();
      (transformedData as any[]).forEach((row: any) =>
        Object.keys(row).forEach((k) => keySet.add(k))
      );
      const newRecord: HistoryRecord = {
        id: Date.now().toString(),
        title: prompt,
        explanation: parsed.explanation,
        data: transformedData as any[],
        columns: Array.from(keySet),
        timestamp: new Date().toLocaleTimeString(),
      };
      setHistory((prev) => [...prev, newRecord]);
      setActiveHistoryId(newRecord.id);
      setPrompt("");
      // 触发按钮动画而不自动弹开抽屉
      setIsNewRecordAdded(true);
      setTimeout(() => setIsNewRecordAdded(false), 2000);
    } catch (err: any) {
      setError("执行失败: " + (err.message || "未知错误"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== id);
      if (activeHistoryId === id && filtered.length > 0) {
        setActiveHistoryId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  };

  const handleDownload = () => {
    // 即使为空也允许导出（可以导出一个包含新表头的空表）
    try {
      const worksheet = XLSX.utils.json_to_sheet(
        displayData.length > 0 ? displayData : []
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      const exportName = fileName
        ? fileName.replace(/\.[^/.]+$/, "") + "_已处理"
        : "数据导出";
      XLSX.writeFile(workbook, `${exportName}.xlsx`);
    } catch (err: any) {
      setError("导出失败: " + err.message);
    }
  };

  useEffect(() => {
    return () => {
      setError(null);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-4 md:p-8 md:pb-4 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <WorkbenchHeader
          hasHistory={history.length > 0}
          onDownload={handleDownload}
        />

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Local Import */}
        {history.length === 0 ? (
          <LocalImportArea onFileUpload={handleFileUpload} />
        ) : (
          /* Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel: Command */}
            <CommandPanel
              fileName={fileName}
              displayDataLength={displayData.length}
              onCloseFile={() => setHistory([])}
              prompt={prompt}
              setPrompt={setPrompt}
              isLoading={isLoading}
              onProcess={handleProcess}
              onShowPrivacy={() => setShowPrivacyModal(true)}
            />

            {/* Right Panel: Data Table */}
            <DataPanel
              activeRecord={activeRecord}
              activeHistoryIndex={history.findIndex(
                (h) => h.id === activeHistoryId
              )}
              historyCount={history.length}
              isNewRecordAdded={isNewRecordAdded}
              onOpenHistory={() => setIsHistoryDrawerOpen(true)}
            />
          </div>
        )}

        {/* --- Privacy Transparency Modal --- */}
        <PrivacyModal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          aiPayloadData={aiPayloadData}
        />

        {/* --- History Drawer UI --- */}
        <HistoryDrawer
          isOpen={isHistoryDrawerOpen}
          onClose={() => setIsHistoryDrawerOpen(false)}
          history={history}
          activeHistoryId={activeHistoryId}
          onSelectHistory={(id) => setActiveHistoryId(id)}
          onDeleteHistory={handleDeleteHistory}
        />
      </div>
    </div>
  );
}
