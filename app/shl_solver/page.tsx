"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  AlertCircle,
  ChevronDown,
  Sparkles,
  History as HistoryIcon,
} from "lucide-react";
import {
  AnalysisResult,
  ImageData,
  Model,
  SHLAnalysisPayload,
} from "@/interfaces/shl_solver";
import ImageUploader from "@/components/shl_solver/ImageUploader";
import ResultDisplay from "@/components/shl_solver/ResultDisplay";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/context/FetchContext";
import { fetchLLMs } from "@/utils/helpers";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import HistoryDrawer from "@/components/shl_solver/HistoryDrawer";
import { SHLSolverHistoryItem } from "@/interfaces/history";
import { useAppDispatch } from "@/store/hooks";
import { addImages, clearImages } from "@/store/features/shlSlice";

const SHLSolverPage = () => {
  const { login } = useAuth();
  const { customFetch } = useFetch();
  const dispatch = useAppDispatch();
  const [models, setModels] = useState<Model[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<number | null>(null); // Default to null
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false); // Track if viewing history

  const analyzeProblem = async (imagesData: ImageData[]) => {
    if (imagesData.length === 0) return;
    try {
      setLoading(true);
      setError(null);
      setIsHistoryView(false); // Reset history view on new analysis

      const payload: SHLAnalysisPayload = {
        images_data: imagesData,
        llmId: Number(selectedModel),
      };

      const res = await customFetch(
        "/api/shl_analyze",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        true
      );

      const data = await res.json();

      if (!res.ok) {
        setError(`SHL分析失败: ${data.error || res.statusText}`);
        return;
      }
      setResult(data);
    } catch (error: any) {
      console.error("SHL Analysis Error:", error);
      setError("上传的截图有无法识别的内容，可以参考历史记录里的图片");
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (item: SHLSolverHistoryItem) => {
    // 1. Set the result for display
    if (item.result_json) {
      setResult(item.result_json);
    } else {
      setResult(null);
      if (item.status === "failed") {
        setError(item.error_message || "History item marked as failed.");
      }
    }

    // 2. Load images into the uploader (preview only)
    dispatch(clearImages());
    if (item.image_urls && item.image_urls.length > 0) {
      const urls = item.image_urls.filter((url: string) => url.trim() !== "");
      if (urls.length > 0) {
        // Prepend /uploads/ if not present and if it's not a full URL (http)
        const displayUrls = urls.map((url) => {
          if (url.startsWith("http") || url.startsWith("/uploads/")) {
            return url;
          }
          return `/uploads/${url}`;
        });
        // Pass empty data array since we don't have base64 for re-analysis, just previews
        dispatch(addImages({ previews: displayUrls, data: [] }));
      }
    }

    // 3. Set model if available (optional, just for UI consistency)
    if (item.model) {
      const modelObj = models.find((m) => m.name === item.model);
      if (modelObj) setSelectedModel(modelObj.id);
    }

    setIsHistoryView(true); // Flag as history view
    setIsHistoryOpen(false);
  };

  useEffect(() => {
    fetchLLMs().then((data) => {
      if (data) {
        setModels(data);
      }
    });
  }, []);

  useEffect(() => {
    if (models.length > 0) {
      setSelectedModel(models[0].id); // 默认选择第一个模型
    }
  }, [models]);

  // --- Main SHLSolverPage View ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-blue-900 pb-10 relative flex flex-col transition-colors duration-300">
      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelect={handleHistorySelect}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-top shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
          {/* Logo Title */}
          <div className="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-3">
              <Link
                href="/"
                className="bg-blue-600 p-2 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
              >
                <Cpu className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </Link>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-tight dark:text-slate-100">
                  SHL Scenario Solver
                </h1>
                <p className="text-[10px] md:text-xs text-slate-500 hidden sm:block dark:text-slate-400">
                  业务场景算法题辅助工具
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Model Selector & Features */}
          <div className="flex items-center space-y-2 md:space-y-0 md:space-x-3 w-full md:w-auto justify-end gap-3">
            {/* Model Selector */}
            <div className="relative w-full md:w-auto flex-1 md:flex-none mb-0">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Sparkles className="h-4 w-4 text-indigo-500" />
              </div>
              <select
                value={String(selectedModel)}
                onChange={(e) => setSelectedModel(Number(e.target.value))}
                className="w-full md:w-60 appearance-none pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:ring-blue-400"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* History Toggle Button */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="cursor-pointer m-0 relative group p-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:shadow-md dark:text-indigo-300 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 transition-all border border-indigo-100 dark:border-indigo-800 ring-2 ring-transparent hover:ring-indigo-200 dark:hover:ring-indigo-800"
              title="查看历史记录"
            >
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold hidden md:inline-block">
                  历史记录
                </span>
              </div>
              {/* <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"></span>
              </span> */}
            </button>

            {/* Login & Multi-image indicator */}
            <ThemeToggle />
            <UserHeaderActions simpleMode={false} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8 w-full flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full flex-1 lg:max-h-[calc(100vh-10.7rem)] lg:overflow-y-auto">
          {/* Left Column: Image Uploader */}
          <ImageUploader
            onAnalyze={analyzeProblem}
            onClearResult={() => {
              setResult(null);
              setIsHistoryView(false); // Clear history view when result cleared
            }}
            loading={loading}
            selectedModelName={
              models.find((m) => m.id === selectedModel)?.name.split(" ")[2] ||
              "AI"
            }
            isHistoryView={isHistoryView}
          />

          {/* Right Column: Result Display */}
          <ResultDisplay result={result} />
        </div>

        {/* Global API Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 text-red-700 p-4 rounded-xl flex items-start border border-red-100 animate-fadeIn text-sm md:text-base">
            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SHLSolverPage;
