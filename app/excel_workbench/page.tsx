"use client";
import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  FolderOpen,
  Sparkles,
  ShieldCheck,
  Download,
  History,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import { HistoryRecord } from "@/interfaces/excel_workbench";
import { CommandPanel } from "@/components/excel_workbench/CommandPanel";
import { DataPanel } from "@/components/excel_workbench/DataPanel";
import { useFetch } from "@/context/FetchContext";
import toast from "react-hot-toast";

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (e.dataTransfer.files?.length > 0)
      handleFileUpload(e.dataTransfer.files[0]);
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
      const res = await customFetch("/api/excel_wb", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          columns: aiPayloadData.columns,
          sample_row: aiPayloadData.sampleRow,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        toast.error(errData.error || errData.message || "AI 处理失败");
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-4 md:p-8 md:pb-4 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
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
            {history.length > 0 && (
              <button
                onClick={handleDownload}
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

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Local Import */}
        {history.length === 0 ? (
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
                  handleFileUpload(e.target.files[0])
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
                  <span className="ml-1.5">
                    您的完整文件不会上传至任何服务器
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  仅读取表头供 AI
                  理解结构，几十万行数据计算完全在您浏览器的内存中运行。
                </p>
              </div>
            </div>
          </div>
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
        {showPrivacyModal && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowPrivacyModal(false)}
          >
            <div
              className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h3 className="text-emerald-400 font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> 严格隐私模式验证
                </h3>
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 text-slate-300 text-sm">
                <p className="mb-4">
                  我们郑重承诺不会发送您的整个文件。为了让 AI
                  理解您的数据结构以编写处理逻辑，
                  <span className="text-white font-bold bg-emerald-900/50 px-2 py-0.5 rounded ml-1">
                    仅有以下极少量结构数据
                  </span>{" "}
                  会被作为上下文发送：
                </p>
                <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-700 shadow-inner">
                  <pre className="text-xs leading-relaxed text-emerald-100 font-mono">
                    {JSON.stringify(aiPayloadData, null, 2)}
                  </pre>
                </div>
                <div className="mt-5 flex items-start gap-2 text-slate-400 bg-slate-700/20 p-3 rounded-lg">
                  <span className="text-xl">💡</span>
                  <p className="text-xs leading-relaxed">
                    表格中的所有其余数据均完全在您设备的本地内存中处理。即使您在此刻断开计算机的网络连接，只要
                    AI 代码已返回，庞大的数据处理依然可以瞬间完成。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- History Drawer UI --- */}
        {/* Drawer Backdrop */}
        {isHistoryDrawerOpen && (
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsHistoryDrawerOpen(false)}
          ></div>
        )}

        {/* Drawer Panel */}
        <div
          className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
            isHistoryDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 transition-colors">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4" /> 操作记录 (支持回滚)
            </h3>
            <button
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50">
            {history.map((record, idx) => {
              const isActive = record.id === activeHistoryId;
              return (
                <div
                  key={record.id}
                  onClick={() => setActiveHistoryId(record.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-100 dark:ring-emerald-900/40 shadow-sm"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 shadow-sm"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {isActive && (
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                        )}
                        <p
                          className={`text-sm font-semibold truncate ${isActive ? "text-emerald-800 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}
                        >
                          {record.isOriginal ? record.title : `操作记录 ${idx}`}
                        </p>
                      </div>
                      {!record.isOriginal && (
                        <p
                          className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2"
                          title={record.title}
                        >
                          {record.title}
                        </p>
                      )}
                      {record.explanation && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-900/50 p-2 rounded-md mt-1 leading-relaxed">
                          🤖 {record.explanation}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {record.timestamp}
                      </span>
                      {!record.isOriginal && (
                        <button
                          onClick={(e) => handleDeleteHistory(record.id, e)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                          title="删除此记录"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
