"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { User } from "@/interfaces/auth";
import toast from "react-hot-toast";
import { identifyPostHogUser, resetPostHogUser } from "@/utils/posthog";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousUserIdRef = useRef<User["id"] | null>(null);

  // 初始化时从 localStorage 恢复用户会话
  useEffect(() => {
    let isMounted = true;
    const storedUser = localStorage.getItem("user_info");
    let parsedUser: User | null = null;

    if (storedUser) {
      try {
        parsedUser = JSON.parse(storedUser);
      } catch (error) {
        console.error("Failed to parse user info from storage", error);
        localStorage.removeItem("user_info");
      }
    }

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      if (parsedUser) {
        setUser(parsedUser);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (user) {
      if (previousUserIdRef.current !== user.id) {
        identifyPostHogUser(user);
        previousUserIdRef.current = user.id;
      }
      return;
    }

    if (previousUserIdRef.current !== null) {
      resetPostHogUser();
      previousUserIdRef.current = null;
    }
  }, [isLoading, user]);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem(
      "user_info",
      JSON.stringify({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        is_staff: userData.is_staff,
        is_superuser: userData.is_superuser,
      })
    );
  };

  const logout = async () => {
    // 调用后端登出接口
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      setUser(null);
      localStorage.removeItem("user_info");
      // router.push("/auth"); // 登出后跳转到登录页
    } catch (error) {
      console.error("登出错误:", error);
      toast.error("登出错误");
      // 即使请求错误，也清除本地状态
      setUser(null);
      localStorage.removeItem("user_info");
      // router.push("/auth");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
