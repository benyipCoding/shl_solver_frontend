import {
  ActionType,
  AdminCreditLogItem,
  AdminListResponse,
  AdminSessionUser,
  AdminTokenRecordItem,
  AdminUserDetail,
  AdminUserSummary,
  AdminUserUpdateRequest,
  AdminWalletRechargeResponse,
  AdminWalletSummary,
  ApiResponse,
  CmsFetcher,
  CreditLogFilters,
  TokenRecordFilters,
  UserFilters,
  WalletFilters,
} from "@/interfaces/cms";

const buildQueryString = (
  params: Record<string, string | number | boolean | undefined>
) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const toBooleanQuery = (value: UserFilters["isActive"]) => {
  if (value === "all") {
    return undefined;
  }

  return value === "true";
};

const toIsoDateTime = (value: string) => {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
};

const requestApi = async <T>(
  fetcher: CmsFetcher,
  input: RequestInfo | URL,
  init?: RequestInit,
  needNavigate: boolean = false
) => {
  const response = await fetcher(input, init, needNavigate);
  const payload = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok) {
    const errorMessage =
      payload?.message ||
      (payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `请求失败 (${response.status})`);

    throw new Error(errorMessage);
  }

  if (!payload) {
    throw new Error("服务端未返回有效数据");
  }

  if (payload.data === null) {
    throw new Error(payload.message || "服务端未返回数据");
  }

  return payload.data;
};

export const getAdminMe = async (fetcher: CmsFetcher) => {
  return requestApi<AdminSessionUser>(fetcher, "/api/user/me", undefined, true);
};

export const listAdminUsers = async (
  fetcher: CmsFetcher,
  page: number,
  pageSize: number,
  filters: UserFilters
) => {
  const query = buildQueryString({
    page,
    page_size: pageSize,
    keyword: filters?.keyword?.trim() || undefined,
    is_active: toBooleanQuery(filters.isActive),
    is_staff: toBooleanQuery(filters.isStaff),
    is_superuser: toBooleanQuery(filters.isSuperuser),
  });

  return requestApi<AdminListResponse<AdminUserSummary>>(
    fetcher,
    `/api/admin/users${query}`,
    undefined,
    true
  );
};

export const getAdminUserDetail = async (
  fetcher: CmsFetcher,
  userId: number
) => {
  return requestApi<AdminUserDetail>(
    fetcher,
    `/api/admin/users/${userId}`,
    undefined,
    true
  );
};

export const updateAdminUser = async (
  fetcher: CmsFetcher,
  userId: number,
  payload: AdminUserUpdateRequest
) => {
  return requestApi<AdminUserDetail>(
    fetcher,
    `/api/admin/users/${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    true
  );
};

export const listAdminWallets = async (
  fetcher: CmsFetcher,
  page: number,
  pageSize: number,
  filters: WalletFilters
) => {
  const query = buildQueryString({
    page,
    page_size: pageSize,
    keyword: filters?.keyword?.trim() || undefined,
    only_with_wallet: filters.onlyWithWallet,
  });

  return requestApi<AdminListResponse<AdminWalletSummary>>(
    fetcher,
    `/api/admin/wallets${query}`,
    undefined,
    true
  );
};

export const getAdminWalletDetail = async (
  fetcher: CmsFetcher,
  userId: number
) => {
  return requestApi<AdminWalletSummary>(
    fetcher,
    `/api/admin/wallets/${userId}`,
    undefined,
    true
  );
};

export const rechargeAdminWallet = async (
  fetcher: CmsFetcher,
  userId: number,
  amount: number
) => {
  return requestApi<AdminWalletRechargeResponse>(
    fetcher,
    `/api/admin/wallets/${userId}/recharge`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    },
    true
  );
};

export const listAdminCreditLogs = async (
  fetcher: CmsFetcher,
  page: number,
  pageSize: number,
  filters: CreditLogFilters
) => {
  const query = buildQueryString({
    page,
    page_size: pageSize,
    keyword: filters?.keyword?.trim() || undefined,
    user_id: filters?.userId?.trim() || undefined,
    credit_type: filters.creditType === "all" ? undefined : filters.creditType,
    action_type: filters.actionType === "all" ? undefined : filters.actionType,
    start_at: toIsoDateTime(filters.startAt),
    end_at: toIsoDateTime(filters.endAt),
  });

  return requestApi<AdminListResponse<AdminCreditLogItem>>(
    fetcher,
    `/api/admin/credit-logs${query}`,
    undefined,
    true
  );
};

export const getAdminCreditLogDetail = async (
  fetcher: CmsFetcher,
  logId: number
) => {
  return requestApi<AdminCreditLogItem>(
    fetcher,
    `/api/admin/credit-logs/${logId}`,
    undefined,
    true
  );
};

export const listAdminTokenRecords = async (
  fetcher: CmsFetcher,
  page: number,
  pageSize: number,
  filters: TokenRecordFilters
) => {
  const query = buildQueryString({
    page,
    page_size: pageSize,
    keyword: filters?.keyword?.trim() || undefined,
    user_id: filters?.userId?.trim() || undefined,
    model: filters?.model?.trim() || undefined,
    start_at: toIsoDateTime(filters.startAt),
    end_at: toIsoDateTime(filters.endAt),
  });

  return requestApi<AdminListResponse<AdminTokenRecordItem>>(
    fetcher,
    `/api/admin/token-records${query}`,
    undefined,
    true
  );
};

export const getAdminTokenRecordDetail = async (
  fetcher: CmsFetcher,
  recordId: number
) => {
  return requestApi<AdminTokenRecordItem>(
    fetcher,
    `/api/admin/token-records/${recordId}`,
    undefined,
    true
  );
};

export const actionTypeOptions: ActionType[] = [
  "SIGNUP_BONUS",
  "DAILY_REFILL",
  "USE_FLASH_MODEL",
  "USE_PRO_MODEL",
  "USE_VISION_DIFF",
  "TOP_UP",
];
