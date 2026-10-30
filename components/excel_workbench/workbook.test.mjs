import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import ExcelJS from "exceljs";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const {
  normalizeTransform,
  resolveCellStyle,
  virtualRange,
} = require("./workbook-model.ts");
const { readWorkbook, readSheet, writeSheet } = require("./excel-codec.ts");
const { TRANSFORM_WORKER_SOURCE } = require("./transform-runner.ts");
const original = () => ({
  columns: ["姓名", "销售额", "空列"],
  data: [
    { 姓名: "甲", 销售额: 20000 },
    { 姓名: "乙", 销售额: 500 },
  ],
  styles: {},
});

async function execute(snapshot, code) {
  let output;
  const self = {
    postMessage: (value) => {
      output = value;
    },
  };
  vm.runInNewContext(TRANSFORM_WORKER_SOURCE, { self });
  await self.onmessage({ data: { ...structuredClone(snapshot), code } });
  if (output.error) throw new Error(output.error);
  return normalizeTransform(snapshot, output.result);
}

test("conditional red + bold styles apply without changing data, including blank cells", async () => {
  const base = original();
  const result = await execute(
    base,
    `function transform(data, ctx) { const rows = {}; data.forEach((row,i) => { if (row.销售额 > 10000) rows[i] = {backgroundColor:'#FF0000',bold:true}; }); return { data, columns:ctx.columns, styles:{rows} }; }`,
  );
  assert.deepEqual(result.data, base.data);
  assert.equal(
    result.data,
    base.data,
    "style-only history reuses immutable data",
  );
  assert.deepEqual(result.columns, base.columns);
  assert.equal(
    resolveCellStyle(result.styles, 0, "空列").backgroundColor,
    "#FF0000",
  );
  assert.equal(resolveCellStyle(result.styles, 1, "姓名").bold, undefined);
  assert.deepEqual(base.styles, {}, "history source is immutable");
});

test("sort/filter/clone mappings carry formats with data and cell overrides beat row styles", async () => {
  const base = original();
  base.styles = {
    rows: { 0: { bold: true } },
    cells: { 0: { 销售额: { color: "#FF0000" } } },
  };
  const sorted = await execute(
    base,
    `function transform(data,ctx) { const output=data.slice().reverse(); return {data:output.map(r=>({...r,销售额:r.销售额+1})), columns:ctx.columns, sourceRows:output.map(r=>ctx.sourceIndex(r))}; }`,
  );
  assert.equal(resolveCellStyle(sorted.styles, 1, "销售额").bold, true);
  assert.equal(resolveCellStyle(sorted.styles, 0, "销售额").bold, undefined);
  const result = normalizeTransform(sorted, {
    data: sorted.data,
    sourceRows: [0, 1],
    styles: {
      rows: { 1: { backgroundColor: "#FFFF00" } },
      cells: { 1: { 销售额: { bold: false } } },
    },
  });
  assert.deepEqual(resolveCellStyle(result.styles, 1, "销售额"), {
    bold: false,
    color: "#FF0000",
    backgroundColor: "#FFFF00",
  });
});

test("empty results retain headers, mock data works, old array responses remain supported", async () => {
  assert.deepEqual(
    (await execute(original(), "function transform(data) { return []; }"))
      .columns,
    original().columns,
  );
  const generated = await execute(
    { data: [], columns: [], styles: {} },
    "function transform() { return [{姓名:'新员工',金额:42}]; }",
  );
  assert.equal(generated.data.length, 1);
  assert.deepEqual(generated.columns, ["姓名", "金额"]);
});

test("invalid styles, rows and data fail atomically; style reset preserves values", () => {
  const base = original();
  for (const styles of [
    { rows: { 9: { bold: true } } },
    { columns: { 不存在: { bold: true } } },
    { rows: { 0: { backgroundColor: "url(https://example.com)" } } },
    { header: { fontSize: 1000 } },
  ])
    assert.throws(() =>
      normalizeTransform(base, { data: base.data, sourceRows: [0, 1], styles }),
    );
  assert.throws(() =>
    normalizeTransform(base, {
      data: [{ 金额: Infinity }],
      sourceRows: [null],
    }),
  );
  assert.throws(() =>
    normalizeTransform(base, { data: base.data, sourceRows: [999, 0] }),
  );
  assert.deepEqual(
    normalizeTransform(base, {
      data: base.data,
      sourceRows: [0, 1],
      styles: null,
    }).styles,
    {},
  );
});

