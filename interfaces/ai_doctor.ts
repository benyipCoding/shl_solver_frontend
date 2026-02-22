export interface AnalyzePayload {
  explanationStyle: "simple" | "professional";
  mimeType: string;
  data: string; // base64 字符串
  llmKey: string;
}

export interface Abnormality {
  name: string;
  value: string;
  reference?: string | null;
  status: string;
  explanation: string;
  possibleCauses?: string | null;
  consequence?: string | null;
  advice?: string | null;
}

export interface AnalyzeResponseData {
  reportType?: string | null;
  patientName?: string | null;
  // healthScore 范围为 0-100（类型系统无法强制，使用注释提醒）
  healthScore?: number | null;
  summary?: string | null;
  abnormalities?: Abnormality[];
  normalCount?: number | null;
  disclaimer?: string | null;
  // 当图片无法识别或不是化验单时，返回该字段说明错误原因
  error?: string | null;
  total_token_count?: number | null;
}

export interface AnalyzeResponse {
  code: number;
  data: AnalyzeResponseData;
  message: string;
  error?: string;
}
