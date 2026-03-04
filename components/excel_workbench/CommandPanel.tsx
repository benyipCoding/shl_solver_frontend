import React from "react";
import { Sparkles, Eye } from "lucide-react";
import { SHORTCUTS } from "@/constants/excel_workbench";

interface CommandPanelProps {
  fileName: string;
  displayDataLength: number;
  onCloseFile: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  isLoading: boolean;
  onProcess: () => void;
  onShowPrivacy: () => void;
}

export const CommandPanel: React.FC<CommandPanelProps> = ({
  fileName,
  displayDataLength,
  onCloseFile,
  prompt,
  setPrompt,
  isLoading,
  onProcess,
  onShowPrivacy,
}) => {
  return (
    <div className="lg:col-span-4 flex flex-col space-y-4 h-150 lg:h-[calc(100vh-180px)]">
      {/* File Info */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 transition-colors">
        <div className="overflow-hidden">
          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm">
            {fileName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            当前视图共 {displayDataLength} 行数据 | 纯本地内存就绪
          </p>
        </div>
        <button
          onClick={onCloseFile}
          className="text-xs text-slate-400 hover:text-red-500 underline whitespace-nowrap ml-4"
        >
          关闭文件
        </button>
      </div>

      {/* AI Command Box */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden transition-colors">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3 shrink-0">
          <Sparkles className="w-5 h-5 text-emerald-500" /> 告诉 AI
          你想怎么处理或生成
        </h3>

        {/* Shortcut Pills */}
        <div className="flex flex-wrap gap-2 mb-3 max-h-fit overflow-y-auto shrink-0">
          {SHORTCUTS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(s.prompt)}
              className="text-[11px] px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 transition-colors text-left"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col space-y-3 min-h-0 mt-1">
          <textarea
            className="flex-1 w-full p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 dark:text-slate-200 resize-none text-sm transition-all"
            placeholder="输入指令（例如：帮我把地址列拆分，或者生成20条模拟用户数据...）"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
          ></textarea>

          {/* Trust indicator right near the execute button */}
          <div className="flex items-center justify-between shrink-0">
            <button
              onClick={onShowPrivacy}
              className="text-xs text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center transition-colors"
              title="查看实际发送给AI的脱敏内容"
            >
              <Eye className="w-3.5 h-3.5 mr-1" /> 隐私透明度
            </button>

            <button
              onClick={onProcess}
              disabled={isLoading || !prompt.trim()}
              className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center transition-all ${
                isLoading || !prompt.trim()
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              }`}
            >
              {isLoading ? "AI 处理中..." : "生成并执行"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
