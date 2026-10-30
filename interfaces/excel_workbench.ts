export type CellValue = string | number | boolean | null;
export type DataRow = Record<string, CellValue>;

/** Only these properties can be rendered and written to an Excel cell. */
export interface CellStyle {
  backgroundColor?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  horizontalAlignment?: "left" | "center" | "right";
  numberFormat?: string;
}

export interface SheetStyles {
  header?: CellStyle;
  columns?: Record<string, CellStyle>;
  rows?: Record<string, CellStyle>;
  cells?: Record<string, Record<string, CellStyle>>;
  headerCells?: Record<string, CellStyle>;
  importedCells?: Record<string, Record<string, CellStyle>>;
  importedHeaderCells?: Record<string, CellStyle>;
}

export interface SheetSnapshot {
  data: DataRow[];
  columns: string[];
  styles: SheetStyles;
  clearOriginalStyles?: boolean;
}

export interface HistoryRecord {
  id: string;
  title: string;
  rowCount: number;
  columnCount: number;
  timestamp: string;
  isOriginal?: boolean;
  explanation?: string;
}

export interface SheetView {
  sheetName: string;
  snapshot: SheetSnapshot;
  history: HistoryRecord[];
  activeHistoryId: string;
}

export interface TransformRequest {
  prompt: string;
  columns: string[];
  sample_row: DataRow;
  protocol_version: 2;
}

export type WorkbookCommand =
  | { type: "import"; buffer: ArrayBuffer; fileName: string }
  | { type: "select"; sheetName: string; historyId?: string }
  | { type: "deleteHistory"; sheetName: string; historyId: string }
  | {
      type: "transform";
      sheetName: string;
      historyId: string;
      code: string;
      title: string;
      explanation?: string;
    }
  | { type: "export" }
  | { type: "cancel" };

export interface WorkbookResult {
  sheetNames?: string[];
  view?: SheetView;
  buffer?: ArrayBuffer;
}
