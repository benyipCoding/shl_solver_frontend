import type {
  AdminTabId,
  AdminListResponse,
  AdminUserSummary,
  AdminWalletSummary,
  AdminCreditLogItem,
  AdminTokenRecordItem,
  CmsFetcher,
} from "@/interfaces/cms";
import {
  DEFAULT_USER_FILTERS,
  DEFAULT_WALLET_FILTERS,
  DEFAULT_CREDIT_LOG_FILTERS,
  DEFAULT_TOKEN_RECORD_FILTERS,
} from "./config";
import {
  listAdminUsers,
  listAdminWallets,
  listAdminCreditLogs,
  listAdminTokenRecords,
} from "./api";
import type { CmsStore } from "./data-store";

export const DEFAULT_CMS_FILTERS = {
  ...DEFAULT_USER_FILTERS,
  ...DEFAULT_WALLET_FILTERS,
  ...DEFAULT_CREDIT_LOG_FILTERS,
  ...DEFAULT_TOKEN_RECORD_FILTERS,
};
export const DEFAULT_CMS_VIEW = {
  filters: DEFAULT_CMS_FILTERS,
  page: 1,
  pageSize: 20,
};
export type CmsListView = typeof DEFAULT_CMS_VIEW;
export type CmsListItem =
  | AdminUserSummary
  | AdminWalletSummary
  | AdminCreditLogItem
  | AdminTokenRecordItem;

export const CMS_LIST_ROUTES: Record<string, AdminTabId | undefined> = {
  "/cms/users": "users",
  "/cms/wallets": "wallets",
  "/cms/credit-logs": "creditLogs",
  "/cms/token-records": "tokenRecords",
};
const loaders = {
  users: listAdminUsers,
  wallets: listAdminWallets,
  creditLogs: listAdminCreditLogs,
  tokenRecords: listAdminTokenRecords,
};

export function loadCmsList(
  store: CmsStore,
  fetcher: CmsFetcher,
  tab: AdminTabId,
  view: CmsListView,
  force = false,
) {
  return store.load<AdminListResponse<CmsListItem>>(
    tab,
    JSON.stringify(view),
    () => loaders[tab](fetcher, view.page, view.pageSize, view.filters),
    force,
  );
}
