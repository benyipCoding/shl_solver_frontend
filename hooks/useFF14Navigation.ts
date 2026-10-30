"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildFF14NavigationUrl,
  readFF14Navigation,
  type FF14NavigationState,
} from "@/utils/ff14-navigation";

export const useFF14Navigation = () => {
  const searchParams = useSearchParams();
  const navigation = useMemo(
    () => readFF14Navigation(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const navigate = useCallback((
    patch: Partial<FF14NavigationState> | ((current: FF14NavigationState) => Partial<FF14NavigationState>),
    mode: "push" | "replace" = "push"
  ) => {
    // Read the current URL so rapid clicks/wheel events cannot overwrite each other.
    const current = new URL(window.location.href);
    const nextUrl = buildFF14NavigationUrl(
      current.href,
      typeof patch === "function" ? patch(readFF14Navigation(current.searchParams)) : patch
    );
    if (nextUrl === `${current.pathname}${current.search}${current.hash}`) return;

    // Next.js syncs native history with useSearchParams without fetching a new page.
    if (mode === "replace") window.history.replaceState(null, "", nextUrl);
    else window.history.pushState(null, "", nextUrl);
  }, []);

  return { navigation, navigate };
};
