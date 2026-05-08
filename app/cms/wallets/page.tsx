"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useFetch } from "@/context/FetchContext";
import AdminTable from "@/components/cms/AdminTable";
import AdminToolbar from "@/components/cms/AdminToolbar";
import AdminDetailDrawer from "@/components/cms/AdminDetailDrawer";
import RechargeWalletModal from "@/components/cms/RechargeWalletModal";
import {
  getAdminWalletDetail,
  listAdminWallets,
  rechargeAdminWallet,
} from "@/components/cms/api";
import {
  DEFAULT_WALLET_FILTERS,
  EMPTY_PAGINATION,
} from "@/components/cms/config";
import {
  AdminDetailState,
  AdminWalletSummary,
  WalletFilters,
} from "@/interfaces/cms";
import { formatNumber } from "@/components/cms/format";

const emptyDetailState: AdminDetailState = {
  tab: null,
  id: null,
  loading: false,
  data: null,
};

export default function WalletsPage() {
  const { customFetch } = useFetch();

  const [items, setItems] = useState<AdminWalletSummary[]>([]);
  const [pagination, setPagination] = useState({ ...EMPTY_PAGINATION });
  const [filters, setFilters] = useState<WalletFilters>({
    ...DEFAULT_WALLET_FILTERS,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [detailState, setDetailState] =
    useState<AdminDetailState>(emptyDetailState);
  const [walletRechargeTarget, setWalletRechargeTarget] =
    useState<AdminWalletSummary | null>(null);
  const [isRechargingWallet, setIsRechargingWallet] = useState(false);

  const requestWallets = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      setLoading(true);
      setError(null);

      try {
        const data = await listAdminWallets(
          customFetch,
          pagination.page,
          pagination.page_size,
          filters
        );
        setItems(data.items);
        setPagination(data.pagination);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "获取钱包列表失败");
      } finally {
        setLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [customFetch, filters, pagination.page, pagination.page_size]
  );

  useEffect(() => {
    void requestWallets();
  }, [requestWallets]);

  const requestDetail = useCallback(
    async (id: number) => {
      setDetailState({ tab: "wallets", id, loading: true, data: null });
      try {
        const data = await getAdminWalletDetail(customFetch, id);
        setDetailState({ tab: "wallets", id, loading: false, data });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "获取详情失败");
        setDetailState({ tab: "wallets", id, loading: false, data: null });
      }
    },
    [customFetch]
  );

  const handleOpenDetail = (id: number) => {
    if (detailState.tab === "wallets" && detailState.id === id) {
      setDetailState(emptyDetailState);
      return;
    }
    void requestDetail(id);
  };

  const handleFiltersChange = (updates: Partial<WalletFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setDetailState(emptyDetailState);
    setFilters({ ...DEFAULT_WALLET_FILTERS });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSubmitWalletRecharge = async (amount: number) => {
    if (!walletRechargeTarget) return;
    setIsRechargingWallet(true);
    try {
      const result = await rechargeAdminWallet(
        customFetch,
        walletRechargeTarget.user_id,
        amount
      );
      toast.success(
        `充值成功，余额更新为 ${formatNumber(result.balance_after)}`
      );
      setWalletRechargeTarget(null);
      await requestWallets();
      if (detailState.id === result.user_id) {
        void requestDetail(result.user_id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "钱包充值失败");
    } finally {
      setIsRechargingWallet(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          钱包管理
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          核查用户算力余额、手动发放补偿或特殊活动点数。
        </p>
      </div>

      <AdminToolbar
        activeTab="wallets"
        isRefreshing={isRefreshing}
        pageSize={pagination.page_size}
        walletsFilters={filters}
        onWalletFiltersChange={handleFiltersChange}
        onPageSizeChange={(pageSize) =>
          setPagination((prev) => ({ ...prev, page: 1, page_size: pageSize }))
        }
        onRefresh={() => requestWallets(true)}
        onReset={handleResetFilters}
      />

      <AdminTable
        activeTab="wallets"
        wallets={items}
        pagination={pagination}
        loading={loading}
        error={error}
        selectedDetailId={detailState.tab === "wallets" ? detailState.id : null}
        onSelectRow={handleOpenDetail}
        onRechargeWallet={setWalletRechargeTarget}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        onRetry={() => requestWallets(true)}
      />

      <AdminDetailDrawer
        state={detailState}
        onClose={() => setDetailState(emptyDetailState)}
        onEditUser={() => {}}
        onRechargeWallet={setWalletRechargeTarget}
      />

      {walletRechargeTarget && (
        <RechargeWalletModal
          key={`recharge-${walletRechargeTarget.user_id}`}
          open
          wallet={walletRechargeTarget}
          submitting={isRechargingWallet}
          onClose={() => setWalletRechargeTarget(null)}
          onSubmit={handleSubmitWalletRecharge}
        />
      )}
    </div>
  );
}
