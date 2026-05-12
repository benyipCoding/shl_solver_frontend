"use client";

import { ReactNode, useEffect } from "react";
import { ensurePostHogInitialized } from "@/utils/posthog";

export const PostHogProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    ensurePostHogInitialized();
  }, []);

  return <>{children}</>;
};
