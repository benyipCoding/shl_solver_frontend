"use client";
import React from "react";
import { X } from "lucide-react";
import { HomeFeature } from "@/constants/ai_doctor";

type Props = {
  feature: HomeFeature;
  onClose: () => void;
};

export default function FeatureModal({ feature, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 overflow-hidden transform transition-all animate-fade-in-up border border-slate-100 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`p-4 rounded-full ${feature.bgColor} mb-4`}>
            <feature.icon className={`w-8 h-8 ${feature.iconColor}`} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            {feature.title}
          </h3>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-6">
            {feature.detailTitle}
          </p>

          <div className="text-left bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl w-full text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line border border-slate-100 dark:border-slate-800">
            {feature.detailContent}
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-200 py-3 rounded-xl font-medium transition-colors"
          >
            了解
          </button>
        </div>
      </div>
    </div>
  );
}
