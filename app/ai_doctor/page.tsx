"use client";
import React, { useState, useRef, useEffect } from "react";
import ModelSelector from "@/components/ModelSelector";
import UploadArea from "@/components/UploadArea";
import { Activity } from "lucide-react";
import FeatureModal from "@/components/FeatureModal";
import PreviewArea from "@/components/PreviewArea";
import ResultArea from "@/components/ResultArea";
import { useRouter } from "next/navigation";
import {
  AnalyzePayload,
  AnalyzeResponse,
  AnalyzeResponseData,
} from "@/interfaces/ai_doctor";
import { features, HomeFeature } from "@/constants/ai_doctor";
import UserHeaderActions from "@/components/UserHeaderActions";
import { fetchLLMs } from "@/utils/helpers";
import { useFetch } from "@/context/FetchContext";
import Link from "next/link";

export default function Home() {
  const [image, setImage] = useState<string | ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [models, setModels] = useState<any[]>([]); // 可用模型列表
  const { customFetch } = useFetch();

  const router = useRouter();
  // --- 模型选择状态 ---
  const [selectedModel, setSelectedModel] = useState("");

  // --- 解读风格状态 ---
  const [explanationStyle, setExplanationStyle] = useState<
    "simple" | "professional"
  >("simple"); // simple | professional

  // --- 首页特性弹窗状态 (新增) ---
  const [activeFeature, setActiveFeature] = useState<HomeFeature | null>(null);

  const currentModelName = models.find((m) => m.key === selectedModel)?.name;

  // 处理图片上传
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 重置状态
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 触发文件选择
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const analyzeImage = async () => {
    setLoading(true);
    // 去除 Base64 前缀
    const base64Data = (image as string).split(",")[1];
    const mimeType = (image as string).split(";")[0].split(":")[1];

    const payload: AnalyzePayload = {
      explanationStyle,
      mimeType: mimeType,
      data: base64Data,
      llmKey: selectedModel,
    };

    try {
      const res = await customFetch(
        "/api/ai_doctor",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        true
      );

      const response: AnalyzeResponse = await res.json();
      if (response.error) {
        setError(response.error);
        return;
      }

      const data = response.data;
      if (!data) {
        setError(response.message || "无法从 AI 获取响应");
        return;
      }
      setResult(data);
    } catch (error) {
      console.log(error);
      setError("分析过程中发生错误，请稍后重试或检查网络。");
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setImage(null);
    setResult(null);
    setError(null);
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
      setSelectedModel(models[0].key); // 默认选择第一个模型
    }
  }, [models]);

  return (
    <div
      className="min-h-screen bg-slate-50 font-sans text-slate-800"
      style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
    >
      {/* 顶部导航 - 适配移动端宽度 */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Link href="/" className="bg-blue-600 p-2 rounded-lg shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </Link>
            {/* 小屏显示简短标题，大屏显示完整标题 */}
            <h1 className="text-lg font-bold text-slate-900 hidden sm:block">
              智能验单助手
            </h1>
            <h1 className="text-lg font-bold text-slate-900 sm:hidden">
              验单助手
            </h1>
          </div>

          {/* 模型选择器 */}
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              models={models}
            />
            <UserHeaderActions simpleMode={true} />
          </div>
        </div>
      </header>

      {/* main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 1. 上传区域 */}
        {!image && (
          <UploadArea
            fileInputRef={fileInputRef}
            onFileChange={handleImageUpload}
            onTriggerFile={triggerFileInput}
            features={features}
            onFeatureClick={setActiveFeature}
          />
        )}

        {/* 2. 预览与分析控制区域 */}
        {image && !result && (
          <PreviewArea
            image={image as string}
            onReset={resetAnalysis}
            error={error}
            explanationStyle={explanationStyle as "simple" | "professional"}
            setExplanationStyle={(s) => setExplanationStyle(s)}
            onAnalyze={analyzeImage}
            loading={loading}
            currentModelName={currentModelName}
          />
        )}

        {/* 3. 分析结果展示区域 */}
        {result && (
          <ResultArea
            result={result}
            explanationStyle={explanationStyle}
            currentModelName={currentModelName}
            resetAnalysis={resetAnalysis}
          />
        )}
      </main>

      {/* 特性详情弹窗 Modal */}
      {activeFeature && (
        <FeatureModal
          feature={activeFeature}
          onClose={() => setActiveFeature(null)}
        />
      )}
    </div>
  );
}
