import { Sword } from "lucide-react";

import {
  ACTOR_SPRITE_SRC,
  ff14Styles,
  jobColorMap,
  jobSpriteNameMap,
  jobSpritePositionMap,
  parseClassMap,
  roleClassMap,
} from "@/constants/ff14";
import type { CharacterSummary, StaticText } from "@/interfaces/ff14";
import { formatNumber } from "@/utils/ff14";

interface EncounterSummaryCardProps {
  text: StaticText;
  summary: CharacterSummary[];
  selectedCharacterId: string;
  showMobileSummaryValues: boolean;
  raidTotals: {
    totalDamage: number;
    maxDamage: number;
  };
  onSelectCharacter: (characterId: string) => void;
  onToggleMobileSummaryValues: () => void;
}

const EncounterSummaryCard = ({
  text,
  summary,
  selectedCharacterId,
  showMobileSummaryValues,
  raidTotals,
  onSelectCharacter,
  onToggleMobileSummaryValues,
}: EncounterSummaryCardProps) => {
  return (
    <section className={ff14Styles.card}>
      <div className={ff14Styles.cardHeader}>
        <h2>
          <Sword size={18} />
          {text.encounterSummaryTitle}
        </h2>

        <button
          type="button"
          className={ff14Styles.summaryViewSwitch}
          role="switch"
          aria-checked={showMobileSummaryValues}
          aria-label={text.summaryViewSwitchAria}
          onClick={onToggleMobileSummaryValues}
        >
          {showMobileSummaryValues
            ? text.summaryToggleBarsOnly
            : text.summaryToggleShowValues}
        </button>
      </div>

      <div className={ff14Styles.tableWrap}>
        <table className={ff14Styles.summaryTable}>
          <thead>
            <tr>
              <th className="w-60">{text.tablePlayer}</th>
              <th className="min-w-65">{text.tableAmount}</th>
              <th className="text-right">{text.tableRdps}</th>
              <th className="text-right">{text.tableAdps}</th>
              <th className="text-center">{text.tableCasts}</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((member) => {
              const isSelected = member.id === selectedCharacterId;
              const totalDamage = member.totalDamage ?? 0;
              const amountPercent = (
                (totalDamage / Math.max(raidTotals.totalDamage, 1)) *
                100
              ).toFixed(2);
              const barWidth = `${
                (totalDamage / Math.max(raidTotals.maxDamage, 1)) * 100
              }%`;
              const jobColor = jobColorMap[member.job] || "#ccc";

              return (
                <tr
                  key={member.id}
                  className={`${ff14Styles.summaryRow} ${isSelected ? ff14Styles.rowSelected : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectCharacter(member.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectCharacter(member.id);
                    }
                  }}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <img
                        src={ACTOR_SPRITE_SRC}
                        alt={jobSpriteNameMap[member.job]}
                        className={`${ff14Styles.jobBadge} actor-sprite-${jobSpriteNameMap[member.job]}`}
                        style={{
                          objectPosition: jobSpritePositionMap[member.job],
                        }}
                        decoding="async"
                        loading="lazy"
                      />
                      <div className={ff14Styles.playerCell}>
                        <span
                          className={ff14Styles.playerName}
                          style={{ color: jobColor }}
                        >
                          {member.name}
                        </span>
                        <span className={ff14Styles.playerServer}>
                          {member.server}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-between gap-2 text-[0.8rem] text-[#c5d8f3]">
                      <span className="w-11.25 text-right font-medium">
                        {amountPercent}%
                      </span>
                      <div className="flex h-3.5 flex-1 items-center overflow-hidden rounded-sm border border-[rgba(255,255,255,0.05)] bg-[rgba(15,23,42,0.4)] transition-colors duration-200 group-hover:border-[rgba(171,210,255,0.18)] group-hover:bg-[rgba(31,48,79,0.62)] group-focus-visible:border-[rgba(171,210,255,0.18)] group-focus-visible:bg-[rgba(31,48,79,0.62)]">
                        <div
                          style={{
                            width: barWidth,
                            backgroundColor: jobColor,
                          }}
                          className="h-full rounded-sm opacity-90 shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all duration-500 group-hover:opacity-100 group-hover:shadow-[0_0_14px_rgba(255,255,255,0.2)] group-focus-visible:opacity-100 group-focus-visible:shadow-[0_0_14px_rgba(255,255,255,0.2)]"
                        />
                      </div>
                      <span className="w-11.25 text-right font-medium">
                        {(totalDamage / 1000000).toFixed(2)}m
                      </span>
                    </div>
                  </td>
                  <td className="text-right font-(--font-heading) text-[0.88rem] tracking-[0.02em]">
                    {formatNumber(member.rdps)}
                  </td>
                  <td className="text-right font-(--font-heading) text-[0.88rem] tracking-[0.02em] text-[#a9c2e6]">
                    {formatNumber(member.adps)}
                  </td>
                  <td className="text-center text-[0.85rem] text-[#95b0d5]">
                    {member.casts}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className={ff14Styles.summaryMobileList}>
        {summary.map((member) => {
          const isSelected = member.id === selectedCharacterId;
          const totalDamage = member.totalDamage ?? 0;
          const amountPercent = (
            (totalDamage / Math.max(raidTotals.totalDamage, 1)) *
            100
          ).toFixed(2);
          const barWidth = `${
            (totalDamage / Math.max(raidTotals.maxDamage, 1)) * 100
          }%`;
          const jobColor = jobColorMap[member.job] || "#ccc";
          const roleClass = roleClassMap[member.role];
          const parseClass = parseClassMap[member.tier];
          const activePct = member.activePct ?? 0;

          return (
            <li key={`mobile-${member.id}`}>
              <button
                type="button"
                className={`${ff14Styles.summaryMobileCard} ${
                  isSelected ? ff14Styles.summaryMobileCardSelected : ""
                }`}
                onClick={() => onSelectCharacter(member.id)}
              >
                <div className={ff14Styles.summaryMobileTop}>
                  <div className={ff14Styles.summaryMobileIdentity}>
                    <img
                      src={ACTOR_SPRITE_SRC}
                      alt={jobSpriteNameMap[member.job]}
                      className={`${ff14Styles.jobBadge} actor-sprite-${jobSpriteNameMap[member.job]}`}
                      style={{
                        objectPosition: jobSpritePositionMap[member.job],
                      }}
                      decoding="async"
                      loading="lazy"
                    />
                    <div className={ff14Styles.summaryMobileNameWrap}>
                      <p
                        className={ff14Styles.summaryMobileName}
                        style={{ color: jobColor }}
                      >
                        {member.name}
                      </p>
                      <p className={ff14Styles.summaryMobileServer}>
                        {member.server}
                      </p>
                    </div>
                  </div>
                  <span className={`${ff14Styles.parseChip} ${parseClass}`}>
                    {text.tableActive} {activePct.toFixed(1)}%
                  </span>
                </div>

                <div className={ff14Styles.summaryMobileBadges}>
                  <span className={`${ff14Styles.roleChip} ${roleClass}`}>
                    {member.role}
                  </span>
                </div>

                <div className={ff14Styles.summaryMobileAmount}>
                  <span className="w-11 text-right font-medium">
                    {amountPercent}%
                  </span>
                  <div className={ff14Styles.summaryMobileTrack}>
                    <div
                      className={ff14Styles.summaryMobileFill}
                      style={{
                        width: barWidth,
                        backgroundColor: jobColor,
                      }}
                    />
                  </div>
                  <span className="w-12 text-right font-medium">
                    {(totalDamage / 1000000).toFixed(2)}m
                  </span>
                </div>

                {showMobileSummaryValues && (
                  <div className={ff14Styles.summaryMobileStats}>
                    <div className={ff14Styles.summaryMobileStat}>
                      <span>{text.tableRdps}</span>
                      <strong>{formatNumber(member.rdps)}</strong>
                    </div>
                    <div className={ff14Styles.summaryMobileStat}>
                      <span>{text.tableAdps}</span>
                      <strong>{formatNumber(member.adps)}</strong>
                    </div>
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default EncounterSummaryCard;
