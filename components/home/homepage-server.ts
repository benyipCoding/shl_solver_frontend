import "server-only";
import { isHomepageVersion, type HomepageVersion } from "./versions";

export async function getPublishedHomepageVersion(): Promise<HomepageVersion> {
  const base =
    process.env.API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!base) return 1;
  try {
    // Read the public endpoint directly; no session is needed for the portal.
    const response = await fetch(`${base.replace(/\/$/, "")}/site/homepage`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (isHomepageVersion(payload?.data?.active_version))
      return payload.data.active_version;
    throw new Error("Invalid homepage configuration");
  } catch (error) {
    console.warn(
      "Homepage configuration unavailable; using V1:",
      error instanceof Error ? error.message : "unknown error",
    );
    return 1;
  }
}
