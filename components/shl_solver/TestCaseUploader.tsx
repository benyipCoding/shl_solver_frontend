"use client";

import Image from "next/image";
import React, { useMemo, useRef, useState } from "react";
// trigger update
import {
  AlertCircle,
  FileImage,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ImageData } from "@/interfaces/shl_solver";
import { compressImage } from "@/utils/helpers";

interface TestCaseUploaderProps {
  imageData: ImageData | null;
  previewUrl?: string | null;
  onChange: (image: ImageData | null) => void;
  loading?: boolean;
  isHistoryView?: boolean;
}

const passthroughImageLoader = ({ src }: { src: string }) => src;

const TestCaseUploader: React.FC<TestCaseUploaderProps> = ({
  imageData,
  previewUrl = null,
  onChange,
  loading = false,
  isHistoryView = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewSrc = useMemo(() => {
    if (imageData) {
      return `data:${imageData.mimeType || "image/jpeg"};base64,${imageData.data}`;
    }

    return previewUrl;
  }, [imageData, previewUrl]);

  const isBusy = loading || isCompressing;
  const isUploadedImage = Boolean(imageData);

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isBusy) return;
    onChange(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFiles = async (filesRaw: FileList | File[]) => {
    if (isBusy || !filesRaw || filesRaw.length === 0) return;

    const files = Array.from(filesRaw);
    const validFiles = files.filter((file) => file.type.startsWith("image/"));

    if (validFiles.length === 0) {
      setError("请上传有效的图片文件 (JPG, PNG)");
      return;
    }

    if (validFiles.length > 1) {
      setError("测试用例仅支持 1 张图片，已自动使用第一张。");
    } else {
      setError(null);
    }

    const file = validFiles[0];
    setIsCompressing(true);

    try {
      const compressedFile = await compressImage(file);
      const nextImageData = await new Promise<ImageData>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === "string") {
            resolve({
              mimeType: compressedFile.type || file.type || "image/jpeg",
              data: reader.result.split(",")[1],
            });
            return;
          }
          reject(new Error("File reading failed"));
        };
        reader.onerror = () => reject(new Error("File reading failed"));
        reader.readAsDataURL(compressedFile);
      });
      onChange(nextImageData);
    } catch (uploadError) {
      setError("测试用例图片处理失败，请重试。");
      console.error("Test case image processing error:", uploadError);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />

      {!previewSrc ? (
        <div
          onClick={() => {
            if (!isHistoryView && !isBusy) fileInputRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!isHistoryView && e.dataTransfer.files)
              processFiles(e.dataTransfer.files);
          }}
          className={`h-full border-2 border-dashed border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-center md:justify-between text-center md:text-left transition-all relative overflow-hidden bg-indigo-50/30 dark:bg-slate-900/50 ${
            isHistoryView
              ? "cursor-default opacity-80"
              : isBusy
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/80 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/40 group"
          }`}
        >
          {isCompressing && !isHistoryView && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex flex-col items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                优化中...
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 mb-3 sm:mb-0">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2.5 rounded-full text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
              <FileImage className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-indigo-900 dark:text-indigo-200 text-sm md:text-base flex items-center justify-center sm:justify-start">
                {isHistoryView ? "无测试用例" : "补充测试用例 (可选)"}
              </h4>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 mt-1 max-w-[16rem] md:max-w-xs leading-relaxed">
                {isHistoryView
                  ? "该历史记录没有附带测试用例"
                  : "用实际输入输出截图替换题干中过期的 Example"}
              </p>
            </div>
          </div>

          {!isHistoryView && (
            <div className="hidden sm:flex items-center text-indigo-500 dark:text-indigo-400 text-sm font-medium">
              <Upload className="w-4 h-4 mr-1.5" /> 上传
            </div>
          )}
        </div>
      ) : (
        <div className="h-full bg-white dark:bg-slate-900 rounded-2xl p-3 md:p-4 border border-indigo-100 dark:border-indigo-800 shadow-sm relative overflow-hidden transition-colors flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-4 group">
          {isCompressing && !isHistoryView && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex flex-col items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          )}

          <div
            className="w-full sm:w-28 h-20 md:h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 shrink-0 cursor-pointer relative"
            onClick={() => {
              if (isHistoryView) {
                setEnlargedImage(previewSrc);
              } else if (!isBusy) {
                fileInputRef.current?.click();
              }
            }}
          >
            <Image
              loader={passthroughImageLoader}
              src={previewSrc || ""}
              alt="测试用例预览"
              width={160}
              height={160}
              unoptimized
              className={`w-full h-full object-cover transition-opacity ${isHistoryView ? "hover:opacity-90" : "group-hover:opacity-60"}`}
            />
            {!isHistoryView && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Upload className="text-white w-6 h-6 drop-shadow-md" />
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {isHistoryView ? "历史测试用例" : "已附加测试用例"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isHistoryView
                ? "点击图片可放大查看"
                : "分析时将优先参考此图的输入输出"}
            </p>
          </div>

          {!isHistoryView && (
            <button
              onClick={handleClear}
              disabled={isBusy}
              className={`shrink-0 p-2 md:p-2.5 rounded-xl transition-colors ${
                isBusy
                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              }`}
              title="移除测试用例"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {error && !isHistoryView && (
        <div className="mt-2 flex items-start rounded-xl border border-red-100 bg-red-50 p-3 text-xs md:text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
          <AlertCircle className="mr-2 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setEnlargedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-red-400 bg-black/50 p-2 rounded-full transition-colors z-50"
            onClick={(e) => {
              e.stopPropagation();
              setEnlargedImage(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={enlargedImage}
            alt="放大预览"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default TestCaseUploader;
