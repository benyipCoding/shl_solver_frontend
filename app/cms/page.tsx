"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Users,
  Wallet,
  ScrollText,
  Activity,
  Plus,
  Edit2,
  Trash2,
  Search,
  Menu,
  X,
} from "lucide-react";

// Mock Data
const MOCK_USERS = [
  {
    id: 1,
    username: "admin",
    email: "admin@test.com",
    is_active: true,
    mobile_phone: "13800138000",
    total_token_count: 5000,
    is_staff: true,
    is_superuser: true,
    created_at: "2023-01-01",
  },
  {
    id: 2,
    username: "user1",
    email: "user1@test.com",
    is_active: true,
    mobile_phone: "13800138001",
    total_token_count: 100,
    is_staff: false,
    is_superuser: false,
    created_at: "2023-02-15",
  },
];

const MOCK_CREDITS = [
  {
    id: 1,
    user_id: 1,
    free_credits: 1000,
    paid_credits: 5000,
    last_reset_date: "2023-10-01",
    created_at: "2023-01-01",
  },
  {
    id: 2,
    user_id: 2,
    free_credits: 100,
    paid_credits: 0,
    last_reset_date: "2023-10-05",
    created_at: "2023-02-15",
  },
];

const MOCK_CREDIT_LOGS = [
  {
    id: 1,
    user_id: 2,
    amount: -5,
    credit_type: "FREE",
    action_type: "USE_FLASH_MODEL",
    balance_after: 95,
    created_at: "2023-10-10 14:00:00",
  },
  {
    id: 2,
    user_id: 1,
    amount: 1000,
    credit_type: "PAID",
    action_type: "TOP_UP",
    balance_after: 6000,
    created_at: "2023-10-11 09:30:00",
  },
];

const MOCK_TOKEN_RECORDS = [
  {
    id: 1,
    ip: "192.168.1.100",
    token_count: 50,
    model: "gpt-3.5-turbo",
    user_id: 2,
    request_path: "/api/chat",
    created_at: "2023-10-10 14:00:00",
  },
  {
    id: 2,
    ip: "10.0.0.5",
    token_count: 120,
    model: "gpt-4",
    user_id: 1,
    request_path: "/api/analyze",
    created_at: "2023-10-11 10:15:00",
  },
];

const TABS = [
  { id: "users", label: "用户管理", icon: Users },
  { id: "credits", label: "钱包管理", icon: Wallet },
  { id: "credit_logs", label: "消费记录", icon: ScrollText },
  { id: "token_records", label: "Token 记录", icon: Activity },
];

