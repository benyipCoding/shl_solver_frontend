import { Activity, ScrollText, Users, Wallet } from "lucide-react";
import {
  CreditLogFilters,
  PaginationMeta,
  TokenRecordFilters,
  UserFilters,
  WalletFilters,
} from "@/interfaces/cms";

export const CMS_TABS = [
  {
    id: "users",
    label: "用户管理",
    description: "管理账号资料、启用状态与访问权限。",
    icon: Users,
  },
  {
    id: "wallets",
    label: "钱包管理",
    description: "查看用户算力余额，管理充值与人工扣减。",
    icon: Wallet,
  },
  {
    id: "creditLogs",
    label: "算力流水",
    description: "追溯每一笔算力变动、操作来源和余额。",
    icon: ScrollText,
  },
  {
    id: "tokenRecords",
    label: "Token 记录",
    description: "查询模型用量、请求来源与调用时间。",
    icon: Activity,
  },
] as const;

export const EMPTY_PAGINATION: PaginationMeta = {
  total: 0,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

export const DEFAULT_USER_FILTERS: UserFilters = {
  keyword: "",
  isActive: "all",
  isStaff: "all",
  isSuperuser: "all",
};

export const DEFAULT_WALLET_FILTERS: WalletFilters = {
  keyword: "",
  onlyWithWallet: false,
};

export const DEFAULT_CREDIT_LOG_FILTERS: CreditLogFilters = {
  keyword: "",
  userId: "",
  creditType: "all",
  actionType: "all",
  startAt: "",
  endAt: "",
};

export const DEFAULT_TOKEN_RECORD_FILTERS: TokenRecordFilters = {
  keyword: "",
  userId: "",
  model: "",
  startAt: "",
  endAt: "",
};

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
