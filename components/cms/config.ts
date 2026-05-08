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
    description: "账号状态、角色权限与钱包汇总",
    icon: Users,
  },
  {
    id: "wallets",
    label: "钱包管理",
    description: "免费点数、付费点数与充值操作",
    icon: Wallet,
  },
  {
    id: "creditLogs",
    label: "消费记录",
    description: "算力流水、动作来源与余额变化",
    icon: ScrollText,
  },
  {
    id: "tokenRecords",
    label: "Token 记录",
    description: "模型调用量、来源路径与访问痕迹",
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
