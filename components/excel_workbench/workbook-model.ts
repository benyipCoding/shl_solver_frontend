import type {
  CellStyle,
  DataRow,
  SheetSnapshot,
  SheetStyles,
} from "../../interfaces/excel_workbench";

const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const dictionary = <T>(): Record<string, T> => Object.create(null);

export function sanitizeStyle(value: unknown): CellStyle {
  if (!object(value)) throw new Error("样式必须是对象。");
  const result: CellStyle = {};
  for (const key of ["backgroundColor", "color"] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(value[key]))
        throw new Error("颜色必须使用 #RRGGBB 格式。");
      result[key] = value[key];
    }
  }
  for (const key of ["bold", "italic", "underline"] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "boolean")
        throw new Error(`${key} 必须是布尔值。`);
      result[key] = value[key];
    }
  }
  if (value.fontSize !== undefined) {
    if (
      typeof value.fontSize !== "number" ||
      !Number.isFinite(value.fontSize) ||
      value.fontSize < 8 ||
      value.fontSize > 72
    )
      throw new Error("字号应在 8–72 之间。");
    result.fontSize = value.fontSize;
  }
  if (value.horizontalAlignment !== undefined) {
    if (
      !["left", "center", "right"].includes(String(value.horizontalAlignment))
    )
      throw new Error("不支持的对齐方式。");
    result.horizontalAlignment =
      value.horizontalAlignment as CellStyle["horizontalAlignment"];
  }
  if (value.numberFormat !== undefined) {
    if (
      typeof value.numberFormat !== "string" ||
      value.numberFormat.length > 128
    )
      throw new Error("数字格式无效。");
    result.numberFormat = value.numberFormat;
  }
  return result;
}

/** Merge style layers property by property; null explicitly clears a layer. */
function patchMap(
  base: Record<string, CellStyle> = {},
  patch: unknown,
  valid: (key: string) => boolean,
) {
  const result = dictionary<CellStyle>();
  if (patch === null) return result;
  for (const key of Object.keys(base)) if (valid(key)) result[key] = base[key];
  if (patch === undefined) return result;
  if (!object(patch)) throw new Error("样式映射格式不正确。");
  for (const key of Object.keys(patch)) {
    if (!valid(key)) throw new Error(`样式引用不存在的行或列：${key}`);
    if (patch[key] === null) delete result[key];
    else result[key] = { ...(result[key] || {}), ...sanitizeStyle(patch[key]) };
  }
  return result;
}

