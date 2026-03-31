"use client";
import React, { useState } from "react";
import {
  Code,
  BookOpen,
  Cpu,
  Check,
  Terminal,
  Copy,
  X,
  ChevronDown,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  Eye,
  ScanSearch,
  Zap,
  RefreshCw,
  BrainCircuit,
  Clock,
} from "lucide-react";
import {
  AnalysisResult,
  Complexity,
  ResultDisplayProps,
} from "@/interfaces/shl_solver";
import toast from "react-hot-toast";
import VisualDiff from "./VisualDiff";
import { highlightCode } from "@/utils/helpers";

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  const [activeTab, setActiveTab] = useState<string>("solution"); // 'solution' or 'analysis'
  const [selectedLanguage, setSelectedLanguage] = useState<string>("python"); // 'python', 'java', 'javascript'
  const [isTranscriptionMode, setIsTranscriptionMode] =
    useState<boolean>(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0);

  const getCodeContent = () => {
    if (!result) return "";
    if (result.solutions && result.solutions[selectedLanguage]) {
      return result.solutions[selectedLanguage];
    }
    // Fallback if the legacy structure is returned
    return (result as any).code || "";
  };

  const copyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    toast.success("已复制到剪贴板");
    document.body.removeChild(textArea);
  };

  const enterTranscriptionMode = () => {
    setCurrentLineIndex(0);
    setIsTranscriptionMode(true);
  };

  const exitTranscriptionMode = () => {
    setIsTranscriptionMode(false);
  };

  const nextLine = () => {
    const lines = getCodeContent().split("\n");
    if (currentLineIndex < lines.length - 1) {
      setCurrentLineIndex((prev) => prev + 1);
    }
  };

  const prevLine = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex((prev) => prev - 1);
    }
  };

  const renderLineWithVisibleSpaces = (line: string) => {
    if (!line) return <span className="text-slate-400 italic">[空行]</span>;

    const leadingSpacesMatch = line.match(/^(\s*)/);
    const leadingSpacesCount = leadingSpacesMatch
      ? leadingSpacesMatch[0].length
      : 0;
    const content = line.substring(leadingSpacesCount);

    return (
      <div className="flex items-center flex-wrap break-all w-full">
        <div className="flex select-none shrink-0">
          {Array.from({ length: leadingSpacesCount }).map((_, i) => (
            <span key={i} className="text-slate-600 font-mono text-xl mx-px">
              •
            </span>
          ))}
        </div>
        <span dangerouslySetInnerHTML={{ __html: highlightCode(content) }} />
      </div>
    );
  };

  const renderComplexity = (complexity: string | Complexity | undefined) => {
    if (!complexity) return null;
    if (typeof complexity === "string") {
      return (
        <p className="text-slate-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap dark:text-slate-400">
          {complexity}
        </p>
      );
    }
    if (typeof complexity === "object") {
      return (
        <div className="text-slate-600 text-xs md:text-sm leading-relaxed space-y-1 dark:text-slate-400">
          {complexity.time && (
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                时间复杂度:
              </span>{" "}
              {complexity.time}
            </div>
          )}
          {complexity.space && (
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                空间复杂度:
              </span>{" "}
              {complexity.space}
            </div>
          )}
          {!complexity.time && !complexity.space && JSON.stringify(complexity)}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* --- Transcription Overlay --- */}
      {isTranscriptionMode && (
        <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col pt-[env(safe-area-inset-top)] animate-fadeIn">
          <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
            <div className="flex flex-col">
              <span className="text-sm text-slate-400 font-medium uppercase tracking-wider">
                专注抄写模式
              </span>
              <span className="text-xs text-slate-500 mt-0.5">
                点 ( • ) 代表空格，请严格保持缩进
              </span>
            </div>
            <button
              onClick={exitTranscriptionMode}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center px-4 overflow-hidden relative">
            <div className="opacity-30 text-sm md:text-base font-mono mb-6 ml-2 select-none pointer-events-none truncate">
              {currentLineIndex > 0
                ? getCodeContent().split("\n")[currentLineIndex - 1]
                : ""}
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border-l-4 border-blue-500 shadow-2xl font-mono text-xl md:text-3xl leading-relaxed tracking-wide min-h-30 flex items-center">
              {renderLineWithVisibleSpaces(
                getCodeContent().split("\n")[currentLineIndex]
              )}
            </div>

            <div className="opacity-30 text-sm md:text-base font-mono mt-6 ml-2 select-none pointer-events-none truncate">
              {currentLineIndex < getCodeContent().split("\n").length - 1
                ? getCodeContent().split("\n")[currentLineIndex + 1]
                : ""}
            </div>
          </div>

          <div className="p-6 bg-slate-800 border-t border-slate-700 pb-10">
            <div className="flex justify-between items-center mb-4 text-slate-400 text-sm font-mono">
              <span>
                Line {currentLineIndex + 1} /{" "}
                {getCodeContent().split("\n").length}
              </span>
              <span className="text-xs uppercase">{selectedLanguage}</span>
            </div>

            <div className="flex space-x-4 h-16">
              <button
                onClick={prevLine}
                disabled={currentLineIndex === 0}
                className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all active:scale-95"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextLine}
                disabled={
                  currentLineIndex === getCodeContent().split("\n").length - 1
                }
                className="flex-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-30 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-900/50 transition-all active:scale-95"
              >
                下一行 <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Main Result Content --- */}
      <div className="flex flex-col h-full">
        {result ? (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full animate-fadeIn dark:bg-slate-900 dark:border-slate-800 transition-colors">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10 dark:bg-slate-900 dark:border-slate-800">
              <button
                onClick={() => setActiveTab("solution")}
                className={`flex-1 py-3 md:py-4 font-medium text-sm flex items-center justify-center transition-colors ${
                  activeTab === "solution"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:text-blue-400 dark:border-blue-400 dark:bg-blue-900/20"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Code className="w-4 h-4 mr-2" /> 代码方案
              </button>
              <button
                onClick={() => setActiveTab("analysis")}
                className={`flex-1 py-3 md:py-4 font-medium text-sm flex items-center justify-center transition-colors ${
                  activeTab === "analysis"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:text-blue-400 dark:border-blue-400 dark:bg-blue-900/20"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <BookOpen className="w-4 h-4 mr-2" /> 场景与考点
              </button>
              <button
                onClick={() => setActiveTab("visual_diff")}
                className={`flex-1 py-3 md:py-4 font-medium text-sm flex items-center justify-center transition-colors ${
                  activeTab === "visual_diff"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:text-blue-400 dark:border-blue-400 dark:bg-blue-900/20"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <ScanSearch className="w-4 h-4 mr-2" /> 拍照纠错
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950/50">
              {activeTab === "solution" && (
                <div className="space-y-4 md:space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    {/* Language Selector */}
                    <div className="relative">
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <option value="python">Python 3</option>
                        <option value="java">Java</option>
                        <option value="javascript">JavaScript</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={enterTranscriptionMode}
                        className="text-xs flex items-center text-white bg-indigo-600 hover:bg-indigo-700 font-medium px-3 py-1.5 rounded-full transition-colors shadow-sm"
                        title="进入专注抄写模式"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">抄写模式</span>
                      </button>

                      <button
                        onClick={() => copyToClipboard(getCodeContent())}
                        className="text-xs flex items-center text-blue-600 hover:text-blue-700 font-medium bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-full transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">复制</span>
                      </button>
                    </div>
                  </div>

                  {/* Code Preview */}
                  <div className="relative group">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none"></div>
                    <pre className="bg-slate-900 text-slate-100 p-4 md:p-5 rounded-xl overflow-x-auto text-xs md:text-sm font-mono leading-relaxed border border-slate-800 shadow-inner">
                      <code
                        dangerouslySetInnerHTML={{
                          __html: highlightCode(getCodeContent()),
                        }}
                      />
                    </pre>
                  </div>

                  <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors">
                    <h4 className="font-semibold text-slate-800 mb-3 flex items-center text-sm md:text-base dark:text-slate-100">
                      <Cpu className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />{" "}
                      复杂度分析
                    </h4>
                    {renderComplexity(result.complexity)}
                  </div>
                </div>
              )}

              {activeTab === "analysis" && (
                <div className="space-y-4 md:space-y-6">
                  {/* Scenario Summary */}
                  <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors">
                    <h4 className="font-semibold text-slate-800 mb-2 md:mb-3 text-base md:text-lg dark:text-slate-100">
                      场景摘要
                    </h4>
                    <p className="text-slate-600 leading-relaxed text-sm dark:text-slate-400">
                      {result.summary}
                    </p>
                  </div>

                  {/* Exam Points / Key Concepts */}
                  <div className="bg-violet-50 p-4 md:p-5 rounded-xl border border-violet-100 shadow-sm dark:bg-violet-900/10 dark:border-violet-900/30 transition-colors">
                    <h4 className="font-semibold text-violet-900 mb-2 md:mb-3 flex items-center text-sm md:text-base dark:text-violet-300">
                      <Lightbulb className="w-4 h-4 mr-2 text-violet-600 dark:text-violet-400" />{" "}
                      题目考点 & 难点
                    </h4>
                    {result.key_concepts &&
                    Array.isArray(result.key_concepts) ? (
                      <div className="space-y-2">
                        {result.key_concepts.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start text-sm text-violet-800 dark:text-violet-300/80"
                          >
                            <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-violet-400 rounded-full shrink-0"></span>
                            <span className="leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-violet-800 leading-relaxed dark:text-violet-300/80">
                        {result.key_concepts || "正在分析考点..."}
                      </p>
                    )}
                  </div>

                  {/* Constraints Module */}
                  <div className="bg-yellow-50 p-4 md:p-5 rounded-xl border border-yellow-100 shadow-sm dark:bg-yellow-900/10 dark:border-yellow-900/30 transition-colors">
                    <h4 className="font-semibold text-yellow-900 mb-2 md:mb-3 flex items-center text-sm md:text-base dark:text-yellow-300">
                      <Check className="w-4 h-4 mr-2" /> 关键约束 & 输入输出
                    </h4>
                    {Array.isArray(result.constraints) ? (
                      <ul className="space-y-2">
                        {result.constraints.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start text-sm text-yellow-800 dark:text-yellow-300/80"
                          >
                            <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0"></span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-yellow-800 whitespace-pre-wrap dark:text-yellow-300/80">
                        {result.constraints}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "visual_diff" && (
                <div className="space-y-4 md:space-y-6">
                  {/* --- Visual Diffing / Verification Panel --- */}
                  <VisualDiff referenceCode={getCodeContent()} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col justify-center text-slate-600 p-6 md:p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 min-h-75 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 transition-colors overflow-y-auto">
            <div className="max-w-xl mx-auto w-full py-4">
              <div className="flex items-center justify-center mb-6 md:mb-8 text-indigo-500 dark:text-indigo-400">
                <Lightbulb className="w-7 h-7 md:w-8 md:h-8 mr-2 md:mr-3" />
                <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">
                  使用指南
                </h3>
              </div>

              <div className="space-y-5 md:space-y-6 text-sm md:text-base">
                {/* 算力消耗 */}
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 md:p-2.5 rounded-lg md:rounded-xl text-blue-600 dark:text-blue-400 mr-3 md:mr-4 shrink-0 shadow-sm border border-blue-200/50 dark:border-blue-800/50">
                    <Zap className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      算力消耗标准
                    </h4>
                    <p className="leading-relaxed text-slate-500 dark:text-slate-400 text-xs md:text-sm">
                      Flash模型解题{" "}
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        10点
                      </span>{" "}
                      | Pro模型解题{" "}
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        30点
                      </span>{" "}
                      | 拍照纠错{" "}
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        5点
                      </span>
                    </p>
                  </div>
                </div>

                {/* 算力退还 */}
                <div className="flex items-start">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 md:p-2.5 rounded-lg md:rounded-xl text-green-600 dark:text-green-400 mr-3 md:mr-4 shrink-0 shadow-sm border border-green-200/50 dark:border-green-800/50">
                    <RefreshCw className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      算力扣费与退还
                    </h4>
                    <p className="leading-relaxed text-slate-500 dark:text-slate-400 text-xs md:text-sm">
                      若AI解题失败，系统将全额退还算力。您可以在右上角用户菜单中查看{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        算力明细
                      </span>
                      。如有异常请随时联系作者。
                    </p>
                  </div>
                </div>

                {/* 模型建议 */}
                <div className="flex items-start">
                  <div className="bg-violet-100 dark:bg-violet-900/30 p-2 md:p-2.5 rounded-lg md:rounded-xl text-violet-600 dark:text-violet-400 mr-3 md:mr-4 shrink-0 shadow-sm border border-violet-200/50 dark:border-violet-800/50">
                    <BrainCircuit className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      选择合适的模型
                    </h4>
                    <p className="leading-relaxed text-slate-500 dark:text-slate-400 text-xs md:text-sm">
                      Pro模型逻辑更强，适合复杂题目，但分析耗时稍长，敬请耐心等待。
                    </p>
                  </div>
                </div>

                {/* 纠错排查 */}
                <div className="flex items-start">
                  <div className="bg-rose-100 dark:bg-rose-900/30 p-2 md:p-2.5 rounded-lg md:rounded-xl text-rose-600 dark:text-rose-400 mr-3 md:mr-4 shrink-0 shadow-sm border border-rose-200/50 dark:border-rose-800/50">
                    <ScanSearch className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      遇到 Bug 了？
                    </h4>
                    <p className="leading-relaxed text-slate-500 dark:text-slate-400 text-xs md:text-sm">
                      代码抄完跑不通？推荐优先切换到{" "}
                      <span className="font-medium text-rose-600 dark:text-rose-400">
                        拍照纠错
                      </span>{" "}
                      面板，快速排查排版和代码手误。
                    </p>
                  </div>
                </div>

                {/* 会员与充值 */}
                <div className="flex items-start">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-2 md:p-2.5 rounded-lg md:rounded-xl text-amber-600 dark:text-amber-400 mr-3 md:mr-4 shrink-0 shadow-sm border border-amber-200/50 dark:border-amber-800/50">
                    <Clock className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      关于充值到账
                    </h4>
                    <p className="leading-relaxed text-slate-500 dark:text-slate-400 text-xs md:text-sm">
                      由于目前算力配额为人工手动发放，可能存在延迟。若遇紧急需求，可直接联系作者微信加急。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ResultDisplay;
