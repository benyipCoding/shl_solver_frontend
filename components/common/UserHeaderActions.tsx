"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Image as ImageIcon, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/context/FetchContext";

const UserHeaderActions = ({
  simpleMode = false,
}: {
  simpleMode?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, login } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { customFetch } = useFetch();

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    getMe();
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Generate a consistent color from string
  const getAvatarColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-amber-500",
      "bg-green-500",
      "bg-emerald-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-sky-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-violet-500",
      "bg-purple-500",
      "bg-fuchsia-500",
      "bg-pink-500",
      "bg-rose-500",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const getMe = async () => {
    try {
      const res = await customFetch("/api/user/me");
      if (!res.ok) {
        throw new Error(`获取用户信息失败: ${res.statusText}`);
      }
      const data = await res.json();
      login(data.data);
      return;
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  return (
    <div className="flex items-center w-auto justify-end space-x-2">
      {!simpleMode && (
        <div className="hidden md:flex items-center space-x-2 text-sm text-slate-600 border-l border-slate-200 pl-3">
          <span className="flex items-center text-xs text-slate-500">
            <ImageIcon className="w-3 h-3 mr-1" /> 多图支持
          </span>
        </div>
      )}

      {!user && (
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (pathname) {
              params.set("callbackUrl", pathname);
            }
            router.push(`/auth?${params.toString()}`);
          }}
          className="flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs md:text-sm font-medium rounded-lg transition-colors ml-2 w-full md:w-auto"
        >
          <LogIn className="w-3.5 h-3.5 mr-1.5" /> 登 录
        </button>
      )}
      {user && (
        <div
          className="relative ml-4 w-full md:w-auto flex justify-end"
          ref={profileRef}
        >
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ring-2 ring-white hover:shadow-md transition-all ${getAvatarColor(
              user.username || user.email || "User"
            )}`}
            title={user.username || user.email}
          >
            {(user.username || user.email || "U").charAt(0).toUpperCase()}
          </button>

          {/* Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-10 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-fadeIn origin-top-right">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user.username || "用户"}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    logout();
                    setIsProfileOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserHeaderActions;
