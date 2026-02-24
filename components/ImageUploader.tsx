"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  ImageIcon,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Cpu,
  BookOpen,
} from "lucide-react";
import { ImageData } from "@/interfaces/shl_solver";
import { compressImage } from "@/utils/helpers";

interface ImageUploaderProps {
  onAnalyze: (imagesData: ImageData[]) => void;
  onClearResult: () => void;
  loading: boolean;
  selectedModelName: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onAnalyze,
  onClearResult,
  loading,
  selectedModelName,
}) => {
  const [images, setImages] = useState<string[]>([]); // Array of preview URLs
  const [imagesData, setImagesData] = useState<ImageData[]>([]); // Array of { mimeType, data } objects
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) filesToProcess.push(blob);
      }
    }
    if (filesToProcess.length > 0) {
      processFiles(filesToProcess);
    }
  };

  const processFiles = async (filesRaw: FileList | File[]) => {
    if (!filesRaw || filesRaw.length === 0) return;

    const files = Array.from(filesRaw);
    const validFiles = files.filter((file) => file.type.startsWith("image/"));

    if (validFiles.length === 0 && files.length > 0) {
      setError("请上传有效的图片文件 (JPG, PNG)");
      return;
    }

    if (validFiles.length < files.length) {
      setError("部分非图片文件已被自动过滤。");
    } else {
      setError(null);
    }

    setIsCompressing(true);

    const readPromises = validFiles.map((file) => {
      return new Promise<{ preview: string; data: string; mimeType: string }>(
        async (resolve, reject) => {
          try {
            const compressedFile = await compressImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
              if (reader.result && typeof reader.result === "string") {
                resolve({
                  preview: reader.result,
                  data: reader.result.split(",")[1],
                  mimeType: compressedFile.type,
                });
              } else {
                reject(new Error("File reading failed"));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(compressedFile);
          } catch (error) {
            reject(error);
          }
        }
      );
    });

    try {
      const results = await Promise.all(readPromises);
      setImages((prev) => [...prev, ...results.map((r) => r.preview)]);
      setImagesData((prev) => [
        ...prev,
        ...results.map((r) => ({ mimeType: r.mimeType, data: r.data })),
      ]);
      onClearResult();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setError("读取文件时出错，请重试。");
      console.error("File reading error:", e);
    } finally {
      setIsCompressing(false);
    }
  };

  const clearAllImages = () => {
    setImages([]);
    setImagesData([]);
    setError(null);
    onClearResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagesData((prev) => prev.filter((_, i) => i !== index));
    onClearResult();
  };

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        multiple
      />

      {images.length === 0 ? (
        <div
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 dark:hover:border-blue-500 dark:hover:bg-blue-900/10 transition-all cursor-pointer bg-white dark:bg-slate-900 shadow-sm touch-manipulation flex-1 relative overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {isCompressing && (
            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 z-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                正在优化图片...
              </p>
            </div>
          )}
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4">
            <Upload className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-base md:text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
            上传题目图片
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs leading-relaxed">
            点击上传，或直接{" "}
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Ctrl+V
            </span>{" "}
            粘贴
          </p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors text-sm md:text-base w-full md:w-auto shadow-md">
            选择多张图片
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative animate-fadeIn flex-1 flex flex-col transition-colors">
          {isCompressing && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                正在优化图片...
              </p>
            </div>
          )}
          <div className="p-3 md:p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center text-sm md:text-base">
              <ImageIcon className="w-4 h-4 mr-2" /> 已上传 {images.length}{" "}
              张图片
            </h3>
            <button
              onClick={clearAllImages}
              className="text-slate-400 hover:text-red-500 transition-colors flex items-center text-xs md:text-sm font-medium p-2"
            >
              <Trash2 className="w-4 h-4 mr-1" /> 清空
            </button>
          </div>

          <div className="p-3 md:p-4 bg-slate-100 dark:bg-slate-950 flex flex-col space-y-3 md:space-y-4 max-h-[40vh] md:max-h-[50vh] overflow-y-auto flex-1">
            {images.map((imgSrc, index) => (
              <div
                key={index}
                className="relative group rounded-lg shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-full transition-colors"
              >
                <img
                  src={imgSrc}
                  alt={`Problem part ${index + 1}`}
                  className="w-full object-contain max-h-48 md:max-h-64 lg:max-h-full bg-slate-50 dark:bg-slate-950"
                />
                <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => removeImage(index)}
                    className="bg-white/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full shadow-sm hover:shadow-md transition-all backdrop-blur-sm"
                    title="移除此图片"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] md:text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                  Part {index + 1}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3 transition-colors">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 dashed-border text-sm md:text-base"
            >
              <Plus className="w-4 h-4 mr-2" /> 继续添加 / 粘贴
            </button>
            <button
              onClick={() => onAnalyze(imagesData)}
              disabled={loading}
              className={`w-full py-3 rounded-xl font-bold text-base md:text-lg flex items-center justify-center shadow-md transition-all ${
                loading
                  ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                  : "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-lg"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  正在使用 {selectedModelName} 分析...
                </>
              ) : (
                <>
                  <Cpu className="w-5 h-5 mr-2" />
                  开始组合分析
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start border border-red-100 animate-fadeIn text-sm md:text-base dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400">
          <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!loading && images.length === 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 md:p-5 dark:bg-indigo-900/10 dark:border-indigo-900/30">
          <h4 className="font-semibold text-indigo-900 mb-3 flex items-center text-sm md:text-base dark:text-indigo-300">
            <BookOpen className="w-4 h-4 mr-2" /> 使用技巧
          </h4>
          <ul className="space-y-2 text-xs md:text-sm text-indigo-800 dark:text-indigo-300/80">
            <li className="flex items-start">
              <span className="mr-2">•</span>{" "}
              <span className="font-semibold">多页题目：</span>
              题目太长可分段截图，依次上传。
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>{" "}
              <span className="font-semibold">顺序重要：</span>AI
              会按上传顺序理解上下文。
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>{" "}
              <span className="font-semibold">移动端：</span>
              支持直接拍照或从相册选择。
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
