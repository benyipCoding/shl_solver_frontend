export interface HistoryRecord {
  id: string;
  title: string;
  data: any[];
  columns: string[];
  timestamp: string;
  isOriginal?: boolean;
  explanation?: string;
}

export interface TransformRequest {
  prompt: string;
  columns: string[];
  sample_row: Record<string, any>;
}
