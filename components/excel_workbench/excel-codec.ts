import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import type {
  CellStyle,
  CellValue,
  DataRow,
  SheetSnapshot,
} from "../../interfaces/excel_workbench";
import { resolveCellStyle } from "./workbook-model";

// ExcelJS exposes sparse row models at runtime but omits rows from WorksheetModel's declaration.
type SparseSheetModel = ExcelJS.WorksheetModel & {
  rows: { number: number; cells: { address: string }[] }[];
};
const storedRows = (sheet: ExcelJS.Worksheet) =>
  (sheet.model as SparseSheetModel).rows;

function color(value: Partial<ExcelJS.Color> | undefined): string | undefined {
  return value?.argb && /^[0-9a-f]{8}$/i.test(value.argb)
    ? `#${value.argb.slice(2)}`
    : undefined;
}

function readStyle(cell: ExcelJS.Cell): CellStyle {
  const style: CellStyle = {};
  const fill = cell.fill;
  if (
    fill?.type === "pattern" &&
    fill.pattern === "solid" &&
    color(fill.fgColor)
  )
    style.backgroundColor = color(fill.fgColor);
  if (color(cell.font?.color)) style.color = color(cell.font.color);
  for (const key of ["bold", "italic"] as const)
    if (cell.font?.[key] !== undefined) style[key] = cell.font[key];
  if (cell.font?.underline !== undefined)
    style.underline = Boolean(cell.font.underline);
  if (cell.font?.size) style.fontSize = cell.font.size;
  const alignment = cell.alignment?.horizontal;
  if (alignment === "left" || alignment === "center" || alignment === "right")
    style.horizontalAlignment = alignment;
  if (cell.numFmt && cell.numFmt !== "General")
    style.numberFormat = cell.numFmt;
  return style;
}

function scalar(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  )
    return value;
  if ("result" in value) return scalar(value.result);
  if ("richText" in value)
    return value.richText.map((part) => part.text).join("");
  if ("text" in value) return value.text;
  if ("error" in value) return value.error;
  return null;
}

export async function readWorkbook(buffer: ArrayBuffer, fileName: string) {
  const workbook = new ExcelJS.Workbook();
  if (/\.xlsx$/i.test(fileName)) {
    await workbook.xlsx.load(buffer);
  } else {
    const legacy = XLSX.read(buffer, { type: "array", cellDates: true });
    for (const name of legacy.SheetNames) {
      const sheet = workbook.addWorksheet(name);
      const rows = XLSX.utils.sheet_to_json<ExcelJS.CellValue[]>(
        legacy.Sheets[name],
        { header: 1, defval: null, raw: true, blankrows: true },
      );
      rows.forEach((row) => sheet.addRow(row));
    }
  }
  if (!workbook.worksheets.length) workbook.addWorksheet("Sheet1");
  return workbook;
}

export function readSheet(sheet: ExcelJS.Worksheet): SheetSnapshot {
  const columns: string[] = [];
  const used = new Set<string>();
  const columnCount = sheet.columnCount;
  for (let c = 1; c <= columnCount; c++) {
    const label = String(scalar(sheet.getCell(1, c).value) ?? `未命名列 ${c}`);
    let key = label;
    let suffix = 2;
    while (used.has(key)) key = `${label}_${suffix++}`;
    columns.push(key);
    used.add(key);
  }
  const snapshot: SheetSnapshot = {
    data: [],
    columns,
    styles: {
      importedCells: Object.create(null),
      importedHeaderCells: Object.create(null),
    },
  };
  const models = new Map(storedRows(sheet).map((row) => [row.number, row]));
  for (const model of models.get(1)?.cells || []) {
    const cell = sheet.getCell(model.address);
    const style = readStyle(cell);
    if (Object.keys(style).length)
      snapshot.styles.importedHeaderCells![columns[Number(cell.col) - 1]] =
        style;
  }
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row: DataRow = Object.create(null);
    const styles: Record<string, CellStyle> = Object.create(null);
    // Sparse rows stay sparse: a far-right cell must not allocate thousands of empty values.
    for (const model of models.get(r)?.cells || []) {
      const cell = sheet.getCell(model.address);
      const column = columns[Number(cell.col) - 1];
      row[column] = scalar(cell.value);
      const style = readStyle(cell);
      if (Object.keys(style).length) styles[column] = style;
    }
    snapshot.data.push(row);
    if (Object.keys(styles).length)
      snapshot.styles.importedCells![r - 2] = styles;
  }
  return snapshot;
}

