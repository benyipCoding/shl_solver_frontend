import { AnalysisResult } from "./shl_solver";

export interface SHLSolverHistoryItem {
  id: number;
  image_urls: string[]; // List of URLs, matching backend
  token_count: number;
  model: string;
  username: string; // Updated to match backend 'username' field
  result_json: AnalysisResult; // JSON object corresponding to AnalysisResult
  total_test_cases: number;
  passed_test_cases: number;
  status: "pending" | "completed" | "failed" | string; // Allow string to correspond to backend str
  error_message?: string;
  created_at: string; // ISO Date string
}

export interface SHLSolverHistoryResponse {
  items: SHLSolverHistoryItem[]; // Matches SHLSolverHistoryListResponse.items
  total: number;
  page: number;
  size: number;
}
