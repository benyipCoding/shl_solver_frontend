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
  ParseTier,
  ParsedReport,
  Role,
  SkillTemplate,
  TopPlayer,
} from "@/interfaces/ff14";

type Ff14ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

interface Ff14ReportFightRef {
  id: number;
}

interface Ff14ReportFight {
  id: number;
  start_time: number;
  end_time: number;
  combatTime: number;
}

interface Ff14ReportFriendly {
  id: number;
  name: string;
  type: string;
  server?: string;
  fights?: Ff14ReportFightRef[];
}

interface Ff14ReportFightsResponse {
  fights: Ff14ReportFight[];
  friendlies: Ff14ReportFriendly[];
}

interface Ff14TableEntry {
  name: string;
  id: number;
  type: string;
  total: number;
  activeTime: number;
  totalRDPS?: number;
  totalADPS?: number;
}

interface Ff14TableResponse {
  entries?: Ff14TableEntry[];
}

const FFLOGS_JOB_MAP: Record<string, Job> = {
  Paladin: "PLD",
  Warrior: "WAR",
  DarkKnight: "DRK",
  Gunbreaker: "GNB",
  WhiteMage: "WHM",
  Scholar: "SCH",
  Astrologian: "AST",
  Sage: "SGE",
  Monk: "MNK",
  Dragoon: "DRG",
  Ninja: "NIN",
  Samurai: "SAM",
  Reaper: "RPR",
  Viper: "VPR",
  Bard: "BRD",
  Machinist: "MCH",
  Dancer: "DNC",
  BlackMage: "BLM",
  Summoner: "SMN",
  RedMage: "RDM",
  Pictomancer: "PCT",
};

const JOB_ROLE_MAP: Record<Job, Role> = {
  PLD: "Tank",
  WAR: "Tank",
  DRK: "Tank",
  GNB: "Tank",
  WHM: "Healer",
  SCH: "Healer",
  AST: "Healer",
  SGE: "Healer",
  MNK: "Melee",
  DRG: "Melee",
  NIN: "Melee",
  SAM: "Melee",
  RPR: "Melee",
  VPR: "Melee",
  BRD: "Ranged",
  MCH: "Ranged",
  DNC: "Ranged",
  BLM: "Caster",
  SMN: "Caster",
  RDM: "Caster",
  PCT: "Caster",
};

const FALLBACK_SKILL_TEMPLATES: SkillTemplate[] = [
  {
    skill: "Burst Window",
    top10Casts: 8,
    hitRate: 1,
    top10Damage: 0,
    critRate: 33,
  },
  {
    skill: "Core Combo",
    top10Casts: 28,
    hitRate: 1,
    top10Damage: 0,
    critRate: 26,
  },
  {
    skill: "Gauge Spend",
    top10Casts: 14,
    hitRate: 1,
    top10Damage: 0,
    critRate: 31,
  },
  {
    skill: "Raid Utility",
    top10Casts: 6,
    hitRate: 1,
    top10Damage: 0,
    critRate: 18,
  },
  {
    skill: "Finisher",
    top10Casts: 10,
    hitRate: 1,
    top10Damage: 0,
    critRate: 37,
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toFixedNumber = (value: number, digits: number) =>
  Number(value.toFixed(digits));

const getJobFromFflogsType = (type: string): Job | null =>
  FFLOGS_JOB_MAP[type] ?? null;

const getParseTier = (score: number): ParseTier => {
  if (score >= 95) {
    return "gold";
  }

  if (score >= 75) {
    return "purple";
  }

  if (score >= 50) {
    return "blue";
  }

  return "green";
};

const getEstimatedScore = (job: Job, rdps: number, activePct: number) => {
  const baseline = JOB_BASE_RDPS[job] || Math.max(rdps, 1);
  const normalizedRdps = baseline > 0 ? (rdps / baseline) * 100 : 100;

  return clamp(Math.round(normalizedRdps * 0.8 + activePct * 0.2 - 5), 35, 99);
};

const getSkillTemplates = (character: CharacterSummary): SkillTemplate[] => {
  const jobTemplates = JOB_SKILL_TEMPLATES[character.job];

  if (jobTemplates?.length) {
    return jobTemplates;
  }

  const damageBaseline = Math.max(
    character.totalDamage ?? character.rdps * 520,
    1
  );
  const damageWeights = [0.24, 0.19, 0.15, 0.11, 0.08];

  return FALLBACK_SKILL_TEMPLATES.map((template, index) => ({
    ...template,
    top10Damage: Math.round(damageBaseline * damageWeights[index]),
  }));
};

const fetchFf14Data = async <T>(path: string, signal?: AbortSignal) => {
  const response = await fetch(path, {
    cache: "no-store",
    method: "GET",
    signal,
  });

  const payload = (await response.json()) as
    | (Partial<Ff14ApiEnvelope<T>> & { error?: string })
    | undefined;

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "加载 FF14 数据失败");
  }

  if (payload?.data === undefined) {
    throw new Error("FF14 接口未返回 data 字段");
  }

  return payload.data;
};

