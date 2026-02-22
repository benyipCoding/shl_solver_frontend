"use client";
import { useEffect, useState } from "react";
import {
  Cpu,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  X,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import {
  AnalysisResult,
  ImageData,
  Model,
  SHLAnalysisPayload,
} from "@/interfaces/home";
import ImageUploader from "@/components/ImageUploader";
import ResultDisplay from "@/components/ResultDisplay";
import UserHeaderActions from "@/components/UserHeaderActions";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

const Home = () => {
  const { login } = useAuth();
  const [models, setModels] = useState<Model[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<number | null>(null); // Default to null

  const analyzeProblem = async (imagesData: ImageData[]) => {
    if (imagesData.length === 0) return;
    try {
      setLoading(true);
      setError(null);

      const payload: SHLAnalysisPayload = {
        images_data: imagesData,
        llmId: Number(selectedModel),
      };

      const res = await fetch("/api/shl_analyze", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(`SHL分析失败: ${data.error || res.statusText}`);
        return;
      }
      setResult(data);
    } catch (error) {
      setError(`SHL分析失败: ${error || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  // 获取llms列表
  const fetchLLMs = async () => {
    try {
      const res = await fetch("/api/llms");
      const data = await res.json();
      if (!res.ok) {
        console.error("获取LLMs失败:", data.error || res.statusText);
        toast.error("获取LLMs失败: " + (data.error || res.statusText));
        return;
      }

      setModels(data.filter((m: Model) => m.enabled));
    } catch (error) {
      console.error("获取LLMs失败:", error);
      toast.error("获取LLMs失败: " + (error || "未知错误"));
    }
  };

  const getMe = async () => {
    try {
      const res = await fetch("/api/user/me");
      if (!res.ok) {
        throw new Error(`获取用户信息失败: ${res.statusText}`);
      }
      const data = await res.json();
      login(data);
      return;
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  useEffect(() => {
    getMe();
    fetchLLMs();
  }, []);

  useEffect(() => {
    if (models.length > 0) {
      setSelectedModel(models[0].id); // 默认选择第一个模型
    }
  }, [models]);

  // --- Main Home View ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 pb-10 relative flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-top shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
          {/* Logo Title */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
                <Cpu className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">
                  SHL Scenario Solver
                </h1>
                <p className="text-[10px] md:text-xs text-slate-500 hidden sm:block">
                  业务场景算法题辅助工具
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Model Selector & Features */}
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-3 w-full md:w-auto">
            {/* Model Selector */}
            <div className="relative w-full md:w-auto flex-1 md:flex-none">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Sparkles className="h-4 w-4 text-indigo-500" />
              </div>
              <select
                value={String(selectedModel)}
                onChange={(e) => setSelectedModel(Number(e.target.value))}
                className="w-full md:w-60 appearance-none pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors cursor-pointer"
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

            {/* Login & Multi-image indicator */}
            <UserHeaderActions />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8 w-full flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full flex-1 lg:max-h-[calc(100vh-10.7rem)] lg:overflow-y-auto">
          {/* Left Column: Image Uploader */}
          <ImageUploader
            onAnalyze={analyzeProblem}
            onClearResult={() => setResult(null)}
            loading={loading}
            selectedModelName={
              models.find((m) => m.id === selectedModel)?.name.split(" ")[2] ||
              "AI"
            }
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

export default Home;
