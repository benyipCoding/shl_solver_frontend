"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useFetch } from "@/context/FetchContext";
import AdminTable from "@/components/cms/AdminTable";
import AdminToolbar from "@/components/cms/AdminToolbar";
import AdminDetailDrawer from "@/components/cms/AdminDetailDrawer";
import {
  getAdminTokenRecordDetail,
  listAdminTokenRecords,
} from "@/components/cms/api";
import {
  DEFAULT_TOKEN_RECORD_FILTERS,
  EMPTY_PAGINATION,
} from "@/components/cms/config";
import {
  AdminDetailState,
  AdminTokenRecordItem,
  TokenRecordFilters,
} from "@/interfaces/cms";

const emptyDetailState: AdminDetailState = {
  tab: null,
  id: null,
  loading: false,
  data: null,
};

export default function TokenRecordsPage() {
  const { customFetch } = useFetch();

  const [items, setItems] = useState<AdminTokenRecordItem[]>([]);
  const [pagination, setPagination] = useState({ ...EMPTY_PAGINATION });
  const [filters, setFilters] = useState<TokenRecordFilters>({
    ...DEFAULT_TOKEN_RECORD_FILTERS,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [detailState, setDetailState] =
    useState<AdminDetailState>(emptyDetailState);

  const requestTokenRecords = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      setLoading(true);
      setError(null);

      try {
        const data = await listAdminTokenRecords(
          customFetch,
          pagination.page,
          pagination.page_size,
          filters
        );
        setItems(data.items);
        setPagination(data.pagination);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "获取Token日志失败");
      } finally {
        setLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [customFetch, filters, pagination.page, pagination.page_size]
  );

  useEffect(() => {
    void requestTokenRecords();
  }, [requestTokenRecords]);

  const requestDetail = useCallback(
    async (id: number) => {
      setDetailState({ tab: "tokenRecords", id, loading: true, data: null });
      try {
        const data = await getAdminTokenRecordDetail(customFetch, id);
        setDetailState({ tab: "tokenRecords", id, loading: false, data });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "获取详情失败");
        setDetailState({ tab: "tokenRecords", id, loading: false, data: null });
      }
    },
    [customFetch]
  );

  const handleOpenDetail = (id: number) => {
    if (detailState.tab === "tokenRecords" && detailState.id === id) {
      setDetailState(emptyDetailState);
      return;
    }
    void requestDetail(id);
  };

  const handleFiltersChange = (updates: Partial<TokenRecordFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setDetailState(emptyDetailState);
    setFilters({ ...DEFAULT_TOKEN_RECORD_FILTERS });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Token 模型通信
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          大模型真实调用底层网络日志与上游 Token 消耗统计。
        </p>
      </div>

      <AdminToolbar
        activeTab="tokenRecords"
        isRefreshing={isRefreshing}
        pageSize={pagination.page_size}
        tokenRecordFilters={filters}
        onTokenRecordFiltersChange={handleFiltersChange}
        onPageSizeChange={(pageSize) =>
          setPagination((prev) => ({ ...prev, page: 1, page_size: pageSize }))
        }
        onRefresh={() => requestTokenRecords(true)}
        onReset={handleResetFilters}
      />

      <AdminTable
        activeTab="tokenRecords"
        tokenRecords={items}
        pagination={pagination}
        loading={loading}
        error={error}
        selectedDetailId={
          detailState.tab === "tokenRecords" ? detailState.id : null
        }
        onSelectRow={handleOpenDetail}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        onRetry={() => requestTokenRecords(true)}
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
