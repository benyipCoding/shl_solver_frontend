import type {
  HistoryRecord,
  SheetSnapshot,
  SheetView,
  WorkbookCommand,
  WorkbookResult,
} from "../../interfaces/excel_workbench";
import { readWorkbook, readSheet, writeSheet } from "./excel-codec";
import { normalizeTransform } from "./workbook-model";
import { TRANSFORM_WORKER_SOURCE } from "./transform-runner";

type Version = { record: HistoryRecord; snapshot: SheetSnapshot };
type Session = { versions: Version[]; activeId: string };
let workbook: Awaited<ReturnType<typeof readWorkbook>> | null = null;
let original: { buffer: ArrayBuffer; fileName: string } | null = null;
const sessions = new Map<string, Session>();
let cancelTransform: (() => void) | null = null;
const MAX_VERSIONS = 12;

function version(
  snapshot: SheetSnapshot,
  title: string,
  explanation?: string,
  isOriginal = false,
): Version {
  return {
    snapshot,
    record: {
      id: crypto.randomUUID(),
      title,
      explanation,
      isOriginal,
      rowCount: snapshot.data.length,
      columnCount: snapshot.columns.length,
      timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    },
  };
}

function session(name: string): Session {
  if (!sessions.has(name)) {
    const sheet = workbook?.getWorksheet(name);
    if (!sheet) throw new Error("工作表不存在，请重新导入文件。");
    const initial = version(
      readSheet(sheet),
      `原始导入 · ${name}`,
      undefined,
      true,
    );
    sessions.set(name, { versions: [initial], activeId: initial.record.id });
  }
  return sessions.get(name)!;
}

function view(name: string): SheetView {
  const state = session(name);
  const active = state.versions.find((v) => v.record.id === state.activeId)!;
  return {
    sheetName: name,
    snapshot: active.snapshot,
    activeHistoryId: state.activeId,
    history: state.versions.map((v) => v.record),
  };
}

function execute(code: string, snapshot: SheetSnapshot): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([TRANSFORM_WORKER_SOURCE], { type: "application/javascript" }),
    );
    const task = new Worker(url);
    const cleanup = () => {
      clearTimeout(timer);
      task.terminate();
      URL.revokeObjectURL(url);
      cancelTransform = null;
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("计算超过 30 秒，已停止；原数据和历史记录已保留。"));
    }, 30_000);
    cancelTransform = () => {
      cleanup();
      reject(new Error("已取消处理，原数据未修改。"));
    };
    task.onmessage = ({ data }) => {
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    task.onerror = () => {
      cleanup();
      reject(new Error("计算线程异常，原数据未修改。"));
    };
    task.postMessage({ code, data: snapshot.data, columns: snapshot.columns });
  });
}

async function handle(command: WorkbookCommand): Promise<WorkbookResult> {
  switch (command.type) {
    case "import": {
      const loaded = await readWorkbook(command.buffer, command.fileName);
      workbook = loaded;
      original = { buffer: command.buffer, fileName: command.fileName };
      sessions.clear();
      const sheetNames = loaded.worksheets.map((sheet) => sheet.name);
      return { sheetNames, view: view(sheetNames[0]) };
    }
    case "select": {
      const state = session(command.sheetName);
      if (command.historyId) {
        if (!state.versions.some((v) => v.record.id === command.historyId))
          throw new Error("操作记录不存在。");
        state.activeId = command.historyId;
      }
      return { view: view(command.sheetName) };
    }
    case "deleteHistory": {
      const state = session(command.sheetName);
      state.versions = state.versions.filter(
        (v) => v.record.isOriginal || v.record.id !== command.historyId,
      );
      if (!state.versions.some((v) => v.record.id === state.activeId))
        state.activeId = state.versions[state.versions.length - 1].record.id;
      return { view: view(command.sheetName) };
    }
    case "transform": {
      const state = session(command.sheetName);
      const source = state.versions.find(
        (v) => v.record.id === command.historyId,
      );
      if (!source) throw new Error("原始操作记录不存在。");
      const result = await execute(command.code, source.snapshot);
      const snapshot = normalizeTransform(source.snapshot, result);
      const next = version(snapshot, command.title, command.explanation);
      state.versions.push(next);
      // Preserve the original plus the eleven most recent operations per sheet.
      if (state.versions.length > MAX_VERSIONS)
        state.versions.splice(1, state.versions.length - MAX_VERSIONS);
      state.activeId = next.record.id;
      return { view: view(command.sheetName) };
    }
    case "export": {
      if (!original) throw new Error("请先导入文件。");
      const output = await readWorkbook(original.buffer, original.fileName);
      for (const [name, state] of sessions) {
        const active = state.versions.find(
          (v) => v.record.id === state.activeId,
        )!;
        if (!active.record.isOriginal)
          writeSheet(output.getWorksheet(name)!, active.snapshot);
      }
      const bytes = await output.xlsx.writeBuffer();
      return { buffer: new Uint8Array(bytes).buffer };
    }
    case "cancel":
      cancelTransform?.();
      return {};
  }
}

self.onmessage = async (
  event: MessageEvent<{ id: number; command: WorkbookCommand }>,
) => {
  const { id, command } = event.data;
  try {
    const result = await handle(command);
    self.postMessage(
      { id, result },
      { transfer: result.buffer ? [result.buffer] : [] },
    );
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "工作簿处理失败。",
    });
  }
};
