import Image from "next/image";
import { Activity, ArrowLeft, Crosshair, Gauge, Trophy } from "lucide-react";

import { ff14Styles } from "@/constants/ff14";
import type {
  CharacterDetail,
  CharacterSummary,
  StaticText,
} from "@/interfaces/ff14";
import { formatNumber } from "@/utils/ff14";

interface SkillBreakdownCardProps {
  text: StaticText;
  selectedCharacter: CharacterSummary;
  selectedDetail: CharacterDetail;
  isTopComparisonLoading: boolean;
  topComparisonStatusTitle: string;
  onBackToSummary: () => void;
}

const SkillBreakdownCard = ({
  text,
  selectedCharacter,
  selectedDetail,
  isTopComparisonLoading,
  topComparisonStatusTitle,
  onBackToSummary,
}: SkillBreakdownCardProps) => {
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

  const formatBenchmarkCasts = (value: number | null) =>
    value === null ? "N/A" : String(value);
  const formatBenchmarkHits = (value: number | null) =>
    value === null ? "N/A" : String(value);

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
          <span>{text.crit}</span>
        </div>

        <div className={ff14Styles.skillRowsDesktop}>
          {sortedSkillRows.map((skill, index) => {
            const castDelta =
              skill.top10Casts === null ? null : skill.casts - skill.top10Casts;
            const castDeltaClassName =
              castDelta === null
                ? pendingValueClassName
                : castDelta >= 0
                  ? ff14Styles.deltaGood
                  : ff14Styles.deltaBad;
            const hitDelta =
              skill.top10Hits === null ? null : skill.hits - skill.top10Hits;
            const hitDeltaClassName =
              hitDelta === null
                ? pendingValueClassName
                : hitDelta >= 0
                  ? ff14Styles.deltaGood
                  : ff14Styles.deltaBad;
            const damageShare =
              skill.damage > 0 ? (skill.damage / totalDamage) * 100 : 0;
            const barWidth =
              skill.damage > 0
                ? Math.max((skill.damage / maxDamage) * 100, 6)
                : 0;

            return (
              <div key={skill.skill} className={ff14Styles.skillRow}>
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
                  className={`${ff14Styles.deltaText} ${castDeltaClassName}`}
                >
                  {castDelta === null
                    ? "N/A"
                    : castDelta > 0
                      ? `+${castDelta}`
                      : castDelta}
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
                  className={`${ff14Styles.deltaText} ${hitDeltaClassName}`}
                >
                  {hitDelta === null
                    ? "N/A"
                    : hitDelta > 0
                      ? `+${hitDelta}`
                      : hitDelta}
                </span>
                <span className={ff14Styles.skillStatValue}>
                  {skill.critRate > 0 ? `${skill.critRate.toFixed(1)}%` : "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className={ff14Styles.skillMobileList}>
        {sortedSkillRows.map((skill, index) => {
          const castDelta =
            skill.top10Casts === null ? null : skill.casts - skill.top10Casts;
          const castDeltaClassName =
            castDelta === null
              ? pendingMobileDeltaClassName
              : castDelta >= 0
                ? ff14Styles.skillMobileDeltaGood
                : ff14Styles.skillMobileDeltaBad;
          const hitDelta =
            skill.top10Hits === null ? null : skill.hits - skill.top10Hits;
          const hitDeltaClassName =
            hitDelta === null
              ? pendingMobileDeltaClassName
              : hitDelta >= 0
                ? ff14Styles.skillMobileDeltaGood
                : ff14Styles.skillMobileDeltaBad;
          const damageShare =
            skill.damage > 0 ? (skill.damage / totalDamage) * 100 : 0;

          return (
            <li key={`mobile-${skill.skill}`}>
              <div className={ff14Styles.skillMobileCard}>
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
                    className={`${ff14Styles.skillMobileDelta} ${castDeltaClassName}`}
                  >
                    {text.delta}{" "}
                    {castDelta === null
                      ? "N/A"
                      : castDelta > 0
                        ? `+${castDelta}`
                        : castDelta}
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
                    <strong className={hitDeltaClassName}>
                      {hitDelta === null
                        ? "N/A"
                        : hitDelta > 0
                          ? `+${hitDelta}`
                          : hitDelta}
                    </strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.crit}</span>
                    <strong>
                      {skill.critRate > 0
                        ? `${skill.critRate.toFixed(1)}%`
                        : "-"}
                    </strong>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
};

export default SkillBreakdownCard;
