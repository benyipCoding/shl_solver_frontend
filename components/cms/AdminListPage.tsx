"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useFetch } from "@/context/FetchContext";
import { useCmsResource, useCmsStore } from "./CmsDataProvider";
import AdminTable from "./AdminTable";
import AdminToolbar from "./AdminToolbar";
import AdminDetailDrawer from "./AdminDetailDrawer";
import EditUserModal from "./EditUserModal";
import WalletAdjustmentModal from "./WalletAdjustmentModal";
import PageHeading from "./PageHeading";
import { CMS_TABS, EMPTY_PAGINATION } from "./config";
import {
  getAdminUserDetail,
  getAdminWalletDetail,
  getAdminCreditLogDetail,
  getAdminTokenRecordDetail,
  updateAdminUser,
  rechargeAdminWallet,
  deductAdminWallet,
} from "./api";
import type {
  AdminTabId,
  AdminUserSummary,
  AdminUserDetail,
  AdminWalletSummary,
  AdminCreditLogItem,
  AdminTokenRecordItem,
  AdminListResponse,
  AdminDetailState,
  AdminUserUpdateRequest,
  CreditType,
} from "@/interfaces/cms";
import { formatNumber } from "./format";

import {
  DEFAULT_CMS_FILTERS as defaultFilters,
  DEFAULT_CMS_VIEW,
  loadCmsList,
  type CmsListItem as Item,
} from "./list-data";
import LoadingNotice from "./LoadingNotice";
type Filters = typeof defaultFilters;
const detailLoaders = {
  users: getAdminUserDetail,
  wallets: getAdminWalletDetail,
  creditLogs: getAdminCreditLogDetail,
  tokenRecords: getAdminTokenRecordDetail,
};
const emptyDetail: AdminDetailState = {
  tab: null,
  id: null,
  loading: false,
  data: null,
};

