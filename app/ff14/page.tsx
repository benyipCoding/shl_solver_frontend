"use client";
import { startTransition, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ff14/EmptyState";
import EncounterSummaryCard from "@/components/ff14/EncounterSummaryCard";
import HeroSection from "@/components/ff14/HeroSection";
import ReportInputCard from "@/components/ff14/ReportInputCard";
import SkillBreakdownCard from "@/components/ff14/SkillBreakdownCard";
import TopPlayersCard from "@/components/ff14/TopPlayersCard";
import { bodyFont, ff14Styles, headingFont, TEXT } from "@/constants/ff14";
import type {
  CharacterDetail,
  CharacterSummary,
  Locale,
  TopJobComparison,
} from "@/interfaces/ff14";
import {
  loadEncounterData,
  loadEncounterTopComparison,
  parseFflogsReport,
} from "@/utils/ff14";

type EncounterRequestState = {
  reportKey: string | null;
  summary: CharacterSummary[];
  detailsByCharacterId: Record<string, CharacterDetail>;
  detailErrorsByCharacterId: Record<string, string>;
  error: string | null;
  status: "idle" | "loading" | "loaded" | "error";
};

type TopComparisonRequestState = {
  comparisonsByKey: Record<string, TopJobComparison>;
  errorsByKey: Record<string, string>;
  loadingKeys: Record<string, boolean>;
};

type ActivePanel = "summary" | "detail";

const FF14Page = () => {
  const [reportUrl, setReportUrl] = useState("");
  const [locale, setLocale] = useState<Locale>("zh");
  const [activePanel, setActivePanel] = useState<ActivePanel>("summary");
  const [detailViewReportKey, setDetailViewReportKey] = useState<string | null>(
    null
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [showMobileSummaryValues, setShowMobileSummaryValues] = useState(false);
  const [encounterRequest, setEncounterRequest] =
    useState<EncounterRequestState>({
      reportKey: null,
      summary: [],
      detailsByCharacterId: {},
      detailErrorsByCharacterId: {},
      error: null,
      status: "idle",
    });
  const [topComparisonRequest, setTopComparisonRequest] =
    useState<TopComparisonRequestState>({
      comparisonsByKey: {},
      errorsByKey: {},
      loadingKeys: {},
    });

  const text = TEXT[locale];

  const parsedReport = useMemo(() => parseFflogsReport(reportUrl), [reportUrl]);
  const hasValidReport = Boolean(parsedReport);
  const reportKey = parsedReport
    ? `${parsedReport.reportId}:${parsedReport.fightId}`
    : null;

  const summaryState = !reportKey
    ? "idle"
    : encounterRequest.reportKey !== reportKey
      ? "loading"
      : encounterRequest.status;

  const summaryError =
    reportKey &&
    encounterRequest.reportKey === reportKey &&
    encounterRequest.status === "error"
      ? encounterRequest.error
      : null;

  const summary = useMemo(() => {
    if (
      reportKey &&
      encounterRequest.reportKey === reportKey &&
      encounterRequest.status === "loaded"
    ) {
      return encounterRequest.summary;
    }

    return [];
  }, [encounterRequest, reportKey]);

  const sortedSummary = useMemo(
    () => [...summary].sort((left, right) => right.dps - left.dps),
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

  const detailRequestKey =
    reportKey && activeSelectedCharacterId
      ? `${reportKey}:${activeSelectedCharacterId}`
      : null;

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

  const topPlayersRequestKey =
    reportKey && selectedCharacter
      ? `${reportKey}:${selectedCharacter.job}:${selectedCharacter.id}`
      : null;

  useEffect(() => {
    if (!parsedReport || !reportKey) {
      return;
    }

    const controller = new AbortController();

    startTransition(() => {
      setEncounterRequest({
        reportKey,
        summary: [],
        detailsByCharacterId: {},
        detailErrorsByCharacterId: {},
        error: null,
        status: "loading",
      });
    });

    void loadEncounterData(parsedReport, controller.signal)
      .then((nextData) => {
        if (controller.signal.aborted) {
          return;
        }

        setEncounterRequest({
          reportKey,
          summary: nextData.summary,
          detailsByCharacterId: nextData.detailsByCharacterId,
          detailErrorsByCharacterId: nextData.detailErrorsByCharacterId,
          error: null,
          status: "loaded",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setEncounterRequest({
          reportKey,
          summary: [],
          detailsByCharacterId: {},
          detailErrorsByCharacterId: {},
          error:
            error instanceof Error ? error.message : "加载 FF14 战斗汇总失败",
          status: "error",
        });
      });

    return () => {
      controller.abort();
    };
  }, [parsedReport, reportKey]);

  const cachedTopComparison = topPlayersRequestKey
    ? (topComparisonRequest.comparisonsByKey[topPlayersRequestKey] ?? null)
    : null;
  const topPlayersError = topPlayersRequestKey
    ? (topComparisonRequest.errorsByKey[topPlayersRequestKey] ?? null)
    : null;

  useEffect(() => {
    if (
      !parsedReport ||
      !selectedCharacter ||
      !topPlayersRequestKey ||
      cachedTopComparison ||
      topPlayersError
    ) {
      return;
    }

    const controller = new AbortController();

    startTransition(() => {
      setTopComparisonRequest((prev) => ({
        ...prev,
        loadingKeys: {
          ...prev.loadingKeys,
          [topPlayersRequestKey]: true,
        },
      }));
    });

    void loadEncounterTopComparison(
      parsedReport,
      selectedCharacter,
      controller.signal
    )
      .then((comparison) => {
        if (controller.signal.aborted) {
          return;
        }

        setTopComparisonRequest((prev) => {
          const nextLoadingKeys = { ...prev.loadingKeys };
          delete nextLoadingKeys[topPlayersRequestKey];

          const nextErrorsByKey = { ...prev.errorsByKey };
          delete nextErrorsByKey[topPlayersRequestKey];

          return {
            comparisonsByKey: {
              ...prev.comparisonsByKey,
              [topPlayersRequestKey]: comparison,
            },
            errorsByKey: nextErrorsByKey,
            loadingKeys: nextLoadingKeys,
          };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setTopComparisonRequest((prev) => {
          const nextLoadingKeys = { ...prev.loadingKeys };
          delete nextLoadingKeys[topPlayersRequestKey];

          return {
            comparisonsByKey: prev.comparisonsByKey,
            errorsByKey: {
              ...prev.errorsByKey,
              [topPlayersRequestKey]:
                error instanceof Error ? error.message : "加载 Top10 榜单失败",
            },
            loadingKeys: nextLoadingKeys,
          };
        });
      });

    return () => {
      controller.abort();
    };
  }, [
    cachedTopComparison,
    parsedReport,
    selectedCharacter,
    topPlayersError,
    topPlayersRequestKey,
  ]);

  const detailError =
    detailRequestKey && encounterRequest.reportKey === reportKey
      ? (encounterRequest.detailErrorsByCharacterId[
          activeSelectedCharacterId
        ] ?? null)
      : null;

  const selectedDetail =
    detailRequestKey &&
    encounterRequest.reportKey === reportKey &&
    encounterRequest.status === "loaded"
      ? (encounterRequest.detailsByCharacterId[activeSelectedCharacterId] ??
        null)
      : null;

  const topPlayersState = !topPlayersRequestKey
    ? "idle"
    : cachedTopComparison
      ? "loaded"
      : topPlayersError
        ? "error"
        : "loading";

  const selectedDetailWithTopComparison =
    selectedDetail && cachedTopComparison
      ? {
          ...selectedDetail,
          skillRows: selectedDetail.skillRows.map((row) => {
            const benchmark =
              cachedTopComparison.benchmarksByAbilityKey[row.abilityKey];

            if (!benchmark) {
              return row;
            }

            return {
              ...row,
              top10Casts: benchmark.top10Casts,
              top10Damage: benchmark.top10Damage,
            };
          }),
          topPlayers: cachedTopComparison.topPlayers,
        }
      : selectedDetail;

  const detailState = !detailRequestKey
    ? "idle"
    : encounterRequest.reportKey !== reportKey
      ? "loading"
      : summaryState === "loading"
        ? "loading"
        : selectedDetail
          ? "loaded"
          : detailError
            ? "error"
            : "idle";

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
        ? "正在加载战斗汇总与技能明细..."
        : "Loading encounter summary and skill breakdown...";
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

  const detailStatusTitle = useMemo(() => {
    if (detailState === "loading") {
      return locale === "zh"
        ? "正在加载技能明细..."
        : "Loading skill breakdown...";
    }

    if (detailState === "error") {
      return locale === "zh"
        ? "技能明细加载失败"
        : "Failed to load skill breakdown";
    }

    return locale === "zh"
      ? "当前角色没有可展示的技能数据"
      : "No skill breakdown available for this character";
  }, [detailState, locale]);

  const topPlayersStatusTitle = useMemo(() => {
    if (topPlayersState === "loading") {
      return locale === "zh"
        ? "正在加载同职业时间轴与 Top10 基准..."
        : "Loading same-job timelines and Top10 benchmarks...";
    }

    if (topPlayersState === "error") {
      return locale === "zh"
        ? "同职业时间轴加载失败"
        : "Failed to load same-job timelines";
    }

    return locale === "zh"
      ? "当前职业暂无可展示的时间轴样本"
      : "No same-job timeline samples available for this job";
  }, [locale, topPlayersState]);

  const toggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  const handleSelectCharacter = (characterId: string) => {
    setSelectedCharacterId(characterId);
    setDetailViewReportKey(reportKey);
    setActivePanel("detail");
  };

  const handleBackToSummary = () => {
    setActivePanel("summary");
  };

  const shouldShowDetailView =
    activePanel === "detail" &&
    detailViewReportKey === reportKey &&
    Boolean(selectedCharacter);

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
              shouldShowDetailView && selectedCharacter ? (
                selectedDetail ? (
                  <section className={ff14Styles.detailGrid}>
                    <SkillBreakdownCard
                      text={text}
                      selectedCharacter={selectedCharacter}
                      selectedDetail={selectedDetailWithTopComparison!}
                      isTopComparisonLoading={topPlayersState === "loading"}
                      topComparisonStatusTitle={topPlayersStatusTitle}
                      onBackToSummary={handleBackToSummary}
                    />
                    {selectedDetailWithTopComparison &&
                    topPlayersState === "loaded" ? (
                      <TopPlayersCard
                        text={text}
                        selectedCharacter={selectedCharacter}
                        topComparison={cachedTopComparison}
                      />
                    ) : (
                      <aside className={ff14Styles.card}>
                        <div className="grid gap-2">
                          <p className="m-0 font-(--font-heading) text-[1rem] text-[#edf3ff]">
                            {topPlayersStatusTitle}
                          </p>
                          <p className="m-0 text-[0.88rem] leading-[1.6] text-[#a8bddc]">
                            {topPlayersState === "error"
                              ? topPlayersError
                              : text.todoHint}
                          </p>
                        </div>
                      </aside>
                    )}
                  </section>
                ) : (
                  <section className={ff14Styles.detailGrid}>
                    <section className={ff14Styles.card}>
                      <div className={ff14Styles.cardHeader}>
                        <h2>
                          {text.skillBreakdownTitle}: {selectedCharacter.name} (
                          {selectedCharacter.job})
                        </h2>
                        <div className={ff14Styles.headerControls}>
                          <button
                            type="button"
                            className={ff14Styles.detailBackButton}
                            onClick={handleBackToSummary}
                          >
                            {text.backToSummary}
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <p className="m-0 font-(--font-heading) text-[1rem] text-[#edf3ff]">
                          {detailStatusTitle}
                        </p>
                        <p className="m-0 text-[0.88rem] leading-[1.6] text-[#a8bddc]">
                          {detailState === "error"
                            ? detailError
                            : text.todoHint}
                        </p>
                      </div>
                    </section>
                  </section>
                )
              ) : (
                <EncounterSummaryCard
                  text={text}
                  summary={sortedSummary}
                  selectedCharacterId={activeSelectedCharacterId}
                  showMobileSummaryValues={showMobileSummaryValues}
                  raidTotals={raidTotals}
                  onSelectCharacter={handleSelectCharacter}
                  onToggleMobileSummaryValues={() => {
                    setShowMobileSummaryValues((prev) => !prev);
                  }}
                />
              )
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
