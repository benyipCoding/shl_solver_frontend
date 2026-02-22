"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useRef,
  use,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

interface FetchContextType {
  customFetch: (
    input: RequestInfo | URL,
    init?: RequestInit,
    needNavigate?: boolean
  ) => Promise<Response>;
}

const FetchContext = createContext<FetchContextType | undefined>(undefined);

export const FetchProvider = ({ children }: { children: ReactNode }) => {
  const { setUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const customFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
    needNavigate: boolean = false
  ): Promise<Response> => {
    try {
      const response = await fetch(input, init);

      if (response.status === 401) {
        // 401 错误，尝试刷新 Token
        setUser(null); // 清除用户信息，触发前端重新获取用户状态
        // 注意：这里不直接调用刷新接口，而是依赖前端的用户状态变化来触发重新获取用户信息
        localStorage.removeItem("user_info");

        if (needNavigate) {
          const params = new URLSearchParams();
          if (pathname) {
            params.set("callbackUrl", pathname);
          }
          router.push(`/auth?${params.toString()}`);
        }
      }

      return response;
    } catch (error) {
      console.error("Global fetch error:", error);
      throw error;
    }
  };

  return (
    <FetchContext.Provider value={{ customFetch }}>
      {children}
    </FetchContext.Provider>
  );
};

export const useFetch = () => {
  const context = useContext(FetchContext);
  if (context === undefined) {
    throw new Error("useFetch must be used within a FetchProvider");
  }
  return context;
};