export function applyStyle(cell: ExcelJS.Cell, style: CellStyle) {
  if (style.backgroundColor)
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${style.backgroundColor.slice(1).toUpperCase()}` },
    };
  const font: Partial<ExcelJS.Font> = { ...cell.font };
  if (style.color)
    font.color = { argb: `FF${style.color.slice(1).toUpperCase()}` };
  if (style.bold !== undefined) font.bold = style.bold;
  if (style.italic !== undefined) font.italic = style.italic;
  if (style.underline !== undefined) font.underline = style.underline;
  if (style.fontSize !== undefined) font.size = style.fontSize;
  cell.font = font;
  if (style.horizontalAlignment)
    cell.alignment = {
      ...cell.alignment,
      horizontal: style.horizontalAlignment,
    };
  if (style.numberFormat) cell.numFmt = style.numberFormat;
}

/** Edited sheets are normalized tables; untouched worksheets keep their original workbook models. */
export function writeSheet(sheet: ExcelJS.Worksheet, snapshot: SheetSnapshot) {
  const initial = readSheet(sheet);
  const sameData =
    initial.columns.length === snapshot.columns.length &&
    initial.columns.every((column, c) => column === snapshot.columns[c]) &&
    initial.data.length === snapshot.data.length &&
    initial.data.every((row, r) => {
      const keys = new Set([
        ...Object.keys(row),
        ...Object.keys(snapshot.data[r]),
      ]);
      return [...keys].every(
        (column) =>
          (row[column] ?? null) === (snapshot.data[r][column] ?? null),
      );
    });
  if (!sameData) {
    const merges = [...(sheet.model.merges || [])];
    merges.forEach((range) => sheet.unMergeCells(range));
    // Clearing cell values alone leaves empty row records in the exported XML.
    // Reset the table's rows and stale ranges so filtered/deleted rows stay deleted.
    const normalizedModel = {
      ...sheet.model,
      rows: [],
      mergeCells: [],
      tables: [],
      conditionalFormattings: [],
      dataValidations: {},
    };
    sheet.model = normalizedModel;
    sheet.columns = snapshot.columns.map((header) => ({ header, width: 22 }));
    sheet.autoFilter = undefined;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  } else if (snapshot.clearOriginalStyles) {
    // Otherwise keep native theme colors, borders and other untouched Excel formatting.
    for (const row of storedRows(sheet))
      for (const model of row.cells) {
        sheet.getCell(model.address).style = {};
      }
  }
  snapshot.columns.forEach((column, c) =>
    applyStyle(
      sheet.getCell(1, c + 1),
      resolveCellStyle(snapshot.styles, -1, column),
    ),
  );
  const columnIndex = new Map(snapshot.columns.map((name, c) => [name, c + 1]));
  const columnStyles = Object.keys(snapshot.styles.columns || {});
  snapshot.data.forEach((row, r) => {
    const keys = snapshot.styles.rows?.[r]
      ? snapshot.columns
      : new Set([
          ...Object.keys(row),
          ...columnStyles,
          ...Object.keys(snapshot.styles.cells?.[r] || {}),
          ...Object.keys(snapshot.styles.importedCells?.[r] || {}),
        ]);
    for (const column of keys) {
      const c = columnIndex.get(column);
      if (!c) continue;
      const cell = sheet.getCell(r + 2, c);
      if (!sameData) cell.value = row[column] ?? null;
      applyStyle(cell, resolveCellStyle(snapshot.styles, r, column));
    }
  });
}
