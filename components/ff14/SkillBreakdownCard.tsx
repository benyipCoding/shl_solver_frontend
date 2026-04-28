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
}

const SkillBreakdownCard = ({
  text,
  selectedCharacter,
  selectedDetail,
}: SkillBreakdownCardProps) => {
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

      <div className={ff14Styles.tableWrap}>
        <table className={ff14Styles.skillTable}>
          <thead>
            <tr>
              <th>{text.skillHeader}</th>
              <th>{text.yourCasts}</th>
              <th>{text.top10Average}</th>
              <th>{text.delta}</th>
              <th>{text.totalDamage}</th>
              <th>{text.hits}</th>
              <th>{text.crit}</th>
            </tr>
          </thead>
          <tbody>
            {selectedDetail.skillRows.map((skill) => {
              const delta = skill.casts - skill.top10Casts;
              const deltaClass =
                delta >= 0 ? ff14Styles.deltaGood : ff14Styles.deltaBad;

              return (
                <tr key={skill.skill}>
                  <td>{skill.skill}</td>
                  <td>{skill.casts}</td>
                  <td>{skill.top10Casts}</td>
                  <td>
                    <span className={`${ff14Styles.deltaText} ${deltaClass}`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  </td>
                  <td>{skill.damage > 0 ? formatNumber(skill.damage) : "-"}</td>
                  <td>{skill.hits}</td>
                  <td>
                    {skill.critRate > 0 ? `${skill.critRate.toFixed(1)}%` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className={ff14Styles.skillMobileList}>
        {selectedDetail.skillRows.map((skill) => {
          const delta = skill.casts - skill.top10Casts;
          const deltaClass =
            delta >= 0
              ? ff14Styles.skillMobileDeltaGood
              : ff14Styles.skillMobileDeltaBad;

          return (
            <li key={`mobile-${skill.skill}`}>
              <div className={ff14Styles.skillMobileCard}>
                <div className={ff14Styles.skillMobileHeader}>
                  <p className={ff14Styles.skillMobileName}>{skill.skill}</p>
                  <span
                    className={`${ff14Styles.skillMobileDelta} ${deltaClass}`}
                  >
                    {text.delta} {delta > 0 ? `+${delta}` : delta}
                  </span>
                </div>

                <div className={ff14Styles.skillMobileGrid}>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.yourCasts}</span>
                    <strong>{skill.casts}</strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.top10Average}</span>
                    <strong>{skill.top10Casts}</strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.totalDamage}</span>
                    <strong>
                      {skill.damage > 0 ? formatNumber(skill.damage) : "-"}
                    </strong>
                  </div>
                  <div className={ff14Styles.skillMobileMetric}>
                    <span>{text.hits}</span>
                    <strong>{skill.hits}</strong>
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
