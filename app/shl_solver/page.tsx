"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, AlertCircle, ChevronDown, Sparkles } from "lucide-react";
import {
  AnalysisResult,
  ImageData,
  Model,
  SHLAnalysisPayload,
} from "@/interfaces/shl_solver";
import ImageUploader from "@/components/ImageUploader";
import ResultDisplay from "@/components/ResultDisplay";
import UserHeaderActions from "@/components/UserHeaderActions";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/context/FetchContext";
import { fetchLLMs } from "@/utils/helpers";

const SHLSolverPage = () => {
  const { login } = useAuth();
  const { customFetch } = useFetch();
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
    } catch (error) {
      setError(`SHL分析失败: ${error || "未知错误"}`);
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 pb-10 relative flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-top shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
          {/* Logo Title */}
          <div className="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-3">
              <Link href="/" className="bg-blue-600 p-2 rounded-lg shadow-sm">
                <Cpu className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </Link>
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
          <div className="flex items-center space-y-2 md:space-y-0 md:space-x-3 w-full md:w-auto">
            {/* Model Selector */}
            <div className="relative w-full md:w-auto flex-1 md:flex-none mb-0">
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

export default SHLSolverPage;
