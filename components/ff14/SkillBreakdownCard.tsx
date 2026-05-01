import { Activity, Crosshair, Gauge, Trophy } from "lucide-react";

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
}

const SkillBreakdownCard = ({
  text,
  selectedCharacter,
  selectedDetail,
  isTopComparisonLoading,
  topComparisonStatusTitle,
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
  const formatBenchmarkDamage = (value: number | null) =>
    value === null ? "N/A" : formatNumber(value);

  return (
    <article className={ff14Styles.card}>
      <div className={ff14Styles.cardHeader}>
        <h2>
          <Crosshair size={18} />
          {text.skillBreakdownTitle}: {selectedCharacter.name} (
          {selectedCharacter.job})
        </h2>
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
          <span>{text.crit}</span>
          <span>{text.totalDamage}</span>
          <span>{text.top10Damage}</span>
        </div>

        <div className={ff14Styles.skillRowsDesktop}>
          {sortedSkillRows.map((skill, index) => {
            const delta =
              skill.top10Casts === null ? null : skill.casts - skill.top10Casts;
            const deltaClassName =
              delta === null
                ? pendingValueClassName
                : delta >= 0
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
                  <span className={ff14Styles.skillIconPlaceholder} aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
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
                      {skill.damage > 0 ? formatNumber(skill.damage) : "-"}
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
                <span className={`${ff14Styles.deltaText} ${deltaClassName}`}>
                  {delta === null ? "N/A" : delta > 0 ? `+${delta}` : delta}
                </span>
                <span className={ff14Styles.skillStatValue}>
                  {skill.critRate > 0 ? `${skill.critRate.toFixed(1)}%` : "-"}
                </span>
                <span className={ff14Styles.skillDamageValue}>
                  {skill.damage > 0 ? formatNumber(skill.damage) : "-"}
                </span>
                <span
                  className={`${ff14Styles.skillStatValue} ${
                    skill.top10Damage === null ? pendingValueClassName : ""
                  }`}
                >
                  {formatBenchmarkDamage(skill.top10Damage)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className={ff14Styles.skillMobileList}>
        {sortedSkillRows.map((skill, index) => {
          const delta =
            skill.top10Casts === null ? null : skill.casts - skill.top10Casts;
          const deltaClassName =
            delta === null
              ? pendingMobileDeltaClassName
              : delta >= 0
                ? ff14Styles.skillMobileDeltaGood
                : ff14Styles.skillMobileDeltaBad;
          const damageShare =
            skill.damage > 0 ? (skill.damage / totalDamage) * 100 : 0;

          return (
            <li key={`mobile-${skill.skill}`}>
              <div className={ff14Styles.skillMobileCard}>
                <div className={ff14Styles.skillMobileHeader}>
                  <div className={ff14Styles.skillMobileIdentity}>
                    <span
                      className={ff14Styles.skillIconPlaceholder}
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className={ff14Styles.skillMobileName}>
                        {skill.skill}
                      </p>
                      <p className={ff14Styles.skillMobileSubline}>
                        {damageShare.toFixed(2)}% ·{" "}
                        {skill.damage > 0 ? formatNumber(skill.damage) : "-"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`${ff14Styles.skillMobileDelta} ${deltaClassName}`}
                  >
                    {text.delta}{" "}
                    {delta === null ? "N/A" : delta > 0 ? `+${delta}` : delta}
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
                    <span>{text.totalDamage}</span>
                    <strong>
                      {skill.damage > 0 ? formatNumber(skill.damage) : "-"}
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
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.top10Damage}</span>
                    <strong
                      className={
                        skill.top10Damage === null ? pendingValueClassName : ""
                      }
                    >
                      {formatBenchmarkDamage(skill.top10Damage)}
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