export const loadEncounterSummary = async (
  report: ParsedReport,
  signal?: AbortSignal
) => {
  const fightsData = await fetchFf14Data<Ff14ReportFightsResponse>(
    `/api/ff14_logs/report/fights?code=${encodeURIComponent(report.reportId)}`,
    signal
  );

  const fightId = Number(report.fightId);

  if (!Number.isFinite(fightId)) {
    throw new Error("战斗 ID 无效");
  }

  const selectedFight = fightsData.fights.find((fight) => fight.id === fightId);

  if (!selectedFight) {
    throw new Error("未找到对应战斗记录");
  }

  const query = new URLSearchParams({
    code: report.reportId,
    start: String(selectedFight.start_time),
    end: String(selectedFight.end_time),
  });

  const [damageDoneData, castsData] = await Promise.all([
    fetchFf14Data<Ff14TableResponse>(
      `/api/ff14_logs/report/tables?view=damage-done&${query.toString()}`,
      signal
    ),
    fetchFf14Data<Ff14TableResponse>(
      `/api/ff14_logs/report/tables?view=casts&${query.toString()}`,
      signal
    ),
  ]);

  const encounterDuration = Math.max(selectedFight.combatTime, 1);
  const encounterFriendlies = fightsData.friendlies.filter((friendly) =>
    friendly.fights?.some((fight) => fight.id === fightId)
  );
  const serverMap = new Map<number, string>(
    encounterFriendlies.map((friendly) => [friendly.id, friendly.server ?? "-"])
  );
  const castsMap = new Map<number, Ff14TableEntry>(
    (castsData.entries ?? []).map((entry) => [entry.id, entry])
  );

  return (damageDoneData.entries ?? [])
    .reduce<CharacterSummary[]>((summary, entry) => {
      const job = getJobFromFflogsType(entry.type);

      if (!job) {
        return summary;
      }

      const totalDamage = Math.round(entry.total ?? 0);
      const rdps = Math.round(
        ((entry.totalRDPS ?? entry.total ?? 0) * 1000) / encounterDuration
      );
      const adps = Math.round(
        ((entry.totalADPS ?? entry.total ?? 0) * 1000) / encounterDuration
      );
      const activePct = toFixedNumber(
        clamp(((entry.activeTime ?? 0) / encounterDuration) * 100, 0, 100),
        1
      );
      const parse = getEstimatedScore(job, rdps, activePct);

      summary.push({
        id: String(entry.id),
        name: entry.name,
        server: serverMap.get(entry.id) ?? "-",
        role: JOB_ROLE_MAP[job],
        job,
        rdps,
        adps,
        casts: Math.round(castsMap.get(entry.id)?.total ?? 0),
        deaths: 0,
        parse,
        tier: getParseTier(parse),
        totalDamage,
        activePct,
      });

      return summary;
    }, [])
    .sort((left, right) => right.rdps - left.rdps);
};

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
  const baseline = Math.round((JOB_BASE_RDPS[job] || 17000) * 1.1);
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
  const performanceScore = getEstimatedScore(
    character.job,
    character.rdps,
    character.activePct ?? 95
  );
  const parseFactor = 0.79 + (performanceScore / 100) * 0.3;
  const skillRows = getSkillTemplates(character).map((template, index) => {
    const casts = Math.max(
      1,
      Math.round(template.top10Casts * parseFactor - (index % 3 === 0 ? 1 : 0))
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
  });

  return {
    burstWindowScore: Math.min(
      99,
      Math.max(45, Math.round(performanceScore * 0.93))
    ),
    gcdUptime: Math.min(
      99.9,
      Math.max(88, (character.activePct ?? 92) + performanceScore * 0.04)
    ),
    dotUptime: Math.min(99.5, Math.max(70, 72 + performanceScore * 0.18)),
    skillRows,
    topPlayers: buildTopPlayers(character.job),
  };
};

export const formatNumber = (value: number): string =>
  value.toLocaleString("en-US");
