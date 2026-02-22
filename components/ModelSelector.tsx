"use client";
import React, { useMemo, useState } from "react";
import { Sparkles, ChevronDown, Bot, Check } from "lucide-react";
import { Model } from "@/interfaces/shl_solver";

type Props = {
  selectedModel: string;
  onSelectModel: (id: string) => void;
  models: Model[];
};

export default function ModelSelector({
  selectedModel,
  onSelectModel,
  models,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const currentModelName = useMemo(
    () => models.find((m) => m.key === selectedModel)?.name,
    [models, selectedModel]
  );

  return (
    <div className="relative flex-1 flex">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full transition-all group flex-1 justify-between sm:max-w-52"
      >
        <div className="p-1 bg-blue-100 rounded-full shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <span className="text-sm font-medium text-slate-700 truncate">
          {currentModelName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-10 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-20 animate-fade-in-up origin-top-right">
            <div className="px-3 py-2 border-b border-slate-50 mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                选择 AI 分析模型
              </p>
            </div>
            {models.map((model) => (
              <button
                key={model.key}
                onClick={() => {
                  onSelectModel(model.key);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-3 rounded-lg flex items-start space-x-3 cursor-pointer transition-colors ${
                  selectedModel === model.key
                    ? "bg-blue-50 ring-1 ring-blue-100"
                    : "hover:bg-slate-50"
                }`}
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                    selectedModel === model.key
                      ? "bg-blue-100 text-blue-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold truncate ${
                        selectedModel === model.key
                          ? "text-blue-900"
                          : "text-slate-700"
                      }`}
                    >
                      {model.name}
                    </span>
                    {selectedModel === model.key && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                    )}
                  </div>
                  <div className="flex items-center mt-1 space-x-2 overflow-hidden">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                      {model.tag}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {model.desc}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
