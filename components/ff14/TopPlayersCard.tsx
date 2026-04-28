import { Trophy } from "lucide-react";

import { ff14Styles } from "@/constants/ff14";
import type {
  CharacterDetail,
  CharacterSummary,
  StaticText,
} from "@/interfaces/ff14";
import { formatNumber } from "@/utils/ff14";

interface TopPlayersCardProps {
  text: StaticText;
  selectedCharacter: CharacterSummary;
  selectedDetail: CharacterDetail;
}

const TopPlayersCard = ({
  text,
  selectedCharacter,
  selectedDetail,
}: TopPlayersCardProps) => {
  return (
    <aside className={ff14Styles.card}>
      <div className={ff14Styles.cardHeader}>
        <h2>
          <Trophy size={18} />
          {text.top10Title} ({selectedCharacter.job})
        </h2>
      </div>

      <ul className={ff14Styles.rankList}>
        {selectedDetail.topPlayers.map((player) => (
          <li
            key={`${selectedCharacter.job}-${player.rank}`}
            className={ff14Styles.rankItem}
          >
            <div>
              <p className={ff14Styles.rankName}>
                #{player.rank} {player.name}
              </p>
              <p className={ff14Styles.rankMeta}>
                {player.server} | {text.killLabel} {player.killTimeSec}s
              </p>
            </div>
            <span className={ff14Styles.rankValue}>
              {formatNumber(player.rdps)}
            </span>
          </li>
        ))}
      </ul>

      <div className={ff14Styles.coachingBox}>
        <h3>{text.coachingTitle}</h3>
        <p>{text.coachingDesc1}</p>
        <p>{text.coachingDesc2}</p>
      </div>
    </aside>
  );
};

export default TopPlayersCard;
