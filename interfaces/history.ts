import { AnalysisResult } from "./shl_solver";

export interface SHLSolverHistoryItem {
  id: number;
  image_urls: string; // Comma-separated URLs
  token_count: number;
  model: string;
  user_id: string; // Username
  result_json: AnalysisResult; // JSON object corresponding to AnalysisResult
  total_test_cases: number;
  passed_test_cases: number;
  status: "pending" | "completed" | "failed";
  error_message?: string;
  created_at: string; // ISO Date string
}
