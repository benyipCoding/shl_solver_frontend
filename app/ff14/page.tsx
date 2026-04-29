"use client";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ff14/EmptyState";
import EncounterSummaryCard from "@/components/ff14/EncounterSummaryCard";
import HeroSection from "@/components/ff14/HeroSection";
import ReportInputCard from "@/components/ff14/ReportInputCard";
import SkillBreakdownCard from "@/components/ff14/SkillBreakdownCard";
import TopPlayersCard from "@/components/ff14/TopPlayersCard";
import { bodyFont, ff14Styles, headingFont, TEXT } from "@/constants/ff14";
import type { CharacterSummary, Locale } from "@/interfaces/ff14";
import {
  buildCharacterDetail,
  loadEncounterSummary,
  parseFflogsReport,
} from "@/utils/ff14";

type SummaryRequestState = {
  reportKey: string | null;
  summary: CharacterSummary[];
  error: string | null;
  status: "idle" | "loaded" | "error";
};

const FF14Page = () => {
  const [reportUrl, setReportUrl] = useState("");
  const [locale, setLocale] = useState<Locale>("zh");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [showMobileSummaryValues, setShowMobileSummaryValues] = useState(false);
  const [summaryRequest, setSummaryRequest] = useState<SummaryRequestState>({
    reportKey: null,
    summary: [],
    error: null,
    status: "idle",
  });

  const text = TEXT[locale];

  const parsedReport = useMemo(() => parseFflogsReport(reportUrl), [reportUrl]);
  const hasValidReport = Boolean(parsedReport);
  const reportKey = parsedReport
    ? `${parsedReport.reportId}:${parsedReport.fightId}`
    : null;

  const summaryState = !reportKey
    ? "idle"
    : summaryRequest.reportKey !== reportKey
      ? "loading"
      : summaryRequest.status;

  const summaryError =
    reportKey &&
    summaryRequest.reportKey === reportKey &&
    summaryRequest.status === "error"
      ? summaryRequest.error
      : null;

  const summary = useMemo(() => {
    if (
      reportKey &&
      summaryRequest.reportKey === reportKey &&
      summaryRequest.status === "loaded"
    ) {
      return summaryRequest.summary;
    }

    return [];
  }, [reportKey, summaryRequest]);

  const sortedSummary = useMemo(
    () => [...summary].sort((left, right) => right.rdps - left.rdps),
    [summary]
  );

  const activeSelectedCharacterId = useMemo(() => {
    if (!sortedSummary.length) {
      return "";
    }

    return sortedSummary.some((item) => item.id === selectedCharacterId)
      ? selectedCharacterId
      : (sortedSummary[0]?.id ?? "");
  }, [selectedCharacterId, sortedSummary]);

  useEffect(() => {
    if (!parsedReport || !reportKey) {
      return;
    }

    const controller = new AbortController();

    void loadEncounterSummary(parsedReport, controller.signal)
      .then((nextSummary) => {
        if (controller.signal.aborted) {
          return;
        }

        setSummaryRequest({
          reportKey,
          summary: nextSummary,
          error: null,
          status: "loaded",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setSummaryRequest({
          reportKey,
          summary: [],
          error:
            error instanceof Error ? error.message : "加载 FF14 战斗汇总失败",
          status: "error",
        });
      });

    return () => {
      controller.abort();
    };
  }, [parsedReport, reportKey]);

  const selectedCharacter = useMemo(() => {
    if (!sortedSummary.length) {
      return null;
    }

    return (
      sortedSummary.find((item) => item.id === activeSelectedCharacterId) ??
      sortedSummary[0] ??
      null
    );
  }, [activeSelectedCharacterId, sortedSummary]);

  const selectedDetail = useMemo(() => {
    if (!selectedCharacter) {
      return null;
    }

    return buildCharacterDetail(selectedCharacter);
  }, [selectedCharacter]);

  const raidTotals = useMemo(() => {
    const totalDamage = sortedSummary.reduce(
      (sum, item) => sum + (item.totalDamage ?? 0),
      0
    );
    const maxDamage = Math.max(
      ...sortedSummary.map((item) => item.totalDamage ?? 0),
      1
    );

    return {
      totalDamage,
      maxDamage,
    };
  }, [sortedSummary]);

  const summaryStatusTitle = useMemo(() => {
    if (summaryState === "loading") {
      return locale === "zh"
        ? "正在加载战斗汇总..."
        : "Loading encounter summary...";
    }

    if (summaryState === "error") {
      return locale === "zh"
        ? "战斗汇总加载失败"
        : "Failed to load encounter summary";
    }

    return locale === "zh"
      ? "当前战斗没有可展示的玩家数据"
      : "No player summary available for this fight";
  }, [locale, summaryState]);

  const toggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  return (
    <main
      className={`${ff14Styles.page} ${headingFont.variable} ${bodyFont.variable}`}
    >
      <div className={ff14Styles.backdropA} aria-hidden />
      <div className={ff14Styles.backdropB} aria-hidden />

      <div className={ff14Styles.container}>
        <HeroSection text={text} />

        <ReportInputCard
          text={text}
          locale={locale}
          hasValidReport={hasValidReport}
          reportUrl={reportUrl}
          parsedReport={parsedReport}
          onToggleLocale={toggleLocale}
          onReportUrlChange={setReportUrl}
        />

        {hasValidReport ? (
          <>
            {summaryState === "loaded" && sortedSummary.length ? (
              <>
                <EncounterSummaryCard
                  text={text}
                  summary={sortedSummary}
                  selectedCharacterId={activeSelectedCharacterId}
                  showMobileSummaryValues={showMobileSummaryValues}
                  raidTotals={raidTotals}
                  onSelectCharacter={setSelectedCharacterId}
                  onToggleMobileSummaryValues={() => {
                    setShowMobileSummaryValues((prev) => !prev);
                  }}
                />

                {selectedCharacter && selectedDetail ? (
                  <section className={ff14Styles.detailGrid}>
                    <SkillBreakdownCard
                      text={text}
                      selectedCharacter={selectedCharacter}
                      selectedDetail={selectedDetail}
                    />
                    <TopPlayersCard
                      text={text}
                      selectedCharacter={selectedCharacter}
                      selectedDetail={selectedDetail}
                    />
                  </section>
                ) : null}
              </>
            ) : (
              <section className={ff14Styles.card}>
                <div className="grid gap-2">
                  <p className="m-0 font-(--font-heading) text-[1rem] text-[#edf3ff]">
                    {summaryStatusTitle}
                  </p>
                  <p className="m-0 text-[0.88rem] leading-[1.6] text-[#a8bddc]">
                    {summaryState === "error" ? summaryError : text.todoHint}
                  </p>
                </div>
              </section>
            )}
          </>
        ) : (
          <EmptyState text={text} />
        )}
      </div>
    </main>
  );
};

export default FF14Page;
