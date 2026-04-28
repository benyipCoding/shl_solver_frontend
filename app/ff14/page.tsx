"use client";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ff14/EmptyState";
import EncounterSummaryCard from "@/components/ff14/EncounterSummaryCard";
import HeroSection from "@/components/ff14/HeroSection";
import ReportInputCard from "@/components/ff14/ReportInputCard";
import SkillBreakdownCard from "@/components/ff14/SkillBreakdownCard";
import TopPlayersCard from "@/components/ff14/TopPlayersCard";
import {
  bodyFont,
  ff14Styles,
  headingFont,
  MOCK_SUMMARY,
  TEXT,
} from "@/constants/ff14";
import type { Locale } from "@/interfaces/ff14";
import { buildCharacterDetail, parseFflogsReport } from "@/utils/ff14";

const FF14Page = () => {
  const [reportUrl, setReportUrl] = useState(
    "https://www.fflogs.com/reports/yZrcbBYf8GL9TqCF?fight=112"
  );
  const [locale, setLocale] = useState<Locale>("zh");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(
    MOCK_SUMMARY[0]?.id ?? ""
  );
  const [showMobileSummaryValues, setShowMobileSummaryValues] = useState(false);

  const text = TEXT[locale];

  const parsedReport = useMemo(() => parseFflogsReport(reportUrl), [reportUrl]);
  const hasValidReport = Boolean(parsedReport);

  const sortedSummary = useMemo(
    () => [...MOCK_SUMMARY].sort((a, b) => b.rdps - a.rdps),
    []
  );

  useEffect(() => {
    if (!hasValidReport) {
      return;
    }

    // TODO: Replace mock data with backend call based on reportUrl.
    // Example: GET /api/ff14/report?url=${encodeURIComponent(reportUrl)}
    // Then hydrate summary rows + per-character skill details.
  }, [hasValidReport, reportUrl]);

  const selectedCharacter = useMemo(() => {
    if (!hasValidReport) {
      return null;
    }

    return (
      sortedSummary.find((item) => item.id === selectedCharacterId) ??
      sortedSummary[0] ??
      null
    );
  }, [hasValidReport, selectedCharacterId, sortedSummary]);

  const selectedDetail = useMemo(() => {
    if (!selectedCharacter) {
      return null;
    }

    return buildCharacterDetail(selectedCharacter);
  }, [selectedCharacter]);

  const raidTotals = useMemo(() => {
    const raidRdps = sortedSummary.reduce((sum, item) => sum + item.rdps, 0);
    const maxRdps = sortedSummary[0]?.rdps ?? 1;

    return {
      raidRdps,
      maxRdps,
    };
  }, [sortedSummary]);

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
            <EncounterSummaryCard
              text={text}
              summary={sortedSummary}
              selectedCharacterId={selectedCharacterId}
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
          <EmptyState text={text} />
        )}
      </div>
    </main>
  );
};

export default FF14Page;
