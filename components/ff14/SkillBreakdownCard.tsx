import Image from "next/image";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Activity, ArrowLeft, Crosshair, Gauge, Trophy } from "lucide-react";

import { ff14Styles } from "@/constants/ff14";
import type {
  CharacterDetail,
  CharacterSummary,
  StaticText,
} from "@/interfaces/ff14";
import { formatNumber } from "@/utils/ff14";

const skillHighlightStyles = {
  castHitMismatch: {
    rowClassName:
      "!bg-[linear-gradient(90deg,rgba(95,217,255,0.17),rgba(95,217,255,0.05))] !shadow-[inset_4px_0_0_rgba(114,224,255,0.96)] hover:!bg-[linear-gradient(90deg,rgba(95,217,255,0.22),rgba(95,217,255,0.07))]",
    mobileCardClassName:
      "!border-[rgba(114,224,255,0.5)] !bg-[linear-gradient(135deg,rgba(12,46,63,0.82),rgba(15,31,54,0.94))] !shadow-[inset_4px_0_0_rgba(114,224,255,0.96)]",
    legendClassName:
      "border-[rgba(114,224,255,0.38)] bg-[rgba(18,75,101,0.28)] text-[#d8f8ff]",
    tooltipClassName:
      "border-[rgba(114,224,255,0.44)] bg-[rgba(7,31,44,0.96)] text-[#ddf8ff]",
    dotClassName: "bg-[#72dcff]",
  },
  unexpectedCast: {
    rowClassName:
      "!bg-[linear-gradient(90deg,rgba(255,193,94,0.18),rgba(255,193,94,0.05))] !shadow-[inset_4px_0_0_rgba(255,196,104,0.96)] hover:!bg-[linear-gradient(90deg,rgba(255,193,94,0.23),rgba(255,193,94,0.08))]",
    mobileCardClassName:
      "!border-[rgba(255,196,104,0.48)] !bg-[linear-gradient(135deg,rgba(70,45,12,0.82),rgba(18,28,50,0.94))] !shadow-[inset_4px_0_0_rgba(255,196,104,0.96)]",
    legendClassName:
      "border-[rgba(255,196,104,0.38)] bg-[rgba(102,73,20,0.28)] text-[#ffebc0]",
    tooltipClassName:
      "border-[rgba(255,196,104,0.44)] bg-[rgba(46,31,8,0.96)] text-[#fff1cf]",
    dotClassName: "bg-[#ffc468]",
  },
  missingCast: {
    rowClassName:
      "!bg-[linear-gradient(90deg,rgba(255,125,125,0.18),rgba(255,125,125,0.05))] !shadow-[inset_4px_0_0_rgba(255,138,138,0.96)] hover:!bg-[linear-gradient(90deg,rgba(255,125,125,0.24),rgba(255,125,125,0.08))]",
    mobileCardClassName:
      "!border-[rgba(255,138,138,0.48)] !bg-[linear-gradient(135deg,rgba(74,24,32,0.84),rgba(18,28,50,0.94))] !shadow-[inset_4px_0_0_rgba(255,138,138,0.96)]",
    legendClassName:
      "border-[rgba(255,138,138,0.38)] bg-[rgba(102,34,46,0.28)] text-[#ffd6d6]",
    tooltipClassName:
      "border-[rgba(255,138,138,0.44)] bg-[rgba(44,12,18,0.96)] text-[#ffe0e0]",
    dotClassName: "bg-[#ff8a8a]",
  },
} as const;

type SkillHighlightKind = keyof typeof skillHighlightStyles;

interface ActiveSkillTooltip {
  abilityKey: string;
  kind: SkillHighlightKind;
  reason: string;
  top: number;
  left: number;
  root: HTMLElement;
}

const SKILL_TOOLTIP_WIDTH_PX = 280;
const SKILL_TOOLTIP_EDGE_GAP_PX = 18;
const SKILL_TOOLTIP_OFFSET_PX = 20;
const SKILL_TOOLTIP_HEIGHT_PX = 88;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface SkillBreakdownCardProps {
  text: StaticText;
  selectedCharacter: CharacterSummary;
  selectedDetail: CharacterDetail;
  hasTopComparisonData: boolean;
  isTopComparisonLoading: boolean;
  topComparisonStatusTitle: string;
  onBackToSummary: () => void;
}

