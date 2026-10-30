import type { CmsFetcher } from "@/interfaces/cms";
import {
  isHomepageVersion,
  type HomepageConfig,
  type HomepageVersion,
} from "./versions";

async function requestConfig(
  fetcher: CmsFetcher,
  init?: RequestInit,
): Promise<HomepageConfig> {
  const response = await fetcher(
    "/api/admin/homepage",
    { ...init, cache: "no-store" },
    true,
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.detail || payload?.message || payload?.error;
    throw new Error(
      typeof message === "string" ? message : `请求失败 (${response.status})`,
    );
  }
  if (
    !isHomepageVersion(payload?.data?.active_version) ||
    !Number.isInteger(payload?.data?.revision)
  ) {
    throw new Error("服务端返回的首页版本配置无效");
  }
  return payload.data;
}

export const getAdminHomepage = (fetcher: CmsFetcher) => requestConfig(fetcher);

export const publishAdminHomepage = (
  fetcher: CmsFetcher,
  version: HomepageVersion,
  revision: number,
) =>
  requestConfig(fetcher, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      active_version: version,
      expected_revision: revision,
    }),
  });
