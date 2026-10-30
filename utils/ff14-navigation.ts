import type { Locale, ParsedReport } from "@/interfaces/ff14";

export const TIMELINE_ZOOM_LEVELS = [4, 6, 8, 10, 14, 20, 30, 40, 60] as const;
export const DEFAULT_TIMELINE_ZOOM = 7;

export interface FF14NavigationState {
  report: ParsedReport | null;
  playerId: string;
  compareActorId: string;
  zoomIndex: number;
  locale: Locale;
  showSummaryValues: boolean;
}

const isId = (value: string) => /^[1-9]\d*$/.test(value);
const isReportId = (value: string) => /^[A-Za-z0-9]+$/.test(value);
const isFightId = (value: string) => value === "last" || isId(value);

export const parseFflogsReport = (input: string): ParsedReport | null => {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();
    if (
      !["https:", "http:"].includes(url.protocol) ||
      (host !== "fflogs.com" && !host.endsWith(".fflogs.com"))
    ) {
      return null;
    }

    const reportId = url.pathname.match(/^\/reports\/([A-Za-z0-9]+)\/?$/)?.[1];
    // Older FFLogs links put the fight selection in the fragment.
    const fightId = (
      url.searchParams.get("fight") ??
      new URLSearchParams(url.hash.slice(1)).get("fight") ??
      ""
    ).trim().toLowerCase();
    return reportId && isFightId(fightId) ? { reportId, fightId } : null;
  } catch {
    return null;
  }
};

export const getFflogsReportUrl = (report: ParsedReport | null) =>
  report
    ? `https://www.fflogs.com/reports/${report.reportId}?fight=${report.fightId}`
    : "";

export const readFF14Navigation = (params: URLSearchParams): FF14NavigationState => {
  const reportId = params.get("report") ?? "";
  const fightId = params.get("fight") ?? "";
  const report = isReportId(reportId) && isFightId(fightId)
    ? { reportId, fightId }
    : null;
  const requestedPlayer = params.get("player") ?? "";
  const playerId = report && isId(requestedPlayer) ? requestedPlayer : "";
  const requestedCompare = params.get("compare") ?? "";
  const requestedZoom = params.get("zoom") ?? "";
  const zoomIndex = /^\d+$/.test(requestedZoom) ? Number(requestedZoom) : NaN;

  return {
    report,
    playerId,
    compareActorId: playerId && /^[A-Za-z0-9]+:[1-9]\d*$/.test(requestedCompare)
      ? requestedCompare
      : "",
    zoomIndex: playerId && Number.isInteger(zoomIndex) &&
      zoomIndex >= 0 && zoomIndex < TIMELINE_ZOOM_LEVELS.length
      ? zoomIndex
      : DEFAULT_TIMELINE_ZOOM,
    locale: params.get("lang") === "en" ? "en" : "zh",
    showSummaryValues: params.get("values") === "1",
  };
};

export const buildFF14NavigationUrl = (
  href: string,
  patch: Partial<FF14NavigationState>
): string => {
  const url = new URL(href);
  const previous = readFF14Navigation(url.searchParams);
  const next = { ...previous, ...patch };
  if (getFflogsReportUrl(next.report) !== getFflogsReportUrl(previous.report)) {
    next.playerId = "";
    next.compareActorId = "";
    next.zoomIndex = DEFAULT_TIMELINE_ZOOM;
  }
  if (next.playerId !== previous.playerId || !next.report || !next.playerId) {
    next.compareActorId = "";
    next.zoomIndex = DEFAULT_TIMELINE_ZOOM;
  }
  if (!next.report) next.playerId = "";

  const values: Record<string, string | null> = {
    report: next.report?.reportId ?? null,
    fight: next.report?.fightId ?? null,
    player: next.playerId || null,
    compare: next.compareActorId || null,
    zoom: next.zoomIndex === DEFAULT_TIMELINE_ZOOM ? null : String(next.zoomIndex),
    lang: next.locale === "en" ? "en" : null,
    values: next.showSummaryValues ? "1" : null,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
};
