"use client";
import {
  X,
  AlertCircle,
  MessageCircle,
  BookOpen,
  Loader2,
  Activity,
} from "lucide-react";

type Props = {
  image: string;
  onReset: () => void;
  error: string | null;
  explanationStyle: "simple" | "professional";
  setExplanationStyle: (s: "simple" | "professional") => void;
  onAnalyze: () => void;
  loading: boolean;
  currentModelName?: string;
};

export default function PreviewArea({
  image,
  onReset,
  error,
  explanationStyle,
  setExplanationStyle,
  onAnalyze,
  loading,
  currentModelName,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden animate-fade-in">
      <div className="relative">
        <img
          src={image}
          alt="Preview"
          className="w-full max-h-80 sm:max-h-96 object-contain bg-slate-900"
        />
        <button
          onClick={onReset}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start text-sm">
            <AlertCircle className="w-5 h-5 mr-2 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-medium text-slate-800">准备就绪</h3>
            <p className="text-slate-500 text-sm mt-1">
              正在使用{" "}
              <span className="font-semibold text-blue-600">
                {currentModelName}
              </span>
            </p>
          </div>

          <div className="bg-slate-100 p-1 rounded-xl flex w-full max-w-sm">
            <button
              onClick={() => setExplanationStyle("simple")}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                explanationStyle === "simple"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:bg-slate-200/50"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>通俗易懂</span>
            </button>
            <button
              onClick={() => setExplanationStyle("professional")}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                explanationStyle === "professional"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:bg-slate-200/50"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>专业深度</span>
            </button>
          </div>

          <button
            onClick={onAnalyze}
            disabled={loading}
            className={`w-full max-w-sm mx-auto px-6 py-3 rounded-xl font-semibold text-white shadow-md transition-all flex items-center justify-center ${
              loading
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                正在分析中...
              </>
            ) : (
              <>
                <Activity className="w-5 h-5 mr-2" />
                开始智能解读
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
