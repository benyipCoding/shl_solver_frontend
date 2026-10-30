"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { CmsStore } from "./data-store";
import { CmsNavigationProvider } from "./CmsLink";

const Context = createContext<CmsStore | null>(null);

export default function CmsDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store] = useState(() => new CmsStore());
  return (
    <Context.Provider value={store}>
      <CmsNavigationProvider store={store}>{children}</CmsNavigationProvider>
    </Context.Provider>
  );
}

export function useCmsStore() {
  const store = useContext(Context);
  if (!store) throw new Error("CMS data provider is missing");
  return store;
}

export function useCmsResource<T>(key: string) {
  const store = useCmsStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.get<T>(key),
    () => store.get<T>(key),
  );
}
