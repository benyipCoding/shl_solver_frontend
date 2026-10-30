"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
} from "react";
import { useFetch } from "@/context/FetchContext";
import type { CmsStore } from "./data-store";
import { CMS_LIST_ROUTES, DEFAULT_CMS_VIEW, loadCmsList } from "./list-data";
import LoadingNotice from "./LoadingNotice";

const NavigationContext = createContext<((href: string) => void) | null>(null);

export function CmsNavigationProvider({
  store,
  children,
}: {
  store: CmsStore;
  children: React.ReactNode;
}) {
  const { customFetch } = useFetch();
  const router = useRouter();
  const pathname = usePathname();
  const sequence = useRef(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const cancel = () => {
      sequence.current += 1;
      setPendingHref(null);
    };
    window.addEventListener("popstate", cancel);
    return () => {
      sequence.current += 1;
      window.removeEventListener("popstate", cancel);
    };
  }, []);

  const navigate = useCallback(
    async (href: string) => {
      const request = ++sequence.current;
      if (href === pathname) {
        setPendingHref(null);
        return;
      }
      setPendingHref(href);
      router.prefetch(href);
      const tab = CMS_LIST_ROUTES[href];
      if (tab) {
        // Keep the outgoing page intact until the destination can render its real
        // rows (or error) in one commit, including the first visit to this menu.
        await loadCmsList(
          store,
          customFetch,
          tab,
          store.getView(tab, DEFAULT_CMS_VIEW),
        );
      }
      if (request !== sequence.current) return;
      startTransition(() => {
        router.push(href);
        setPendingHref(null);
      });
    },
    [customFetch, pathname, router, store],
  );

  return (
    <NavigationContext.Provider value={navigate}>
      {children}
      {pendingHref && (
        <LoadingNotice key={pendingHref}>正在打开页面…</LoadingNotice>
      )}
    </NavigationContext.Provider>
  );
}

export default function CmsLink({
  href,
  onNavigate,
  ...props
}: ComponentProps<typeof Link>) {
  const navigate = useContext(NavigationContext);
  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        if (
          navigate &&
          typeof href === "string" &&
          (href === "/cms" || href.startsWith("/cms/"))
        ) {
          event.preventDefault();
          navigate(href);
        }
        // Next's onNavigate preserves Cmd/Ctrl-click, downloads and external links.
        onNavigate?.(event);
      }}
    />
  );
}
