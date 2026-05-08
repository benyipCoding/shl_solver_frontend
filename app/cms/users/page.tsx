"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useFetch } from "@/context/FetchContext";
import AdminTable from "@/components/cms/AdminTable";
import AdminToolbar from "@/components/cms/AdminToolbar";
import AdminDetailDrawer from "@/components/cms/AdminDetailDrawer";
import EditUserModal from "@/components/cms/EditUserModal";
import {
  getAdminUserDetail,
  listAdminUsers,
  updateAdminUser,
} from "@/components/cms/api";
import {
  DEFAULT_USER_FILTERS,
  EMPTY_PAGINATION,
} from "@/components/cms/config";
import {
  AdminDetailState,
  AdminUserDetail,
  AdminUserSummary,
  AdminUserUpdateRequest,
  UserFilters,
} from "@/interfaces/cms";

const emptyDetailState: AdminDetailState = {
  tab: null,
  id: null,
  loading: false,
  data: null,
};

export default function UsersPage() {
  const { customFetch } = useFetch();

  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [pagination, setPagination] = useState({ ...EMPTY_PAGINATION });
  const [filters, setFilters] = useState<UserFilters>({
    ...DEFAULT_USER_FILTERS,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [detailState, setDetailState] =
    useState<AdminDetailState>(emptyDetailState);
  const [editUserTarget, setEditUserTarget] = useState<
    AdminUserSummary | AdminUserDetail | null
  >(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const requestUsers = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      setLoading(true);
      setError(null);

      try {
        const data = await listAdminUsers(
          customFetch,
          pagination.page,
          pagination.page_size,
          filters
        );
        setItems(data.items);
        setPagination(data.pagination);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "获取用户列表失败");
      } finally {
        setLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [customFetch, filters, pagination.page, pagination.page_size]
  );

  useEffect(() => {
    void requestUsers();
  }, [requestUsers]);

  const requestDetail = useCallback(
    async (id: number) => {
      setDetailState({ tab: "users", id, loading: true, data: null });
      try {
        const data = await getAdminUserDetail(customFetch, id);
        setDetailState({ tab: "users", id, loading: false, data });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "获取详情失败");
        setDetailState({ tab: "users", id, loading: false, data: null });
      }
    },
    [customFetch]
  );

  const handleOpenDetail = (id: number) => {
    if (detailState.tab === "users" && detailState.id === id) {
      setDetailState(emptyDetailState);
      return;
    }
    void requestDetail(id);
  };

  const handleFiltersChange = (updates: Partial<UserFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setDetailState(emptyDetailState);
    setFilters({ ...DEFAULT_USER_FILTERS });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSubmitUserUpdate = async (payload: AdminUserUpdateRequest) => {
    if (!editUserTarget) return;
    setIsSavingUser(true);
    try {
      const updated = await updateAdminUser(
        customFetch,
        editUserTarget.id,
        payload
      );
      toast.success(`已更新 ${updated.username} 的资料和权限`);
      setEditUserTarget(null);
      await requestUsers();
      if (detailState.id === updated.id) {
        setDetailState({
          tab: "users",
          id: updated.id,
          loading: false,
          data: updated,
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "更新用户失败");
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          用户管理
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          管理系统中的所有用户账户、变更角色权限及停用违规用户。
        </p>
      </div>

      <AdminToolbar
        activeTab="users"
        isRefreshing={isRefreshing}
        pageSize={pagination.page_size}
        usersFilters={filters}
        onUsersFiltersChange={handleFiltersChange}
        onPageSizeChange={(pageSize) =>
          setPagination((prev) => ({ ...prev, page: 1, page_size: pageSize }))
        }
        onRefresh={() => requestUsers(true)}
        onReset={handleResetFilters}
      />

      <AdminTable
        activeTab="users"
        users={items}
        pagination={pagination}
        loading={loading}
        error={error}
        selectedDetailId={detailState.tab === "users" ? detailState.id : null}
        onSelectRow={handleOpenDetail}
        onEditUser={setEditUserTarget}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        onRetry={() => requestUsers(true)}
      />

      <AdminDetailDrawer
        state={detailState}
        onClose={() => setDetailState(emptyDetailState)}
        onEditUser={setEditUserTarget}
        onRechargeWallet={() => {}} // User tab doesn't trigger recharge from its main list usually, but table might pass it if it reuses wallet actions.
      />

      {editUserTarget && (
        <EditUserModal
          key={`edit-${editUserTarget.id}`}
          open
          user={editUserTarget}
          submitting={isSavingUser}
          onClose={() => setEditUserTarget(null)}
          onSubmit={handleSubmitUserUpdate}
        />
      )}
    </div>
  );
}