const SkillBreakdownCard = ({
  text,
  selectedCharacter,
  selectedDetail,
  hasTopComparisonData,
  isTopComparisonLoading,
  topComparisonStatusTitle,
  onBackToSummary,
}: SkillBreakdownCardProps) => {
  const [activeTooltip, setActiveTooltip] = useState<ActiveSkillTooltip | null>(
    null
  );
  const sortedSkillRows = [...selectedDetail.skillRows].sort(
    (left, right) => right.damage - left.damage
  );
  const totalDamage = Math.max(
    sortedSkillRows.reduce((sum, skill) => sum + skill.damage, 0),
    1
  );
  const maxDamage = Math.max(
    ...sortedSkillRows.map((skill) => skill.damage),
    1
  );
  const pendingValueClassName = isTopComparisonLoading
    ? "text-[#9fb9df] animate-pulse"
    : "text-[#9fb9df]";
  const pendingMobileDeltaClassName = isTopComparisonLoading
    ? "border-[rgba(126,173,249,0.32)] bg-[rgba(34,58,99,0.24)] text-[#d7e6ff] animate-pulse"
    : "border-[rgba(126,173,249,0.32)] bg-[rgba(34,58,99,0.24)] text-[#d7e6ff]";
  const canEvaluateHighlights = hasTopComparisonData && !isTopComparisonLoading;

  const formatBenchmarkCasts = (value: number | null) =>
    value === null ? "N/A" : String(value);
  const formatBenchmarkHits = (value: number | null) =>
    value === null ? "N/A" : String(value);
  const formatSignedCount = (value: number | null) =>
    value === null ? "N/A" : value > 0 ? `+${value}` : String(value);
  const formatSignedRdps = (value: number | null) => {
    if (value === null) {
      return "N/A";
    }

    const formatted = formatNumber(value);

    return value > 0 ? `+${formatted}` : formatted;
  };

  const showTooltip = (
    rowElement: HTMLDivElement,
    abilityKey: string,
    highlight: { kind: SkillHighlightKind; reason: string },
    clientX: number,
    clientY: number
  ) => {
    const mainElement = rowElement.closest("main");

    if (!(mainElement instanceof HTMLElement)) {
      setActiveTooltip(null);
      return;
    }

    const mainRect = mainElement.getBoundingClientRect();
    const preferredLeft = clientX - mainRect.left + SKILL_TOOLTIP_OFFSET_PX;
    const fallbackLeft =
      clientX -
      mainRect.left -
      SKILL_TOOLTIP_WIDTH_PX -
      SKILL_TOOLTIP_OFFSET_PX;
    const resolvedLeft =
      preferredLeft + SKILL_TOOLTIP_WIDTH_PX <=
      mainRect.width - SKILL_TOOLTIP_EDGE_GAP_PX
        ? preferredLeft
        : fallbackLeft;
    const preferredTop = clientY - mainRect.top + SKILL_TOOLTIP_OFFSET_PX;
    const fallbackTop =
      clientY -
      mainRect.top -
      SKILL_TOOLTIP_HEIGHT_PX -
      SKILL_TOOLTIP_OFFSET_PX;
    const resolvedTop =
      preferredTop + SKILL_TOOLTIP_HEIGHT_PX <=
      mainRect.height - SKILL_TOOLTIP_EDGE_GAP_PX
        ? preferredTop
        : fallbackTop;

    setActiveTooltip({
      abilityKey,
      kind: highlight.kind,
      reason: highlight.reason,
      top: clamp(
        resolvedTop,
        SKILL_TOOLTIP_EDGE_GAP_PX,
        Math.max(
          SKILL_TOOLTIP_EDGE_GAP_PX,
          mainRect.height - SKILL_TOOLTIP_HEIGHT_PX - SKILL_TOOLTIP_EDGE_GAP_PX
        )
      ),
      left: clamp(
        resolvedLeft,
        SKILL_TOOLTIP_EDGE_GAP_PX,
        Math.max(
          SKILL_TOOLTIP_EDGE_GAP_PX,
          mainRect.width - SKILL_TOOLTIP_WIDTH_PX - SKILL_TOOLTIP_EDGE_GAP_PX
        )
      ),
      root: mainElement,
    });
  };

  const hideTooltip = () => {
    setActiveTooltip(null);
  };

  const resolveHighlight = ({
    skill,
    castDelta,
    hitDelta,
  }: {
    skill: CharacterDetail["skillRows"][number];
    castDelta: number | null;
    hitDelta: number | null;
  }) => {
    if (!canEvaluateHighlights) {
      return null;
    }

    if (castDelta !== null && hitDelta !== null && castDelta > hitDelta) {
      return {
        kind: "castHitMismatch" as SkillHighlightKind,
        reason: text.highlightTooltipCastHitMismatch,
      };
    }

    if ((skill.top10Casts === null || skill.top10Casts === 0) && skill.casts) {
      return {
        kind: "unexpectedCast" as SkillHighlightKind,
        reason: text.highlightTooltipUnexpectedCast,
      };
    }

    if (castDelta !== null && castDelta < 0) {
      return {
        kind: "missingCast" as SkillHighlightKind,
        reason: text.highlightTooltipMissingCast,
      };
    }

    return null;
  };

  const highlightLegendItems = [
    {
      kind: "castHitMismatch" as SkillHighlightKind,
      label: text.highlightLegendCastHitMismatch,
    },
    {
      kind: "unexpectedCast" as SkillHighlightKind,
      label: text.highlightLegendUnexpectedCast,
    },
    {
      kind: "missingCast" as SkillHighlightKind,
      label: text.highlightLegendMissingCast,
    },
  ];

  const displayRows = sortedSkillRows.map((skill, index) => {
    const castDelta =
      skill.top10Casts === null ? null : skill.casts - skill.top10Casts;
    const hitDelta =
      skill.top10Hits === null ? null : skill.hits - skill.top10Hits;
    const rdpsDelta =
      skill.top10Rdps === null ? null : skill.rdps - skill.top10Rdps;
    const castDeltaClassName =
      castDelta === null
        ? pendingValueClassName
        : castDelta >= 0
          ? ff14Styles.deltaGood
          : ff14Styles.deltaBad;
    const mobileCastDeltaClassName =
      castDelta === null
        ? pendingMobileDeltaClassName
        : castDelta >= 0
          ? ff14Styles.skillMobileDeltaGood
          : ff14Styles.skillMobileDeltaBad;
    const hitDeltaClassName =
      hitDelta === null
        ? pendingValueClassName
        : hitDelta >= 0
          ? ff14Styles.deltaGood
          : ff14Styles.deltaBad;
    const mobileHitDeltaClassName =
      hitDelta === null
        ? pendingMobileDeltaClassName
        : hitDelta >= 0
          ? ff14Styles.skillMobileDeltaGood
          : ff14Styles.skillMobileDeltaBad;
    const rdpsDeltaClassName =
      rdpsDelta === null
        ? pendingValueClassName
        : rdpsDelta >= 0
          ? ff14Styles.deltaGood
          : ff14Styles.deltaBad;
    const damageShare =
      skill.damage > 0 ? (skill.damage / totalDamage) * 100 : 0;
    const barWidth =
      skill.damage > 0 ? Math.max((skill.damage / maxDamage) * 100, 6) : 0;
    const highlight = resolveHighlight({ skill, castDelta, hitDelta });

    return {
      skill,
      index,
      castDelta,
      hitDelta,
      rdpsDelta,
      castDeltaClassName,
      mobileCastDeltaClassName,
      hitDeltaClassName,
      mobileHitDeltaClassName,
      rdpsDeltaClassName,
      damageShare,
      barWidth,
      highlight,
    };
  });
  const visibleTooltip =
    activeTooltip &&
    canEvaluateHighlights &&
    displayRows.some(
      (row) =>
        row.skill.abilityKey === activeTooltip.abilityKey &&
        row.highlight?.kind === activeTooltip.kind &&
        row.highlight.reason === activeTooltip.reason
    )
      ? activeTooltip
      : null;

  return (
    <article className={ff14Styles.card}>
      <div className={ff14Styles.cardHeader}>
        <h2>
          <Crosshair size={18} />
          {text.skillBreakdownTitle}: {selectedCharacter.name} (
          {selectedCharacter.job})
        </h2>
        <div className={ff14Styles.headerControls}>
          <button
            type="button"
            className={ff14Styles.detailBackButton}
            onClick={onBackToSummary}
          >
            <ArrowLeft size={14} />
            {text.backToSummary}
          </button>
        </div>
      </div>

      <p className="-mt-1 mb-3.5 max-w-4xl text-[0.82rem] leading-[1.65] text-[#9cb4d8] max-[760px]:mb-2.5 max-[760px]:text-[0.76rem]">
        {text.burstWindowScoreHint}
      </p>

      <div className="mb-4 flex flex-wrap gap-2.5 max-[760px]:mb-3 max-[760px]:gap-2">
        {highlightLegendItems.map((item) => {
          const styles = skillHighlightStyles[item.kind];

          return (
            <span
              key={item.kind}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.74rem] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${styles.legendClassName}`}
            >
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${styles.dotClassName}`}
                aria-hidden
              />
              {item.label}
            </span>
          );
        })}
      </div>

      <div className={ff14Styles.metricGrid}>
        <div className={ff14Styles.metricCard}>
          <span className={ff14Styles.metricLabel}>
            <Gauge size={16} />
            {text.burstWindowScore}
          </span>
          <strong>{selectedDetail.burstWindowScore}</strong>
        </div>
        <div className={ff14Styles.metricCard}>
          <span className={ff14Styles.metricLabel}>
            <Activity size={16} />
            {text.gcdUptime}
          </span>
          <strong>{selectedDetail.gcdUptime.toFixed(1)}%</strong>
        </div>
        <div className={ff14Styles.metricCard}>
          <span className={ff14Styles.metricLabel}>
            <Trophy size={16} />
            {text.dotUptime}
          </span>
          <strong>{selectedDetail.dotUptime.toFixed(1)}%</strong>
        </div>
      </div>

      {isTopComparisonLoading ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(126,173,249,0.38)] bg-[rgba(34,58,99,0.38)] px-3 py-1 text-[0.76rem] text-[#dce9ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <span
            className="inline-flex h-2 w-2 rounded-full bg-[#80d9ff] animate-pulse"
            aria-hidden
          />
          {topComparisonStatusTitle}
        </div>
      ) : null}

      <div className={ff14Styles.skillPanel}>
        <div className={ff14Styles.skillPanelHeader}>
          <span>{text.skillHeader}</span>
          <span>{text.tableAmount}</span>
          <span>{text.yourCasts}</span>
          <span>{text.top10Average}</span>
          <span>{text.delta}</span>
          <span>{text.hits}</span>
          <span>{text.top10HitsAverage}</span>
          <span>{text.hitDelta}</span>
          <span>{text.top10RdpsDelta}</span>
        </div>

        <div className={ff14Styles.skillRowsDesktop}>
          {displayRows.map((row) => {
            const {
              skill,
              index,
              castDelta,
              hitDelta,
              rdpsDelta,
              damageShare,
              barWidth,
              highlight,
            } = row;
            const skillRowKey = skill.abilityKey || `${skill.skill}:${index}`;
            const highlightStyles =
              highlight === null ? null : skillHighlightStyles[highlight.kind];

            return (
              <div
                key={skillRowKey}
                className={`${ff14Styles.skillRow} ${
                  highlightStyles ? highlightStyles.rowClassName : ""
                }`}
                onMouseEnter={
                  highlight
                    ? (event) => {
                        showTooltip(
                          event.currentTarget,
                          skill.abilityKey,
                          highlight,
                          event.clientX,
                          event.clientY
                        );
                      }
                    : undefined
                }
                onMouseMove={
                  highlight
                    ? (event) => {
                        showTooltip(
                          event.currentTarget,
                          skill.abilityKey,
                          highlight,
                          event.clientX,
                          event.clientY
                        );
                      }
                    : undefined
                }
                onMouseLeave={highlight ? hideTooltip : undefined}
              >
                <div className={ff14Styles.skillIdentityCell}>
                  {skill.abilityIconUrl ? (
                    <span
                      className={`${ff14Styles.skillIconPlaceholder} overflow-hidden bg-[rgba(10,18,33,0.92)] p-0`}
                      aria-hidden
                    >
                      <Image
                        src={skill.abilityIconUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        decoding="async"
                        loading="lazy"
                        width={44}
                        height={44}
                      />
                    </span>
                  ) : (
                    <span
                      className={ff14Styles.skillIconPlaceholder}
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                  <div className={ff14Styles.skillIdentityCopy}>
                    <p className={ff14Styles.skillName}>{skill.skill}</p>
                    <p className={ff14Styles.skillSubline}>
                      {text.totalDamage}{" "}
                      {skill.damage > 0 ? formatNumber(skill.damage) : "-"}
                    </p>
                  </div>
                </div>

                <div className={ff14Styles.skillAmountCell}>
                  <div className={ff14Styles.skillAmountMeta}>
                    <strong>{damageShare.toFixed(2)}%</strong>
                    <span>
                      {skill.rdps > 0
                        ? `${formatNumber(skill.rdps)} rDPS`
                        : "-"}
                    </span>
                  </div>
                  <div className={ff14Styles.skillAmountTrack}>
                    <span
                      className={ff14Styles.skillAmountFill}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                <span className={ff14Styles.skillStatValue}>{skill.casts}</span>
                <span
                  className={`${ff14Styles.skillStatValue} ${
                    skill.top10Casts === null ? pendingValueClassName : ""
                  }`}
                >
                  {formatBenchmarkCasts(skill.top10Casts)}
                </span>
                <span
                  className={`${ff14Styles.deltaText} ${row.castDeltaClassName}`}
                >
                  {formatSignedCount(castDelta)}
                </span>
                <span className={ff14Styles.skillStatValue}>{skill.hits}</span>
                <span
                  className={`${ff14Styles.skillStatValue} ${
                    skill.top10Hits === null ? pendingValueClassName : ""
                  }`}
                >
                  {formatBenchmarkHits(skill.top10Hits)}
                </span>
                <span
                  className={`${ff14Styles.deltaText} ${row.hitDeltaClassName}`}
                >
                  {formatSignedCount(hitDelta)}
                </span>
                <span
                  className={`${ff14Styles.deltaText} ${row.rdpsDeltaClassName}`}
                >
                  {formatSignedRdps(rdpsDelta)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className={ff14Styles.skillMobileList}>
        {displayRows.map((row) => {
          const {
            skill,
            index,
            castDelta,
            hitDelta,
            rdpsDelta,
            damageShare,
            highlight,
          } = row;
          const skillRowKey = skill.abilityKey || `${skill.skill}:${index}`;
          const highlightStyles =
            highlight === null ? null : skillHighlightStyles[highlight.kind];

          return (
            <li key={`mobile-${skillRowKey}`}>
              <div
                className={`${ff14Styles.skillMobileCard} ${
                  highlightStyles ? highlightStyles.mobileCardClassName : ""
                }`}
              >
                <div className={ff14Styles.skillMobileHeader}>
                  <div className={ff14Styles.skillMobileIdentity}>
                    {skill.abilityIconUrl ? (
                      <span
                        className={`${ff14Styles.skillIconPlaceholder} overflow-hidden bg-[rgba(10,18,33,0.92)] p-0`}
                        aria-hidden
                      >
                        <Image
                          src={skill.abilityIconUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          decoding="async"
                          loading="lazy"
                          width={44}
                          height={44}
                        />
                      </span>
                    ) : (
                      <span
                        className={ff14Styles.skillIconPlaceholder}
                        aria-hidden
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                    <div>
                      <p className={ff14Styles.skillMobileName}>
                        {skill.skill}
                      </p>
                      <p className={ff14Styles.skillMobileSubline}>
                        {damageShare.toFixed(2)}% ·{" "}
                        {skill.rdps > 0
                          ? `${formatNumber(skill.rdps)} rDPS`
                          : "-"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`${ff14Styles.skillMobileDelta} ${row.mobileCastDeltaClassName}`}
                  >
                    {text.delta} {formatSignedCount(castDelta)}
                  </span>
                </div>

                <div className={ff14Styles.skillMobileGrid}>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.yourCasts}</span>
                    <strong>{skill.casts}</strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.top10Average}</span>
                    <strong
                      className={
                        skill.top10Casts === null ? pendingValueClassName : ""
                      }
                    >
                      {formatBenchmarkCasts(skill.top10Casts)}
                    </strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.hits}</span>
                    <strong>{skill.hits}</strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.top10HitsAverage}</span>
                    <strong
                      className={
                        skill.top10Hits === null ? pendingValueClassName : ""
                      }
                    >
                      {formatBenchmarkHits(skill.top10Hits)}
                    </strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.hitDelta}</span>
                    <strong className={row.mobileHitDeltaClassName}>
                      {formatSignedCount(hitDelta)}
                    </strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.top10RdpsDelta}</span>
                    <strong className={row.rdpsDeltaClassName}>
                      {formatSignedRdps(rdpsDelta)}
                    </strong>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {visibleTooltip
        ? createPortal(
            <div
              className={`pointer-events-none absolute z-30 w-70 rounded-[14px] border px-3 py-2.5 text-[0.75rem] leading-[1.55] shadow-[0_14px_28px_rgba(4,12,26,0.48)] backdrop-blur ${skillHighlightStyles[visibleTooltip.kind].tooltipClassName}`}
              style={{
                left: `${visibleTooltip.left}px`,
                top: `${visibleTooltip.top}px`,
              }}
            >
              {visibleTooltip.reason}
            </div>,
            visibleTooltip.root
          )
        : null}
    </article>
  );
};

export default SkillBreakdownCard;