export function normalizeTransform(
  previous: SheetSnapshot,
  result: unknown,
): SheetSnapshot {
  if (!object(result) || !Array.isArray(result.data))
    throw new Error("AI 结果必须包含 data 数组。");
  let data = result.data as DataRow[];
  if (data.length > 1_048_575) throw new Error("数据超过 Excel 单表行数上限。");
  const keys = new Set<string>();
  for (const row of data) {
    if (!object(row)) throw new Error("每行数据必须是对象。");
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "boolean" &&
        (typeof value !== "number" || !Number.isFinite(value))
      )
        throw new Error("单元格只支持文本、有限数字、布尔值和 null。");
      keys.add(key);
    }
  }
  let columns: string[];
  if (result.columns !== undefined) {
    if (
      !Array.isArray(result.columns) ||
      result.columns.some((c) => typeof c !== "string") ||
      new Set(result.columns).size !== result.columns.length
    )
      throw new Error("columns 必须是不重复的列名数组。");
    columns = result.columns;
    const columnSet = new Set(columns);
    if ([...keys].some((key) => !columnSet.has(key)))
      throw new Error("columns 遗漏了结果数据中的列。");
  } else {
    const previousColumns = new Set(previous.columns);
    columns = [
      ...previous.columns,
      ...[...keys].filter((c) => !previousColumns.has(c)),
    ];
  }
  if (columns.length > 16_384) throw new Error("数据超过 Excel 单表列数上限。");
  const sourceRows = result.sourceRows;
  if (
    !Array.isArray(sourceRows) ||
    sourceRows.length !== data.length ||
    Array.from(sourceRows).some(
      (i) =>
        i !== null &&
        (!Number.isInteger(i) || i < 0 || i >= previous.data.length),
    )
  )
    throw new Error("sourceRows 行来源映射无效。");
  // Reuse unchanged row objects across versions instead of storing a complete
  // duplicate dataset for every formatting operation. Worker transfer has
  // already cloned the result, so no previous version is ever mutated here.
  data = data.map((row, index) => {
    const source = sourceRows[index];
    if (source === null) return row;
    const original = previous.data[source];
    const rowKeys = Object.keys(row);
    return rowKeys.length === Object.keys(original).length &&
      rowKeys.every((key) => own(original, key) && row[key] === original[key])
      ? original
      : row;
  });
  if (
    data.length === previous.data.length &&
    data.every((row, index) => row === previous.data[index])
  )
    data = previous.data;
  const base: SheetStyles = {
    ...previous.styles,
    rows: dictionary(),
    cells: dictionary(),
    importedCells: dictionary(),
  };
  sourceRows.forEach((source, index) => {
    if (source === null) return;
    if (previous.styles.rows?.[source])
      base.rows![index] = previous.styles.rows[source];
    if (previous.styles.cells?.[source])
      base.cells![index] = previous.styles.cells[source];
    if (previous.styles.importedCells?.[source])
      base.importedCells![index] = previous.styles.importedCells[source];
  });
  if (result.styles === null)
    return { data, columns, styles: {}, clearOriginalStyles: true };
  if (result.styles !== undefined && !object(result.styles))
    throw new Error("styles 格式不正确。");
  const patch = (result.styles || {}) as Record<string, unknown>;
  const columnSet = new Set(columns);
  const validColumn = (key: string) => columnSet.has(key);
  const validRow = (key: string) =>
    /^(0|[1-9]\d*)$/.test(key) && Number(key) < data.length;
  const styles: SheetStyles = {
    importedCells: base.importedCells,
    importedHeaderCells: base.importedHeaderCells,
    header:
      patch.header === null
        ? {}
        : {
            ...base.header,
            ...(patch.header === undefined ? {} : sanitizeStyle(patch.header)),
          },
    columns: patchMap(base.columns, patch.columns, validColumn),
    rows: patchMap(base.rows, patch.rows, validRow),
    headerCells: patchMap(base.headerCells, patch.headerCells, validColumn),
    cells: dictionary(),
  };
  if (patch.cells !== null) {
    if (patch.cells !== undefined && !object(patch.cells))
      throw new Error("单元格样式映射格式不正确。");
    const cellPatch = (patch.cells || {}) as Record<string, unknown>;
    const rowKeys = new Set([
      ...Object.keys(base.cells || {}),
      ...Object.keys(cellPatch),
    ]);
    for (const key of rowKeys) {
      if (!validRow(key)) throw new Error(`单元格样式引用不存在的行：${key}`);
      styles.cells![key] = patchMap(
        base.cells?.[key],
        own(cellPatch, key) ? cellPatch[key] : undefined,
        validColumn,
      );
    }
  }
  return {
    data,
    columns,
    styles,
    clearOriginalStyles: previous.clearOriginalStyles,
  };
}

export function resolveCellStyle(
  styles: SheetStyles,
  row: number,
  column: string,
): CellStyle {
  return row < 0
    ? {
        ...styles.importedHeaderCells?.[column],
        ...styles.header,
        ...styles.headerCells?.[column],
      }
    : {
        ...styles.importedCells?.[row]?.[column],
        ...styles.columns?.[column],
        ...styles.rows?.[row],
        ...styles.cells?.[row]?.[column],
      };
}

export const ROW_HEIGHT = 44;
export const COLUMN_WIDTH = 192;
export const ROW_HEADER_WIDTH = 80;
export const HEADER_HEIGHT = 48;

export function virtualRange(
  count: number,
  offset: number,
  size: number,
  itemSize: number,
  overscan = 3,
) {
  const start = Math.max(
    0,
    Math.min(count, Math.floor(Math.max(0, offset) / itemSize) - overscan),
  );
  const end = Math.max(
    start,
    Math.min(
      count,
      Math.ceil((Math.max(0, offset) + Math.max(0, size)) / itemSize) +
        overscan,
    ),
  );
  return { start, end };
}
