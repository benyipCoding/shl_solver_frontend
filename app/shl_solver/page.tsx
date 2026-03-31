"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  AlertCircle,
  ChevronDown,
  Sparkles,
  History as HistoryIcon,
  HeartHandshake,
  X,
  Coffee,
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
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await customFetch("/api/shl_history/unread_count", {}, true);
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, [customFetch]);

  useEffect(() => {
    fetchUnreadCount();
  }, [isHistoryOpen, fetchUnreadCount]);

  const pollTask = async (taskId: string) => {
    setLoading(true);
    let isCompleted = false;
    const pollDelay = 3000; // 每3秒查询一次

    while (!isCompleted) {
      // 如果本地存储的taskId变了或者被清空了，说明开启了新任务或重置了，则停止当前轮询
      const currentTaskId = sessionStorage.getItem("shl_task_id");
      if (currentTaskId !== taskId) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollDelay));
      try {
        const statusRes = await customFetch(
          `/api/shl_analyze/task/${taskId}`,
          {},
          true
        );
        const statusData = await statusRes.json();

        if (!statusRes.ok) {
          setError(
            `查询任务状态失败: ${statusData.error || statusRes.statusText}`
          );
          isCompleted = true;
          sessionStorage.removeItem("shl_task_id");
          sessionStorage.removeItem("shl_task_images");
          sessionStorage.removeItem("shl_task_model_id");
          setLoading(false);
          break;
        }

        if (
          statusData.status === "COMPLETED" ||
          statusData.status === "completed"
        ) {
          setResult(statusData.result);
          isCompleted = true;
          sessionStorage.removeItem("shl_task_id");
          sessionStorage.removeItem("shl_task_images");
          sessionStorage.removeItem("shl_task_model_id");
          setLoading(false);
        } else if (
          statusData.status === "FAILED" ||
          statusData.status === "failed"
        ) {
          setError(`分析失败: ${statusData.error || "发生了未知错误"}`);
          setResult(null);
          isCompleted = true;
          sessionStorage.removeItem("shl_task_id");
          sessionStorage.removeItem("shl_task_images");
          sessionStorage.removeItem("shl_task_model_id");
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Task Polling Error:", err);
      }
    }
  };

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
        setLoading(false);
        return;
      }

      // 如果返回了任务ID，则进入轮询
      if (data.task_id) {
        sessionStorage.setItem("shl_task_id", data.task_id);
        if (selectedModel) {
          sessionStorage.setItem("shl_task_model_id", String(selectedModel));
        }
        try {
          sessionStorage.setItem("shl_task_images", JSON.stringify(imagesData));
        } catch (e) {
          console.error("Failed to save images to sessionStorage", e);
        }
        pollTask(data.task_id);
      } else {
        // 如果后端依然同步返回结果
        setResult(data);
        setLoading(false);
      }
    } catch (error: any) {
      console.error("SHL Analysis Error:", error);
      setError("上传的截图有无法识别的内容");
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
      const savedModelId = sessionStorage.getItem("shl_task_model_id");
      if (savedModelId && models.some((m) => m.id === Number(savedModelId))) {
        setSelectedModel(Number(savedModelId));
      } else {
        setSelectedModel(models[0].id); // 默认选择第一个模型
      }
    }
  }, [models]);

  // 恢复之前的轮询状态
  useEffect(() => {
    const savedTaskId = sessionStorage.getItem("shl_task_id");
    if (savedTaskId) {
      const savedImagesStr = sessionStorage.getItem("shl_task_images");
      if (savedImagesStr) {
        try {
          const imagesData = JSON.parse(savedImagesStr) as ImageData[];
          const displayUrls = imagesData.map(
            (img) => `data:${img.mimeType || "image/jpeg"};base64,${img.data}`
          );
          dispatch(addImages({ previews: displayUrls, data: imagesData }));
        } catch (e) {
          console.error("Failed to restore images from sessionStorage", e);
        }
      }
      pollTask(savedTaskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拦截页面刷新或关闭（防止大模型分析期间误触）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading) {
        e.preventDefault();
        e.returnValue =
          "分析正在进行中，此时离开将丢失当前进度并且仍会消耗算力，确定要离开吗？";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [loading]);

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
          <div className="flex items-center w-full md:w-auto justify-end gap-2 md:gap-3">
            {/* Model Selector */}
            <div className="relative flex-1 md:flex-none md:w-60">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Sparkles className="h-4 w-4 text-indigo-500" />
              </div>
              <select
                value={String(selectedModel)}
                onChange={(e) => setSelectedModel(Number(e.target.value))}
                disabled={loading}
                className="w-full appearance-none pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:ring-blue-400"
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
              className="cursor-pointer shrink-0 relative group p-2 rounded-lg md:rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:shadow-md dark:text-indigo-300 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 transition-all border border-indigo-100 dark:border-indigo-800 ring-2 ring-transparent hover:ring-indigo-200 dark:hover:ring-indigo-800"
              title="查看历史记录"
            >
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold hidden md:inline-block">
                  历史记录
                </span>
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center">
                  <span className="relative flex justify-center items-center rounded-full w-6 h-6 text-xs font-bold text-white bg-red-500 border-2 border-white dark:border-slate-900 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </span>
              )}
            </button>

            {/* Login & Multi-image indicator */}
            <ThemeToggle />
            <button
              onClick={() => setShowSponsorModal(true)}
              className="flex shrink-0 items-center justify-center p-2 md:px-3 md:py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium rounded-lg md:rounded-xl transition-colors border border-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800"
              title="赞助"
            >
              <HeartHandshake className="w-5 h-5 md:w-3.5 md:h-3.5 md:mr-1" />
              <span className="text-xs md:text-sm hidden md:inline">赞助</span>
            </button>
            <UserHeaderActions simpleMode={true} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8 w-full flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full flex-1">
          {/* Left Column: Image Uploader */}
          <ImageUploader
            onAnalyze={analyzeProblem}
            onClearResult={() => {
              sessionStorage.removeItem("shl_task_id");
              sessionStorage.removeItem("shl_task_images");
              sessionStorage.removeItem("shl_task_model_id");
              setResult(null);
              setIsHistoryView(false); // Clear history view when result cleared
            }}
            loading={loading}
            selectedModelName={
              models.find((m) => m.id === selectedModel)?.name.split(" ")[2] ||
              "AI"
            }
            isHistoryView={isHistoryView || !!result}
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

      {/* Sponsor Modal */}
      {showSponsorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          {/* Overlay Click to Close */}
          <div
            className="absolute inset-0"
            onClick={() => setShowSponsorModal(false)}
          ></div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative transition-colors z-10">
            <button
              onClick={() => setShowSponsorModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-5 md:p-8 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 text-rose-500 dark:text-rose-400 shadow-inner">
                <Coffee className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 mb-1 md:mb-2">
                请作者喝杯咖啡 ☕
              </h3>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 md:mb-6">
                如果这个工具帮助到了您，欢迎随缘打赏。
                <br />
                <span className="text-rose-600 dark:text-white font-bold">
                  如果充值算力请务必打赏时备注账号邮箱
                </span>
                ，以便核对。🙏
              </p>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 p-2 md:p-3 rounded-lg mb-4 md:mb-6 border border-indigo-100 dark:border-indigo-800/50 text-sm font-medium">
                💡 充值标准：10元 = 100点算力
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 md:p-6 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 md:mb-6 w-full">
                <div className="flex flex-row items-center justify-center gap-3 md:gap-8">
                  {/* Alipay */}
                  <div className="flex flex-col items-center space-y-2 md:space-y-3 group">
                    <div className="relative p-1.5 md:p-2 bg-white rounded-lg md:rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 transition-transform hover:-translate-y-1 duration-300">
                      <img
                        src="/sponsor/alipay.png"
                        alt="支付宝打赏"
                        className="w-28 h-28 md:w-44 md:h-44 object-contain rounded-md md:rounded-lg"
                      />
                      <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/10 rounded-lg md:rounded-xl transition-colors pointer-events-none"></div>
                    </div>
                    <div className="flex items-center space-x-1 px-2 py-0.5 md:px-3 md:py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[10px] md:text-xs font-bold text-blue-600 dark:text-blue-400">
                        支付宝
                      </span>
                    </div>
                  </div>

                  {/* Divider for mobile - Removed in favor of row layout */}
                  {/* <div className="w-full h-px bg-slate-200 dark:bg-slate-700 md:hidden"></div> */}

                  {/* WeChat */}
                  <div className="flex flex-col items-center space-y-2 md:space-y-3 group">
                    <div className="relative p-1.5 md:p-2 bg-white rounded-lg md:rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 transition-transform hover:-translate-y-1 duration-300">
                      <img
                        src="/sponsor/wechat.png"
                        alt="微信打赏"
                        className="w-28 h-28 md:w-44 md:h-44 object-contain rounded-md md:rounded-lg"
                      />
                      <div className="absolute inset-0 border-2 border-green-500/0 group-hover:border-green-500/10 rounded-lg md:rounded-xl transition-colors pointer-events-none"></div>
                    </div>
                    <div className="flex items-center space-x-1 px-2 py-0.5 md:px-3 md:py-1 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-100 dark:border-green-800">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[10px] md:text-xs font-bold text-green-600 dark:text-green-400">
                        微信
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs font-bold text-rose-500 dark:text-rose-400">
                ❤️ 感谢您的鼓励与支持！
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SHLSolverPage;