export default function AdminListPage({ tab }: { tab: AdminTabId }) {
  const { customFetch } = useFetch();
  const store = useCmsStore();
  const resource = useCmsResource<AdminListResponse<Item>>(tab);
  const [view, setView] = useState(() => store.getView(tab, DEFAULT_CMS_VIEW));
  const query = JSON.stringify(view);
  const lastFilters = useRef(view.filters);
  const [detail, setDetail] = useState<AdminDetailState>(emptyDetail);
  const detailSequence = useRef(0);
  const [editUser, setEditUser] = useState<
    AdminUserSummary | AdminUserDetail | null
  >(null);
  const [adjustment, setAdjustment] = useState<{
    wallet: AdminWalletSummary;
    mode: "recharge" | "deduct";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const submissionLock = useRef(false);
  const config = CMS_TABS.find((item) => item.id === tab)!;

  const load = useCallback(
    (force = false) => loadCmsList(store, customFetch, tab, view, force),
    [store, tab, customFetch, view],
  );

  useEffect(() => {
    // A menu preload already returned this error. Keep it visible until retry,
    // instead of immediately replacing it with a second loading state.
    const current = store.get(tab);
    if (current.query === query && current.error && !current.loading) return;
    const filtersChanged = lastFilters.current !== view.filters;
    lastFilters.current = view.filters;
    const timer = window.setTimeout(
      () => {
        void load();
      },
      filtersChanged ? 300 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [load, view.filters, store, tab, query]);

  useEffect(
    () => () => {
      detailSequence.current += 1;
    },
    [],
  );

  const changeView = (next: typeof view) => {
    store.setView(tab, next);
    setView(next);
  };
  const changeFilters = (updates: Partial<Filters>) =>
    changeView({ ...view, page: 1, filters: { ...view.filters, ...updates } });
  const closeDetail = () => {
    detailSequence.current += 1;
    setDetail(emptyDetail);
  };
  const openDetail = async (id: number) => {
    const sequence = ++detailSequence.current;
    setDetail({ tab, id, loading: true, data: null });
    try {
      const data = await detailLoaders[tab](customFetch, id);
      if (sequence === detailSequence.current)
        setDetail({ tab, id, loading: false, data });
    } catch (error) {
      if (sequence !== detailSequence.current) return;
      toast.error(error instanceof Error ? error.message : "获取详情失败");
      setDetail({ tab, id, loading: false, data: null });
    }
  };

  const saveUser = async (payload: AdminUserUpdateRequest) => {
    if (!editUser || submissionLock.current) return;
    submissionLock.current = true;
    setSubmitting(true);
    setMutationError(null);
    const sequence = detailSequence.current;
    try {
      const updated = await updateAdminUser(customFetch, editUser.id, payload);
      store.invalidate();
      setEditUser(null);
      toast.success("用户资料已更新");
      if (detail.id === updated.id && sequence === detailSequence.current) {
        detailSequence.current += 1;
        setDetail({ tab, id: updated.id, loading: false, data: updated });
      }
      await load(true);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "更新失败");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  const adjustWallet = async (
    amount: number,
    creditType: CreditType,
    reason: string,
  ) => {
    if (!adjustment || submissionLock.current) return;
    submissionLock.current = true;
    setSubmitting(true);
    setMutationError(null);
    const sequence = detailSequence.current;
    try {
      const result =
        adjustment.mode === "deduct"
          ? await deductAdminWallet(
              customFetch,
              adjustment.wallet.user_id,
              amount,
              creditType,
              reason,
            )
          : await rechargeAdminWallet(
              customFetch,
              adjustment.wallet.user_id,
              amount,
            );
      store.invalidate();
      setAdjustment(null);
      toast.success(
        `${adjustment.mode === "deduct" ? "扣减" : "充值"}成功，余额 ${formatNumber(result.balance_after)}`,
      );
      await load(true);
      if (detail.id === result.user_id && sequence === detailSequence.current)
        void openDetail(result.user_id);
    } catch (error) {
      // Keep the form and amount so the operator can inspect and correct the request.
      setMutationError(error instanceof Error ? error.message : "钱包操作失败");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  const data = resource.data;
  const loading = resource.loading || resource.query !== query;
  const recharge = (wallet: AdminWalletSummary) => {
    setMutationError(null);
    setAdjustment({ wallet, mode: "recharge" });
  };
  const deduct = (wallet: AdminWalletSummary) => {
    setMutationError(null);
    setAdjustment({ wallet, mode: "deduct" });
  };
  const edit = (user: AdminUserSummary | AdminUserDetail) => {
    setMutationError(null);
    setEditUser(user);
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title={config.label}
        description={config.description}
        icon={config.icon}
      />
      <AdminToolbar
        activeTab={tab}
        isRefreshing={loading}
        pageSize={view.pageSize}
        usersFilters={view.filters}
        walletsFilters={view.filters}
        creditLogFilters={view.filters}
        tokenRecordFilters={view.filters}
        onUsersFiltersChange={changeFilters}
        onWalletFiltersChange={changeFilters}
        onCreditLogFiltersChange={changeFilters}
        onTokenRecordFiltersChange={changeFilters}
        onPageSizeChange={(pageSize) =>
          changeView({ ...view, pageSize, page: 1 })
        }
        onRefresh={() => void load(true)}
        onReset={() =>
          changeView({ ...view, filters: defaultFilters, page: 1 })
        }
      />
      {loading && (
        <LoadingNotice>
          {data ? "正在更新列表…" : "正在加载列表…"}
        </LoadingNotice>
      )}
      {(data || resource.error) && (
        <AdminTable
          activeTab={tab}
          users={
            tab === "users" ? (data?.items as AdminUserSummary[]) : undefined
          }
          wallets={
            tab === "wallets"
              ? (data?.items as AdminWalletSummary[])
              : undefined
          }
          creditLogs={
            tab === "creditLogs"
              ? (data?.items as AdminCreditLogItem[])
              : undefined
          }
          tokenRecords={
            tab === "tokenRecords"
              ? (data?.items as AdminTokenRecordItem[])
              : undefined
          }
          pagination={data?.pagination ?? EMPTY_PAGINATION}
          loading={loading}
          error={resource.error}
          selectedDetailId={detail.id}
          onSelectRow={(id) => void openDetail(id)}
          onEditUser={edit}
          onRechargeWallet={recharge}
          onDeductWallet={deduct}
          onPageChange={(page) => changeView({ ...view, page })}
          onRetry={() => void load(true)}
        />
      )}
      <AdminDetailDrawer
        state={detail}
        onClose={closeDetail}
        onEditUser={edit}
        onRechargeWallet={recharge}
        onDeductWallet={deduct}
      />
      {editUser && (
        <EditUserModal
          key={editUser.id}
          open
          user={editUser}
          submitting={submitting}
          error={mutationError}
          onClose={() => {
            if (!submitting) setEditUser(null);
          }}
          onSubmit={saveUser}
        />
      )}
      {adjustment && (
        <WalletAdjustmentModal
          key={`${adjustment.mode}-${adjustment.wallet.user_id}`}
          wallet={adjustment.wallet}
          mode={adjustment.mode}
          submitting={submitting}
          error={mutationError}
          onClose={() => {
            if (!submitting) setAdjustment(null);
          }}
          onSubmit={adjustWallet}
        />
      )}
    </div>
  );
}
