export type AdminTabId = "users" | "wallets" | "creditLogs" | "tokenRecords";

export type FilterBoolean = "all" | "true" | "false";

export type CreditType = "FREE" | "PAID";

export type ActionType =
  | "SIGNUP_BONUS"
  | "DAILY_REFILL"
  | "USE_FLASH_MODEL"
  | "USE_PRO_MODEL"
  | "USE_VISION_DIFF"
  | "TOP_UP";

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminListResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface AdminSessionUser {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface AdminUserSummary {
  id: number;
  username: string;
  email: string;
  mobile_phone: string | null;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  total_token_count: number;
  free_credits: number;
  paid_credits: number;
  wallet_total_credits: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminUserDetail extends AdminUserSummary {
  deleted_at: string | null;
  credit_log_count: number;
  token_record_count: number;
}

export interface AdminWalletSummary {
  wallet_id: number | null;
  user_id: number;
  username: string;
  email: string;
  mobile_phone: string | null;
  free_credits: number;
  paid_credits: number;
  total_credits: number;
  last_reset_date: string | null;
  wallet_created_at: string | null;
  wallet_updated_at: string | null;
}

export interface AdminWalletRechargeResponse {
  user_id: number;
  username: string;
  email: string;
  recharged_points: number;
  free_credits: number;
  paid_credits: number;
  balance_after: number;
}

export interface AdminCreditLogItem {
  id: number;
  user_id: number;
  username: string | null;
  email: string | null;
  amount: number;
  credit_type: CreditType;
  action_type: ActionType;
  balance_after: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminTokenRecordItem {
  id: number;
  user_id: number;
  username: string | null;
  email: string | null;
  ip: string;
  request_path: string | null;
  model: string | null;
  token_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserFilters {
  keyword: string;
  isActive: FilterBoolean;
  isStaff: FilterBoolean;
  isSuperuser: FilterBoolean;
}

export interface WalletFilters {
  keyword: string;
  onlyWithWallet: boolean;
}

export interface CreditLogFilters {
  keyword: string;
  userId: string;
  creditType: "all" | CreditType;
  actionType: "all" | ActionType;
  startAt: string;
  endAt: string;
}

export interface TokenRecordFilters {
  keyword: string;
  userId: string;
  model: string;
  startAt: string;
  endAt: string;
}

export interface AdminUserUpdateRequest {
  username?: string | null;
  email?: string | null;
  mobile_phone?: string | null;
  is_active?: boolean | null;
  is_staff?: boolean | null;
  is_superuser?: boolean | null;
}

export interface AdminTableState<TItem, TFilters> {
  items: TItem[];
  pagination: PaginationMeta;
  filters: TFilters;
  loading: boolean;
  error: string | null;
}

export interface AdminDetailState {
  tab: AdminTabId | null;
  id: number | null;
  loading: boolean;
  data:
    | AdminUserDetail
    | AdminWalletSummary
    | AdminCreditLogItem
    | AdminTokenRecordItem
    | null;
}

export type CmsFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
  needNavigate?: boolean
) => Promise<Response>;
