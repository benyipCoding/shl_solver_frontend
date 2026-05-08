"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useFetch } from "@/context/FetchContext";
import AdminTable from "@/components/cms/AdminTable";
import AdminToolbar from "@/components/cms/AdminToolbar";
import AdminDetailDrawer from "@/components/cms/AdminDetailDrawer";
import {
  getAdminCreditLogDetail,
  listAdminCreditLogs,
} from "@/components/cms/api";
import {
  DEFAULT_CREDIT_LOG_FILTERS,
  EMPTY_PAGINATION,
} from "@/components/cms/config";
import {
  AdminCreditLogItem,
  AdminDetailState,
  CreditLogFilters,
} from "@/interfaces/cms";

const emptyDetailState: AdminDetailState = {
  tab: null,
  id: null,
  loading: false,
  data: null,
};

export default function CreditLogsPage() {
  const { customFetch } = useFetch();

  const [items, setItems] = useState<AdminCreditLogItem[]>([]);
  const [pagination, setPagination] = useState({ ...EMPTY_PAGINATION });
  const [filters, setFilters] = useState<CreditLogFilters>({
    ...DEFAULT_CREDIT_LOG_FILTERS,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [detailState, setDetailState] =
    useState<AdminDetailState>(emptyDetailState);

  const requestCreditLogs = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      setLoading(true);
      setError(null);

      try {
        const data = await listAdminCreditLogs(
          customFetch,
          pagination.page,
          pagination.page_size,
          filters
        );
        setItems(data.items);
        setPagination(data.pagination);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "获取流水列表失败");
      } finally {
        setLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [customFetch, filters, pagination.page, pagination.page_size]
  );

  useEffect(() => {
    void requestCreditLogs();
  }, [requestCreditLogs]);

  const requestDetail = useCallback(
    async (id: number) => {
      setDetailState({ tab: "creditLogs", id, loading: true, data: null });
      try {
        const data = await getAdminCreditLogDetail(customFetch, id);
        setDetailState({ tab: "creditLogs", id, loading: false, data });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "获取详情失败");
        setDetailState({ tab: "creditLogs", id, loading: false, data: null });
      }
    },
    [customFetch]
  );

  const handleOpenDetail = (id: number) => {
    if (detailState.tab === "creditLogs" && detailState.id === id) {
      setDetailState(emptyDetailState);
      return;
    }
    void requestDetail(id);
  };

  const handleFiltersChange = (updates: Partial<CreditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setDetailState(emptyDetailState);
    setFilters({ ...DEFAULT_CREDIT_LOG_FILTERS });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          算力流水
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          追溯模型扣费、每日自动补充记录与人工奖励明细。
        </p>
      </div>

      <AdminToolbar
        activeTab="creditLogs"
        isRefreshing={isRefreshing}
        pageSize={pagination.page_size}
        creditLogFilters={filters}
        onCreditLogFiltersChange={handleFiltersChange}
        onPageSizeChange={(pageSize) =>
          setPagination((prev) => ({ ...prev, page: 1, page_size: pageSize }))
        }
        onRefresh={() => requestCreditLogs(true)}
        onReset={handleResetFilters}
      />

      <AdminTable
        activeTab="creditLogs"
        creditLogs={items}
        pagination={pagination}
        loading={loading}
        error={error}
        selectedDetailId={
          detailState.tab === "creditLogs" ? detailState.id : null
        }
        onSelectRow={handleOpenDetail}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        onRetry={() => requestCreditLogs(true)}
      />

      <AdminDetailDrawer
        state={detailState}
        onClose={() => setDetailState(emptyDetailState)}
        onEditUser={() => {}}
        onRechargeWallet={() => {}}
      />
    </div>
  );
}
