"use client";
import React, { useState } from "react";

import {
  AlertCircle,
  HeartPulse,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Abnormality } from "@/interfaces/ai_doctor";

interface AbnormalityCardProps {
  item: Abnormality;
}

const AbnormalityCard: React.FC<AbnormalityCardProps> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);

  // 根据状态决定颜色
  const isHigh = item.status.includes("高") || item.status.includes("阳");
  const colorClass = isHigh
    ? "text-red-600 bg-red-50 border-red-100"
    : "text-orange-600 bg-orange-50 border-orange-100";
  const badgeClass = isHigh
    ? "bg-red-100 text-red-700"
    : "bg-orange-100 text-orange-700";

  return (
    <div
      className={`rounded-xl border shadow-sm bg-white overflow-hidden transition-all ${expanded ? "ring-2 ring-blue-100" : ""}`}
    >
      {/* 卡片头部 - 点击展开 */}
      <div
        className="p-4 sm:p-5 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0 pr-2">
          {/* 标题行: Flex wrap 处理 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <h4 className="text-lg font-bold text-slate-900 truncate max-w-full">
              {item.name}
            </h4>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${badgeClass}`}
            >
              {item.status}
            </span>
          </div>

          {/* 数值行: 移动端换行，桌面端一行 */}
          <div className="text-sm text-slate-500 font-mono mt-1">
            <div className="flex flex-col sm:flex-row sm:items-baseline">
              <span className="truncate">
                当前值:{" "}
                <span className="font-bold text-slate-700">{item.value}</span>
              </span>
              <span className="hidden sm:inline mx-2 text-slate-300">|</span>
              <span className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-0 truncate">
                参考值: {item.reference}
              </span>
            </div>
          </div>
        </div>
        <div className="text-slate-400 shrink-0">
          {expanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* 展开的详细内容 */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-5 pt-0 animate-fade-in space-y-4">
          <hr className="border-slate-100 mb-4" />

          {/* 通俗解释 */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              指标解读
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">
              {item.explanation}
            </p>
          </div>

          {/* 潜在诱因 */}
          <div className="bg-yellow-50/80 p-3 rounded-lg border border-yellow-100">
            <div className="flex items-center text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">
              <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
              可能诱因 (生活/饮食习惯)
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">
              {item.possibleCauses || "AI 未能分析出具体诱因，请咨询医生。"}
            </p>
          </div>

          {/* 潜在风险 */}
          <div className="bg-red-50/50 p-3 rounded-lg border border-red-50">
            <div className="flex items-center text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
              <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
              可能引起的问题 / 关联疾病
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">
              {item.consequence}
            </p>
          </div>

          {/* 健康建议 */}
          <div className="bg-green-50/50 p-3 rounded-lg border border-green-50">
            <div className="flex items-center text-xs font-bold text-green-600 uppercase tracking-wider mb-1">
              <HeartPulse className="w-3 h-3 mr-1 shrink-0" />
              健康建议
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">
              {item.advice}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbnormalityCard;