test("virtual windows stay bounded for a million rows and 16,384 columns", () => {
  const rows = virtualRange(1_048_575, 36 * 900_000, 700, 36, 6);
  const columns = virtualRange(16_384, 176 * 10_000, 1200, 176, 2);
  assert.ok(rows.end - rows.start <= 33);
  assert.ok(columns.end - columns.start <= 12);
  assert.ok(rows.start < 900_000 && rows.end > 900_000);
  assert.deepEqual(virtualRange(0, 0, 500, 36), { start: 0, end: 0 });
});

test("XLSX round trip keeps types, all sheets, colored blanks, formulas and font styles", async () => {
  const book = new ExcelJS.Workbook();
  const first = book.addWorksheet("销售");
  first.addRow(["姓名", "销售额", "空列"]);
  first.addRow(["甲", { formula: "10000*2", result: 20000 }, null]);
  first.addRow(["乙", 500, null]);
  first.getColumn(1).width = 30;
  first.getCell("C3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00FF00" },
  };
  book.addWorksheet("备注").getCell("A1").value = "保留我";
  const snapshot = readSheet(first);
  assert.equal(snapshot.data[0].销售额, 20000);
  assert.equal(
    resolveCellStyle(snapshot.styles, 1, "空列").backgroundColor,
    "#00FF00",
  );
  const modified = normalizeTransform(snapshot, {
    data: snapshot.data,
    columns: snapshot.columns,
    sourceRows: [0, 1],
    styles: {
      header: { backgroundColor: "#047857", color: "#FFFFFF", bold: true },
      rows: { 0: { backgroundColor: "#FF0000", bold: true } },
      columns: { 销售额: { numberFormat: "#,##0.00" } },
    },
  });
  writeSheet(first, modified);
  const bytes = await book.xlsx.writeBuffer();
  const loaded = await readWorkbook(bytes, "styles.xlsx");
  const sheet = loaded.getWorksheet("销售");
  assert.equal(loaded.worksheets.length, 2);
  assert.equal(loaded.getWorksheet("备注").getCell("A1").value, "保留我");
  assert.equal(sheet.getCell("B2").formula, "10000*2");
  assert.equal(sheet.getColumn(1).width, 30);
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
  assert.equal(sheet.getCell("C2").fill.fgColor.argb, "FFFF0000");
  assert.equal(sheet.getCell("C2").font.bold, true);
  assert.equal(sheet.getCell("C3").fill.fgColor.argb, "FF00FF00");
  assert.equal(sheet.getCell("A1").font.color.argb, "FFFFFFFF");
});

test("style reset and structural data edits do not leave stale cells", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Sheet1");
  sheet.addRows([
    ["姓名", "金额"],
    ["甲", 20],
    ["乙", 50],
  ]);
  sheet.getCell("A2").font = { bold: true };
  let snapshot = readSheet(sheet);
  snapshot = normalizeTransform(snapshot, {
    data: snapshot.data,
    sourceRows: [0, 1],
    styles: null,
  });
  writeSheet(sheet, snapshot);
  assert.equal(Boolean(sheet.getCell("A2").font.bold), false);
  const edited = normalizeTransform(snapshot, {
    data: [{ 姓名: "新用户", 金额: 100 }],
    columns: snapshot.columns,
    sourceRows: [null],
    styles: { rows: { 0: { bold: true } } },
  });
  writeSheet(sheet, edited);
  assert.equal(sheet.getCell("B2").value, 100);
  assert.equal(sheet.getCell("B3").value, null);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await book.xlsx.writeBuffer());
  // Avoid creating cells during verification: getCell itself allocates a row.
  assert.equal(
    readSheet(loaded.getWorksheet("Sheet1")).data.filter((row) =>
      Object.values(row).some((value) => value !== null),
    ).length,
    1,
  );
});

test("filtering to zero rows exports only headers without ghost data rows", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Empty result");
  sheet.addRows([
    ["姓名", "金额"],
    ["甲", 20],
    ["乙", 50],
  ]);
  const snapshot = readSheet(sheet);
  writeSheet(
    sheet,
    normalizeTransform(snapshot, {
      data: [],
      columns: snapshot.columns,
      sourceRows: [],
    }),
  );
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await book.xlsx.writeBuffer());
  assert.equal(loaded.worksheets[0].rowCount, 1);
  assert.equal(readSheet(loaded.worksheets[0]).data.length, 0);
  assert.deepEqual(readSheet(loaded.worksheets[0]).columns, ["姓名", "金额"]);
});
