"use client";

import posthog from "posthog-js";
import { User } from "@/interfaces/auth";

let hasInitializedPostHog = false;

export const ensurePostHogInitialized = () => {
  if (hasInitializedPostHog || typeof window === "undefined") {
    return hasInitializedPostHog;
  }

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!posthogKey || !posthogHost) {
    return false;
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: true,
    capture_pageview: "history_change",
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });

  hasInitializedPostHog = true;
  return true;
};

export const identifyPostHogUser = (user: User) => {
  if (!user?.id) {
    return;
  }

  if (!ensurePostHogInitialized()) {
    return;
  }

  posthog.identify(String(user.id), {
    email: user.email,
    username: user.username,
    is_staff: user.is_staff,
    is_superuser: user.is_superuser,
  });
};

export const resetPostHogUser = () => {
  if (!ensurePostHogInitialized()) {
    return;
  }

  posthog.reset();
};
