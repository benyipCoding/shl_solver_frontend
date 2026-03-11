import React from "react";
import { History, Sparkles } from "lucide-react";
import { HistoryRecord } from "@/interfaces/excel_workbench";

interface DataPanelProps {
  activeRecord?: HistoryRecord;
  activeHistoryIndex: number;
  historyCount: number;
  isNewRecordAdded: boolean;
  onOpenHistory: () => void;
  sheetNames?: string[];
  currentSheetName?: string;
  onSheetChange?: (sheetName: string) => void;
}

export const DataPanel: React.FC<DataPanelProps> = ({
  activeRecord,
  activeHistoryIndex,
  historyCount,
  isNewRecordAdded,
  onOpenHistory,
  sheetNames = [],
  currentSheetName = "",
  onSheetChange = () => {},
}) => {
  const displayData = activeRecord?.data || [];
  const displayColumns = activeRecord?.columns || [];

  return (
    <div className="lg:col-span-8 flex flex-col h-150 lg:h-[calc(100vh-180px)]">
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              当前视图:{" "}
              {activeRecord?.isOriginal
                ? "原始数据"
                : `操作记录 ${activeHistoryIndex}`}{" "}
              (前100行)
            </h2>

            {sheetNames.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  工作表:
                </label>
                <select
                  value={currentSheetName}
                  onChange={(e) => onSheetChange(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  aria-label="Select sheet"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={onOpenHistory}
            className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-300 shadow-sm ${
              isNewRecordAdded
                ? "bg-emerald-500 text-white scale-105 shadow-emerald-500/40 animate-pulse"
                : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50"
            }`}
          >
            <History className="w-4 h-4" />
            操作记录 ({historyCount})
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 w-10">
                  #
                </th>
                {displayColumns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
              {displayData.slice(0, 100).map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3 py-1.5 text-xs text-slate-400 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    {rowIdx + 1}
                  </td>
                  {displayColumns.map((col, colIdx) => {
                    let cellValue = row[col];
                    if (typeof cellValue === "object" && cellValue !== null)
                      cellValue = JSON.stringify(cellValue);
                    return (
                      <td
                        key={colIdx}
                        className="px-3 py-1.5 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap max-w-50 overflow-hidden text-ellipsis"
                        title={cellValue}
                      >
                        {cellValue !== undefined &&
                        cellValue !== null &&
                        cellValue !== "" ? (
                          String(cellValue)
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">
                            -
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* 空数据状态提示 */}
              {displayData.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(displayColumns.length + 1, 1)}
                    className="px-3 py-20 text-center text-slate-500 dark:text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Sparkles className="w-8 h-8 text-emerald-300 dark:text-emerald-700 mb-3" />
                      <p className="font-medium text-slate-600 dark:text-slate-400 mb-1">
                        这是一个空表格
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        您可以点击左侧快捷指令，让 AI 为您生成模拟数据测试。
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
