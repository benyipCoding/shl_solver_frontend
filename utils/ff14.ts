import {
  JOB_BASE_RDPS,
  JOB_SKILL_TEMPLATES,
  SERVERS,
  TOP_PLAYER_NAMES,
} from "@/constants/ff14";
import type {
  CharacterDetail,
  CharacterSummary,
  Job,
  ParsedReport,
  TopPlayer,
} from "@/interfaces/ff14";

export const parseFflogsReport = (input: string): ParsedReport | null => {
  const value = input.trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "fflogs.com") {
      return null;
    }

    const pathMatch = url.pathname.match(/^\/reports\/([A-Za-z0-9]+)/);
    const reportId = pathMatch?.[1];
    const fightId = url.searchParams.get("fight") ?? undefined;

    if (!reportId || !fightId) {
      return null;
    }

    return { reportId, fightId };
  } catch {
    return null;
  }
};

const buildTopPlayers = (job: Job): TopPlayer[] => {
  const baseline = Math.round(JOB_BASE_RDPS[job] * 1.1);
  return TOP_PLAYER_NAMES.map((name, index) => {
    const attenuation = 1 - index * 0.013;
    return {
      rank: index + 1,
      name,
      server: SERVERS[index % SERVERS.length],
      rdps: Math.round(baseline * attenuation),
      killTimeSec: 428 - index * 2,
    };
  });
};

export const buildCharacterDetail = (
  character: CharacterSummary
): CharacterDetail => {
  const parseFactor = 0.79 + (character.parse / 100) * 0.3;
  const skillRows = JOB_SKILL_TEMPLATES[character.job].map(
    (template, index) => {
      const casts = Math.max(
        1,
        Math.round(
          template.top10Casts * parseFactor - (index % 3 === 0 ? 1 : 0)
        )
      );
      const hits = Math.max(casts, Math.round(casts * template.hitRate));
      const damage =
        template.top10Damage > 0
          ? Math.round(
              template.top10Damage *
                (casts / template.top10Casts) *
                (0.9 + character.parse / 250)
            )
          : 0;
      const critRate =
        template.critRate > 0
          ? Math.max(
              8,
              Math.min(96, template.critRate - (86 - character.parse) * 0.16)
            )
          : 0;

      return {
        skill: template.skill,
        casts,
        hits,
        damage,
        critRate,
        top10Casts: template.top10Casts,
      };
    }
  );

  return {
    burstWindowScore: Math.min(
      99,
      Math.max(45, Math.round(character.parse * 0.93))
    ),
    gcdUptime: Math.min(99.9, Math.max(88, 90 + character.parse * 0.1)),
    dotUptime: Math.min(99.5, Math.max(70, 74 + character.parse * 0.2)),
    skillRows,
    topPlayers: buildTopPlayers(character.job),
  };
};

export const formatNumber = (value: number): string =>
  value.toLocaleString("en-US");
