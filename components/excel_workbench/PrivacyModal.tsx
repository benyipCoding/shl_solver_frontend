import React from "react";
import { ShieldCheck, X } from "lucide-react";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiPayloadData: any;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onClose,
  aiPayloadData,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <h3 className="text-emerald-400 font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> 严格隐私模式验证
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 text-slate-300 text-sm">
          <p className="mb-4">
            我们郑重承诺不会发送您的整个文件。为了让 AI
            理解您的数据结构以编写处理逻辑，
            <span className="text-white font-bold bg-emerald-900/50 px-2 py-0.5 rounded ml-1">
              仅有以下极少量结构数据
            </span>{" "}
            会被作为上下文发送：
          </p>
          <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-700 shadow-inner">
            <pre className="text-xs leading-relaxed text-emerald-100 font-mono">
              {JSON.stringify(aiPayloadData, null, 2)}
            </pre>
          </div>
          <div className="mt-5 flex items-start gap-2 text-slate-400 bg-slate-700/20 p-3 rounded-lg">
            <span className="text-xl">💡</span>
            <p className="text-xs leading-relaxed">
              表格中的所有其余数据均完全在您设备的本地内存中处理。即使您在此刻断开计算机的网络连接，只要
              AI 代码已返回，庞大的数据处理依然可以瞬间完成。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