export default function CMSPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("users");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdminStatusChecked, setIsAdminStatusChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [adminRole, setAdminRole] = useState<"SuperAdmin" | "Staff" | null>(
    null
  );

  // 充值算力 states
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeEmail, setRechargeEmail] = useState("");
  const [rechargePoints, setRechargePoints] = useState<number | "">("");
  const [isRecharging, setIsRecharging] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      if (!isLoading && !user) {
        router.push("/auth");
        return;
      }

      if (!isLoading && user) {
        try {
          const res = await fetch("/api/user/me");
          if (res.ok) {
            const data = await res.json().then((res) => res.data);
            console.log(data);

            if (data.is_superuser) {
              setHasPermission(true);
              setAdminRole("SuperAdmin");
            } else if (data.is_staff) {
              setHasPermission(true);
              setAdminRole("Staff");
            } else {
              router.push("/");
            }
          } else {
            router.push("/auth");
          }
        } catch (error) {
          console.error("Failed to verify user permissions", error);
          router.push("/");
        } finally {
          setIsAdminStatusChecked(true);
        }
      }
    };

    checkPermission();
  }, [user, isLoading, router]);

  if (isLoading || !isAdminStatusChecked || !hasPermission) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500">
        <Activity className="animate-spin w-8 h-8 mr-2" />
        加载中...
      </div>
    );
  }

  const handleRecharge = async () => {
    if (!rechargeEmail || !rechargePoints) {
      alert("请填写邮箱和充值点数");
      return;
    }
    if (Number(rechargePoints) <= 0) {
      alert("充值点数必须大于0");
      return;
    }

    setIsRecharging(true);
    try {
      const res = await fetch("/api/wallet_credit/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: rechargeEmail,
          points: Number(rechargePoints),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "充值失败");
      }

      alert(`充值成功！当前余额：${data.data?.balance_after}`);
      setShowRechargeModal(false);
      setRechargeEmail("");
      setRechargePoints("");
      // Refresh credits logic goes here if needed
    } catch (err: any) {
      alert(err.message || "系统错误，请稍后重试");
    } finally {
      setIsRecharging(false);
    }
  };

  const renderTable = () => {
    switch (activeTab) {
      case "users":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">用户名</th>
                  <th className="px-4 py-3">邮箱</th>
                  <th className="px-4 py-3">手机号</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">Token总数</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_USERS.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {u.id}
                    </td>
                    <td className="px-4 py-3">{u.username}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.mobile_phone || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {u.is_active ? "正常" : "禁用"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{u.total_token_count}</td>
                    <td className="px-4 py-3 flex gap-1">
                      {u.is_superuser && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                          SuperAdmin
                        </span>
                      )}
                      {u.is_staff && !u.is_superuser && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          Staff
                        </span>
                      )}
                      {!u.is_superuser && !u.is_staff && (
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "credits":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">用户ID</th>
                  <th className="px-4 py-3">免费点数</th>
                  <th className="px-4 py-3">付费点数</th>
                  <th className="px-4 py-3">上次重置</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_CREDITS.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {c.id}
                    </td>
                    <td className="px-4 py-3">{c.user_id}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">
                      {c.free_credits}
                    </td>
                    <td className="px-4 py-3 text-blue-600 font-semibold">
                      {c.paid_credits}
                    </td>
                    <td className="px-4 py-3">{c.last_reset_date || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "credit_logs":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">用户ID</th>
                  <th className="px-4 py-3">变动额度</th>
                  <th className="px-4 py-3">点数类型</th>
                  <th className="px-4 py-3">动作类型</th>
                  <th className="px-4 py-3">变动后余额</th>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_CREDIT_LOGS.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {l.id}
                    </td>
                    <td className="px-4 py-3">{l.user_id}</td>
                    <td
                      className={`px-4 py-3 font-bold ${l.amount > 0 ? "text-green-500" : "text-red-500"}`}
                    >
                      {l.amount > 0 ? `+${l.amount}` : l.amount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${l.credit_type === "FREE" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}
                      >
                        {l.credit_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">{l.action_type}</td>
                    <td className="px-4 py-3">{l.balance_after}</td>
                    <td className="px-4 py-3">{l.created_at}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "token_records":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">用户ID</th>
                  <th className="px-4 py-3">Token数</th>
                  <th className="px-4 py-3">模型</th>
                  <th className="px-4 py-3">请求路径</th>
                  <th className="px-4 py-3">IP地址</th>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TOKEN_RECORDS.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {t.id}
                    </td>
                    <td className="px-4 py-3">{t.user_id}</td>
                    <td className="px-4 py-3 text-orange-600 font-semibold">
                      {t.token_count}
                    </td>
                    <td className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded font-mono text-xs">
                      {t.model || "-"}
                    </td>
                    <td className="px-4 py-3 truncate max-w-xs">
                      {t.request_path || "-"}
                    </td>
                    <td className="px-4 py-3">{t.ip}</td>
                    <td className="px-4 py-3">{t.created_at}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 w-64 h-screen transition-transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            内容管理系统
          </h1>
          <button
            className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-2 px-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center p-2 rounded-lg transition-colors
                      ${
                        isActive
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <span className="w-2 h-2 mr-2 bg-green-500 rounded-full"></span>
            当前身份：{adminRole}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 transition-all duration-300 ease-in-out h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <button
              className="mr-3 md:hidden p-2 text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-[none] focus:ring-2 focus:ring-blue-300"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative hidden sm:block">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
              <input
                type="text"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="搜索..."
              />
            </div>

            {activeTab === "credits" && (
              <button
                onClick={() => setShowRechargeModal(true)}
                className="flex items-center justify-center p-2 text-sm font-medium text-white rounded-lg bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 dark:focus:ring-green-800"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">充值算力</span>
              </button>
            )}

            <button className="flex items-center justify-center p-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">新增</span>
            </button>
          </div>
        </header>

        {/* Table Area */}
        <div className="p-4 md:p-6 flex-1 overflow-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            {renderTable()}

            {/* Pagination Controls */}
            <nav
              className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0 p-4 border-t border-gray-200 dark:border-gray-700"
              aria-label="Table navigation"
            >
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                显示{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  1-10
                </span>{" "}
                项，共{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  1000
                </span>{" "}
                项
              </span>
              <ul className="inline-flex items-stretch -space-x-px">
                <li>
                  <button className="flex items-center justify-center h-full py-1.5 px-3 ml-0 text-gray-500 bg-white rounded-l-lg border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                    <span className="sr-only">Previous</span>
                    &lt;
                  </button>
                </li>
                <li>
                  <button className="flex items-center justify-center text-sm py-2 px-3 leading-tight text-blue-600 bg-blue-50 border border-blue-300 hover:bg-blue-100 focus:z-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    1
                  </button>
                </li>
                <li>
                  <button className="flex items-center justify-center text-sm py-2 px-3 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                    2
                  </button>
                </li>
                <li>
                  <button className="flex items-center justify-center text-sm py-2 px-3 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                    3
                  </button>
                </li>
                <li>
                  <button className="flex items-center justify-center h-full py-1.5 px-3 leading-tight text-gray-500 bg-white rounded-r-lg border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                    <span className="sr-only">Next</span>
                    &gt;
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </main>

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                充值算力
              </h3>
              <button
                onClick={() => setShowRechargeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  用户邮箱
                </label>
                <input
                  type="email"
                  value={rechargeEmail}
                  onChange={(e) => setRechargeEmail(e.target.value)}
                  placeholder="admin@test.com"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  充值点数
                </label>
                <input
                  type="number"
                  value={rechargePoints}
                  onChange={(e) =>
                    setRechargePoints(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  placeholder="100"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowRechargeModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleRecharge}
                disabled={isRecharging}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isRecharging ? (
                  <span className="flex items-center">
                    <Activity className="animate-spin w-4 h-4 mr-2" />
                    充值中...
                  </span>
                ) : (
                  "确认充值"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
