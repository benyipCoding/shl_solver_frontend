import { useEffect, useRef } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { TransformRequest } from "@/interfaces/excel_workbench";

export function PrivacyModal({
  isOpen,
  onClose,
  aiPayloadData,
}: {
  isOpen: boolean;
  onClose: () => void;
  aiPayloadData: TransformRequest;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [isOpen]);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[85vh] w-[min(640px,92vw)] overflow-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-700 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          发送给 AI 的内容
        </h2>
        <button aria-label="关闭隐私说明" onClick={onClose}>
          <X className="h-5 w-5 text-slate-400" />
        </button>
      </div>
      <div className="space-y-4 p-5 text-base leading-6">
        <p>
          AI
          会收到你的指令、当前工作表列名和首行示例。首行可能包含真实业务信息，请在发送前确认内容。
        </p>
        <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-base dark:bg-slate-950">
          {JSON.stringify(aiPayloadData, null, 2)}
        </pre>
        <p className="text-base text-slate-400">
          完整工作簿不会上传。返回的处理逻辑在浏览器后台线程运行，数据与样式保存在本次页面会话中；关闭或刷新前请导出工作簿。
        </p>
      </div>
    </dialog>
  );
}
