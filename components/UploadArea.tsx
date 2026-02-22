"use client";
import React from "react";
import { Upload, Camera } from "lucide-react";
import { HomeFeature } from "@/constants/ai_doctor";

type Props = {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerFile: () => void;
  features: HomeFeature[];
  onFeatureClick: (f: HomeFeature) => void;
};

export default function UploadArea({
  fileInputRef,
  onFileChange,
  onTriggerFile,
  features,
  onFeatureClick,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-blue-200 p-6 sm:p-10 text-center transition-all hover:border-blue-400">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 rounded-full flex items-center justify-center mb-2">
          <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold text-slate-700">
          上传化验单照片
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-sm mx-auto">
          支持血常规、生化检查等各类纸质报告。AI 将自动提取指标并为您解读。
        </p>
        <button
          onClick={onTriggerFile}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 sm:px-8 sm:py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center text-sm sm:text-base"
        >
          <Upload className="w-5 h-5 mr-2" />
          选择照片
        </button>
      </div>

      {/* 特性介绍按钮栏 */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {features.map((feature) => (
          <button
            key={feature.id}
            onClick={() => onFeatureClick(feature)}
            className="flex flex-col items-center p-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors group cursor-pointer border border-transparent hover:border-slate-100"
          >
            <div
              className={`p-2 rounded-lg mb-2 ${feature.bgColor} group-hover:scale-110 transition-transform`}
            >
              <feature.icon
                className={`w-5 h-5 sm:w-6 sm:h-6 ${feature.iconColor}`}
              />
            </div>
            <span className="text-sm font-medium text-slate-700">
              {feature.title}
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              {feature.shortDesc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
