"use client";
import React, { useState } from "react";
import {
  AlertCircle,
  HeartPulse,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import AbnormalityCard from "./AbnormalityCard";
import { AnalyzeResponseData } from "@/interfaces/ai_doctor";

interface ResultAreaProps {
  result: AnalyzeResponseData;
  explanationStyle: "simple" | "professional";
  currentModelName: string;
  resetAnalysis: () => void;
}

const ResultArea: React.FC<ResultAreaProps> = ({
  result,
  explanationStyle,
  currentModelName,
  resetAnalysis,
}) => {
  const getScoreColor = (score: number) => {
    if (!score && score !== 0)
      return {
        text: "text-slate-400",
        border: "border-slate-200",
        bg: "bg-slate-50",
      };
    if (score >= 90)
      return {
        text: "text-green-600",
        border: "border-green-500",
        bg: "bg-green-50",
      };
    if (score >= 80)
      return {
        text: "text-blue-600",
        border: "border-blue-500",
        bg: "bg-blue-50",
      };
    if (score >= 60)
      return {
        text: "text-orange-500",
        border: "border-orange-400",
        bg: "bg-orange-50",
      };
    return { text: "text-red-600", border: "border-red-500", bg: "bg-red-50" };
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      {/* 头部：报告概览与评分 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 border-l-4 border-blue-500">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              {result.reportType || "化验报告"}
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2 mt-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                解读报告
              </h2>
              <span className="text-xs text-slate-400 font-mono mt-1 sm:mt-0 flex items-center">
                by {currentModelName}
                <span className="mx-1">•</span>
                {explanationStyle === "simple" ? "通俗模式" : "专业模式"}
              </span>
            </div>
          </div>
          <button
            onClick={resetAnalysis}
            className="text-slate-400 hover:text-blue-600 text-sm underline shrink-0 ml-2"
          >
            重新上传
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* 评分展示环 */}
          <div className="shrink-0">
            <div
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border-[6px] shadow-sm ${getScoreColor(result.healthScore!).border} ${getScoreColor(result.healthScore!).bg}`}
            >
              <span
                className={`text-4xl font-extrabold ${getScoreColor(result.healthScore!).text}`}
              >
                {result.healthScore ?? "-"}
              </span>
              <span className="text-xs text-slate-500 font-medium mt-1">
                健康评分
              </span>
            </div>
          </div>

          {/* 概览文字 */}
          <div className="flex-1 w-full">
            <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg text-sm sm:text-base">
              <span className="font-semibold text-slate-800">总体评价：</span>
              {result.summary}
            </p>

            {/* 正常指标计数 */}
            <div className="mt-3 flex items-center text-sm text-green-600 px-1">
              <ShieldCheck className="w-4 h-4 mr-1 shrink-0" />
              <span>检测到 {result.normalCount || 0} 项指标处于正常范围</span>
            </div>
          </div>
        </div>
      </div>

      {/* 异常项列表 (核心功能) */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center px-1">
          <AlertCircle className="w-5 h-5 text-orange-500 mr-2 shrink-0" />
          需关注的指标 ({result.abnormalities?.length || 0})
        </h3>

        {!result.abnormalities || result.abnormalities.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700">
            <HeartPulse className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">未发现明显异常指标</p>
            <p className="text-sm opacity-80 mt-1">
              恭喜！您的健康评分应该是 100 分，请继续保持！
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {result.abnormalities.map((item, index) => (
              <AbnormalityCard key={index} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* 底部醒目免责声明 */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-sm text-orange-900 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0 text-orange-600 mt-0.5" />
          <div className="space-y-2">
            <h4 className="font-bold text-lg text-orange-800">免责声明</h4>

            <div className="space-y-2 opacity-90 text-sm">
              <p className="leading-relaxed">
                <strong>1. 非医疗诊断工具：</strong> 本结果基于 AI 技术生成，
                <strong>绝非医疗诊断建议</strong>。AI
                可能会产生识别错误或幻觉，切勿仅凭此报告调整用药或治疗方案。
              </p>
              <p className="leading-relaxed">
                <strong>2. 结果仅供参考：</strong>{" "}
                分析内容仅用于辅助理解化验单术语，所有指标解读请以医院出具的正式纸质报告及专业持证医生的诊断为准。
              </p>
              <p className="leading-relaxed">
                <strong>3. 隐私与数据：</strong>{" "}
                图片上传仅用于当次即时分析，系统不会在服务器上永久存储您的个人医疗数据。建议您在上传前自行遮挡姓名、身份证号等敏感隐私信息。
              </p>
              <p className="leading-relaxed font-bold text-orange-800 pt-1">
                ⚠️
                若您感觉身体不适或症状加重，请立即前往正规医院就诊或拨打急救电话。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultArea;
