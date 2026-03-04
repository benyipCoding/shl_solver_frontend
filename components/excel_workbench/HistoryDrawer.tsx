import React from "react";
import { History, Trash2, X } from "lucide-react";
import { HistoryRecord } from "@/interfaces/excel_workbench";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryRecord[];
  activeHistoryId: string | null;
  onSelectHistory: (id: string) => void;
  onDeleteHistory: (id: string, e: React.MouseEvent) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  activeHistoryId,
  onSelectHistory,
  onDeleteHistory,
}) => {
  // If we rely on CSS transition for slide in/out, we usually keep the component mounted but hidden,
  // or wrap it in checks. The original code renders the backdrop and the panel side by side in markup.
  // The panel uses translate classes. So we render always if we want the exit animation, OR we render
  // the markup structure and rely on isOpen class.
  // Original code:
  // {isHistoryDrawerOpen && (<Backdrop>)}
  // <div className={`... ${isHistoryDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>...</div>
  // So the panel is ALWAYS rendered in DOM, just translated off screen.

  return (
    <>
      {/* Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        ></div>
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 transition-colors">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4" /> 操作记录 (支持回滚)
          </h3>
          <button
            onClick={onClose}
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
                onClick={() => onSelectHistory(record.id)}
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
                        onClick={(e) => onDeleteHistory(record.id, e)}
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
    </>
  );
};
