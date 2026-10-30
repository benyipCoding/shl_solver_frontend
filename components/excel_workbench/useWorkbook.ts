import { useCallback, useEffect, useRef } from "react";
import type {
  WorkbookCommand,
  WorkbookResult,
} from "@/interfaces/excel_workbench";

export function useWorkbook() {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const pending = useRef(
    new Map<
      number,
      {
        resolve: (result: WorkbookResult) => void;
        reject: (error: Error) => void;
      }
    >(),
  );
  const dispose = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    for (const request of pending.current.values())
      request.reject(new Error("工作簿已关闭。"));
    pending.current.clear();
  }, []);
  useEffect(() => dispose, [dispose]);

  const request = useCallback(
    (command: WorkbookCommand): Promise<WorkbookResult> => {
      if (!worker.current) {
        worker.current = new Worker(
          new URL("./workbook.worker.ts", import.meta.url),
        );
        worker.current.onmessage = ({ data }) => {
          const handler = pending.current.get(data.id);
          pending.current.delete(data.id);
          if (data.error) handler?.reject(new Error(data.error));
          else handler?.resolve(data.result);
        };
        worker.current.onerror = () => {
          for (const handler of pending.current.values())
            handler.reject(new Error("工作簿线程异常，请重新导入文件。"));
          pending.current.clear();
          worker.current?.terminate();
          worker.current = null;
        };
      }
      return new Promise((resolve, reject) => {
        const id = ++sequence.current;
        pending.current.set(id, { resolve, reject });
        worker.current!.postMessage(
          { id, command },
          command.type === "import" ? [command.buffer] : [],
        );
      });
    },
    [],
  );
  return { request, dispose };
}
