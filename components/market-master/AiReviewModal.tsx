import React from "react";
import { Bot, X } from "lucide-react";

export const AiReviewModal = ({
  aiReviewModal,
  setAiReviewModal,
  priceDecimals,
}: any) => {
  if (!aiReviewModal.visible) return null;

  return (
    <div className="fixed inset-0 z-120 bg-black/60 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-120 p-0 overflow-hidden flex flex-col">
        <div className="bg-linear-to-r from-indigo-900/50 to-purple-900/50 p-4 border-b border-gray-700 flex justify-between items-center">
          <span className="font-bold text-white tracking-wider flex items-center gap-2">
            <Bot size={18} className="text-indigo-400" /> {aiReviewModal.title}
          </span>
          <button
            onClick={() =>
              setAiReviewModal({
                visible: false,
                trade: null,
                text: "",
                loading: false,
              })
            }
            className="text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          {aiReviewModal.type === "single" && aiReviewModal.trade && (
            <div className="flex gap-4 mb-4 text-sm bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
              <div>
                <span className="text-gray-500 block text-xs mb-1">
                  交易方向
                </span>
                <span
                  className={`font-bold ${
                    aiReviewModal.trade.type === "Buy"
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {aiReviewModal.trade.type}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs mb-1">开仓价</span>
                <span className="text-gray-200">
                  {aiReviewModal.trade.entry.toFixed(priceDecimals)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs mb-1">平仓价</span>
                <span className="text-gray-200">
                  {aiReviewModal.trade.closePrice.toFixed(priceDecimals)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs mb-1">
                  最终盈亏
                </span>
                <span
                  className={`font-bold ${
                    aiReviewModal.trade.pnl > 0
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {aiReviewModal.trade.pnl > 0 ? "+" : ""}
                  {aiReviewModal.trade.pnl.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="min-h-35 bg-gray-950 rounded-lg p-4 border border-gray-800 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {aiReviewModal.loading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3 opacity-70 mt-6">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-indigo-400 text-xs animate-pulse">
                  {aiReviewModal.type === "profile"
                    ? "AI 正在调取近期历史记录提取您的行为特征..."
                    : aiReviewModal.type === "insight"
                      ? "AI 视觉引擎正在扫描 K 线图表形态与关键阻力支撑..."
                      : "AI 正在调取图表数据与技术指标深度分析中..."}
                </span>
              </div>
            ) : (
              aiReviewModal.text
            )}
          </div>
        </div>
        <div className="p-3 border-t border-gray-800 bg-gray-800/50 flex justify-end">
          <button
            onClick={() =>
              setAiReviewModal({
                visible: false,
                trade: null,
                text: "",
                loading: false,
              })
            }
            className="px-5 py-1.5 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-900/50"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
