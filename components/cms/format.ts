import {
  ActionType,
  AdminCreditLogItem,
  AdminUserSummary,
  CreditType,
} from "@/interfaces/cms";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("zh-CN");

export const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
};

export const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
};

export const formatNumber = (value: number | null | undefined) => {
  if (typeof value !== "number") {
    return "-";
  }

  return numberFormatter.format(value);
};

export const formatCreditTypeLabel = (value: CreditType) => {
  return value === "FREE" ? "免费点数" : "付费点数";
};

export const formatActionTypeLabel = (value: ActionType) => {
  const labels: Record<ActionType, string> = {
    SIGNUP_BONUS: "注册赠送",
    DAILY_REFILL: "每日补充",
    USE_FLASH_MODEL: "Flash 模型消耗",
    USE_PRO_MODEL: "Pro 模型消耗",
    USE_VISION_DIFF: "视觉对比消耗",
    TOP_UP: "后台充值",
  };

  return labels[value] || value;
};

export const getUserRole = (
  user: Pick<AdminUserSummary, "is_superuser" | "is_staff">
) => {
  if (user.is_superuser) {
    return {
      label: "超级管理员",
      className:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    };
  }

  if (user.is_staff) {
    return {
      label: "工作人员",
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    };
  }

  return {
    label: "普通用户",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200",
  };
};

export const getActiveStatus = (isActive: boolean) => {
  if (isActive) {
    return {
      label: "正常",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    };
  }

  return {
    label: "禁用",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  };
};

export const getAmountTone = (amount: AdminCreditLogItem["amount"]) => {
  return amount >= 0
    ? "text-emerald-600 dark:text-emerald-300"
    : "text-rose-600 dark:text-rose-300";
};

export const truncateText = (
  value: string | null | undefined,
  maxLength: number = 30
) => {
  if (!value) {
    return "-";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};
