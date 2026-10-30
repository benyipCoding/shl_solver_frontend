// A disposable worker keeps generated calculations away from the UI and allows
// cancellation/timeouts without destroying the workbook and its history.
export const TRANSFORM_WORKER_SOURCE = `
self.onmessage = async ({ data: payload }) => {
  try {
    const source = new WeakMap(payload.data.map((row, index) => [row, index]));
    const context = { columns: payload.columns, sourceIndex: row => source.get(row) ?? null };
    const execute = new Function("data", "context", '"use strict";\\n' + payload.code + '\\nreturn transform(data, context);');
    const value = await execute(payload.data, context);
    const result = Array.isArray(value) ? { data: value } : value;
    if (!result || !Array.isArray(result.data)) throw new Error("处理结果必须包含 data 数组。");
    if (result.sourceRows === undefined) result.sourceRows = result.data.map(row => source.get(row) ?? null);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
`;
