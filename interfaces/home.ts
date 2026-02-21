export interface ImageData {
  mimeType: string;
  data: string;
}

export interface Solution {
  [language: string]: string;
}

export interface Complexity {
  time?: string;
  space?: string;
}

export interface AnalysisResult {
  summary: string;
  key_concepts: string[] | string;
  constraints: string[] | string;
  solutions: Solution;
  complexity: string | Complexity;
  code?: string;
}

export interface Model {
  id: number;
  name: string;
  desc: string;
  tag: string;
  key: string;
  enabled: boolean;
}

export interface ResultDisplayProps {
  result: AnalysisResult | null;
}

export interface SHLAnalysisPayload {
  images_data: ImageData[];
  llmId: number;
}
