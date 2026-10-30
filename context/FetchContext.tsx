"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface FetchContextType {
  customFetch: (
    input: RequestInfo | URL,
    init?: RequestInit,
    needNavigate?: boolean
  ) => Promise<Response>;
}

const FetchContext = createContext<FetchContextType | undefined>(undefined);

export const FetchProvider = ({ children }: { children: ReactNode }) => {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const userRef = useRef(user);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  const customFetch = useCallback(
    async (
      input: RequestInfo | URL,
      init?: RequestInit,
      needNavigate: boolean = false
    ): Promise<Response> => {
      try {
        const response = await fetch(input, init);
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const isRefreshRequest = requestUrl.includes("/api/auth/refresh");
        const hasCachedSession =
          Boolean(userRef.current) ||
          (typeof window !== "undefined" &&
            Boolean(localStorage.getItem("user_info")));
        let finalResponse = response;

        // Access tokens are short-lived. Renew them once before treating a
        // 401 as a real logout. The single-flight promise avoids rotating the
        // refresh token multiple times for concurrent failed requests.
        if (response.status === 401 && hasCachedSession && !isRefreshRequest) {
          const refreshed = await refreshSession();
          if (refreshed) finalResponse = await fetch(input, init);
        }

        if (finalResponse.status === 401) {
          // Refresh failed (or the retried request is still unauthorized),
          // so the cached identity is no longer trustworthy.
          setUser(null);
          localStorage.removeItem("user_info");

          if (needNavigate) {
            const params = new URLSearchParams();
            if (typeof window !== "undefined") {
              params.set("callbackUrl", `${window.location.pathname}${window.location.search}${window.location.hash}`);
            }
            router.push(`/auth?${params.toString()}`);
          }
        }

        return finalResponse;
      } catch (error) {
        // Effect cleanup cancels stale requests; callers still receive the
        // rejection, but an intentional cancellation is not a network failure.
        if (!(error instanceof Error && error.name === "AbortError")) {
          console.error("Global fetch error:", error);
        }
        throw error;
      }
    },
    [refreshSession, router, setUser]
  );

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
