# Excel AI 数据工作台

## 使用与行为

- 底部 Sheet Tab 支持横向滚动，以及左右方向键、Home / End 切换。每张表独立保存当前版本与历史。
- 指令可组合数据和样式操作，例如“按销售额降序排列，将大于 10000 的行背景染红并加粗”。
- 支持表头、整列、整行、单元格的背景色、文字颜色、粗体、斜体、下划线、字号、水平对齐和数字格式。
- 条件样式在执行时应用于结果数据，不是随 Excel 后续编辑自动重算的条件格式规则。
- 导出所有 Sheet 各自选中的版本，包含数据与样式。支持读取 XLSX / XLS / CSV，统一导出 XLSX。
- 历史保留每张表的原始版本和最近 11 次操作。历史只保存在当前页面会话中，刷新或关闭前需要导出。
- AI 请求包含指令、列名与首行示例；首行没有自动脱敏。完整工作簿不在请求中。

## 性能与执行

工作台界面与表格预览的最小字号为 16px。导入的小字号在预览时放大，工作簿保存的字号保持原值。

`VirtualSheet.tsx` 同时虚拟化行和列，固定行高 44px、列宽 192px，并预渲染少量邻近单元格。表头与行号固定。超高表格把原生滚动高度限制为 800 万像素，再映射到完整逻辑行高，避免浏览器最大滚动高度限制。

`workbook.worker.ts` 负责文件解析、工作表读取、历史存储和导出。主线程仅持有当前表的快照及轻量历史摘要。生成代码在另一个可销毁的 Worker 中计算，30 秒超时或手动取消均保留原工作簿；AI 请求等待上限为 120 秒。

虚拟化限制 DOM 规模，但文件与历史仍使用浏览器内存；实际容量受设备内存、文件压缩率、样式数量影响。Worker 用于计算调度与取消，不应当被视为不可信 JavaScript 的安全沙箱。

## 格式保留范围

XLSX 通过 ExcelJS 读取/写入；XLS 和 CSV 通过 SheetJS 转换。未编辑的工作表沿用原工作簿模型，保留 ExcelJS 支持的功能。

仅修改样式且数据结构未变化时，保留原单元格公式、合并、列宽，以及未涉及的原生样式。数据发生改变后，编辑表作为普通数据表重新写入，公式使用读取到的缓存值，合并会解除；复杂图表、宏、透视表与动态公式引用不属于无损编辑范围。没有缓存结果的公式在数据模型中为空值。

首行为表头，重复列名会自动加后缀。数据模型保留数字/布尔值；日期作为 ISO 日期文本提供给 AI，已有数字格式在可见单元格上格式化展示。

## 前后端协议

前端发送 `protocol_version: 2`。后端默认版本仍为 1，兼容旧客户端的 `transform(data)` 数组结果。

v2 使用 `transform(data, context)`，返回 `{ data, columns, sourceRows, styles }`。`context.columns` 包含空列；`context.sourceIndex(inputRow)` 用于生成排序、筛选、克隆后的来源映射。新建或汇总行来源为 `null`。未显式返回映射时，仅能自动识别保留对象引用的行。

样式按属性合并，优先级为：导入单元格样式 < 列 < 行 < 单元格。`styles: null` 清除全部格式。样式映射中的 `null` 删除对应覆盖层。索引始于 0，不包含表头。数据和样式通过验证后才新增历史记录，失败时原数据不变。

## 验证

前端：

```powershell
node --test components/excel_workbench/workbook.test.mjs
npx tsc --noEmit
npx eslint app/excel_workbench components/excel_workbench interfaces/excel_workbench.ts constants/excel_workbench.ts
npm run build
```

后端：

```powershell
.venv/Scripts/python.exe -m unittest tests.test_excel_workbench -v
```

浏览器回归使用模拟 AI 响应，实际检查过 10 万行 × 400 列的稀疏工作簿、末行/末列滚动、Sheet 切换、历史回滚、样式导出再读取、组合修改、取消死循环、空表生成、深色和移动端布局。此用例不代表 4000 万个非空单元格的压力测试，也不验证线上模型生成准确率。
