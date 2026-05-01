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
  SkillRow,
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

interface Ff14AbilityTableEntry {
  name: string;
  guid?: number;
  type?: number | string;
  total: number;
  totalADPS?: number;
  uses?: number;
  hitCount?: number;
  tickCount?: number;
  multistrikeHitCount?: number;
  multistrikeTickCount?: number;
  critHitCount?: number;
  critTickCount?: number;
  uptime?: number;
}

interface Ff14TableResponse<TEntry = Ff14TableEntry> {
  entries?: TEntry[];
  combatTime?: number;
  totalTime?: number;
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

const roundAmount = (value?: number) => Math.round(value ?? 0);

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

const loadSelectedFight = async (
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

  return {
    fightsData,
    selectedFight,
    fightId,
  };
};

const buildReportTableQuery = (
  reportId: string,
  fight: Pick<Ff14ReportFight, "start_time" | "end_time">,
  extraParams?: Record<string, string | number | undefined>
) => {
  const query = new URLSearchParams({
    code: reportId,
    start: String(fight.start_time),
    end: String(fight.end_time),
  });

  Object.entries(extraParams ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  return query.toString();
};

const loadReportTable = async <TEntry>(
  reportId: string,
  fight: Pick<Ff14ReportFight, "start_time" | "end_time">,
  view: string,
  signal?: AbortSignal,
  extraParams?: Record<string, string | number | undefined>
) =>
  fetchFf14Data<Ff14TableResponse<TEntry>>(
    `/api/ff14_logs/report/tables?view=${encodeURIComponent(view)}&${buildReportTableQuery(
      reportId,
      fight,
      extraParams
    )}`,
    signal
  );

const getAbilityKey = (entry: Pick<Ff14AbilityTableEntry, "guid" | "name">) =>
  typeof entry.guid === "number" ? `guid:${entry.guid}` : `name:${entry.name}`;

const getTotalHits = (entry?: Partial<Ff14AbilityTableEntry>) =>
  (entry?.hitCount ?? 0) +
  (entry?.tickCount ?? 0) +
  (entry?.multistrikeHitCount ?? 0) +
  (entry?.multistrikeTickCount ?? 0);

const getTotalCrits = (entry?: Partial<Ff14AbilityTableEntry>) =>
  (entry?.critHitCount ?? 0) + (entry?.critTickCount ?? 0);

const buildMockTop10Benchmark = (
  template: SkillTemplate | undefined,
  damage: number,
  casts: number
) => ({
  top10Casts: Math.max(
    template?.top10Casts ?? 0,
    casts,
    Math.round(casts * 1.06)
  ),
  top10Damage: Math.max(
    template?.top10Damage ?? 0,
    damage,
    Math.round(damage * 1.08)
  ),
});

const buildRealSkillRows = (
  character: CharacterSummary,
  damageEntries: Ff14AbilityTableEntry[],
  castEntries: Ff14AbilityTableEntry[]
): SkillRow[] => {
  const castEntryByKey = new Map<string, Ff14AbilityTableEntry>();

  castEntries.forEach((entry) => {
    castEntryByKey.set(getAbilityKey(entry), entry);
  });

  const templates = getSkillTemplates(character);

  return damageEntries
    .filter((entry) => roundAmount(entry.total) > 0 && entry.name.trim() !== "")
    .sort((left, right) => roundAmount(right.total) - roundAmount(left.total))
    .slice(0, 10)
    .map((entry, index) => {
      const castEntry = castEntryByKey.get(getAbilityKey(entry));
      const casts = Math.max(roundAmount(castEntry?.total ?? entry.uses), 0);
      const critDenominator = getTotalHits(entry);
      const critRate =
        critDenominator > 0
          ? toFixedNumber(
              clamp((getTotalCrits(entry) / critDenominator) * 100, 0, 100),
              1
            )
          : 0;
      const damage = roundAmount(entry.totalADPS ?? entry.total);
      const top10Benchmark = buildMockTop10Benchmark(
        templates[index],
        damage,
        casts
      );

      return {
        skill: entry.name,
        casts,
        hits: Math.max(getTotalHits(entry), casts),
        damage,
        top10Damage: top10Benchmark.top10Damage,
        critRate,
        top10Casts: top10Benchmark.top10Casts,
      };
    });
};

const buildEncounterSummary = (
  fightsData: Ff14ReportFightsResponse,
  fightId: number,
  selectedFight: Ff14ReportFight,
  damageDoneData: Ff14TableResponse<Ff14TableEntry>
) => {
  const encounterDuration = Math.max(
    damageDoneData.combatTime ?? selectedFight.combatTime,
    1
  );
  const encounterFriendlies = fightsData.friendlies.filter((friendly) =>
    friendly.fights?.some((fight) => fight.id === fightId)
  );
  const serverMap = new Map<number, string>(
    encounterFriendlies.map((friendly) => [friendly.id, friendly.server ?? "-"])
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
        deaths: 0,
        parse,
        tier: getParseTier(parse),
        totalDamage,
        activePct,
      });

      return summary;
    }, [])
    .sort((left, right) => right.adps - left.adps);
};

const loadCharacterDetailForFight = async (
  reportId: string,
  selectedFight: Ff14ReportFight,
  character: CharacterSummary,
  signal?: AbortSignal
): Promise<CharacterDetail> => {
  const [damageDoneData, castsData] = await Promise.all([
    loadReportTable<Ff14AbilityTableEntry>(
      reportId,
      selectedFight,
      "damage-done",
      signal,
      { sourceid: character.id }
    ),
    loadReportTable<Ff14AbilityTableEntry>(
      reportId,
      selectedFight,
      "casts",
      signal,
      { sourceid: character.id }
    ),
  ]);

  const damageEntries = damageDoneData.entries ?? [];
  const castEntries = castsData.entries ?? [];
  const skillRows = buildRealSkillRows(character, damageEntries, castEntries);

  if (!skillRows.length) {
    throw new Error("未获取到技能明细数据");
  }

  const encounterDuration = Math.max(
    damageDoneData.combatTime ??
      castsData.combatTime ??
      selectedFight.combatTime,
    1
  );
  const totalDamage = Math.max(
    skillRows.reduce((sum, skill) => sum + skill.damage, 0),
    1
  );
  const topBurstDamage = skillRows
    .slice(0, 3)
    .reduce((sum, skill) => sum + skill.damage, 0);
  const weightedCritRate =
    skillRows.reduce((sum, skill) => sum + skill.damage * skill.critRate, 0) /
    totalDamage;
  const dotUptimeCandidates = damageEntries
    .filter((entry) => (entry.uptime ?? 0) > 0 && (entry.tickCount ?? 0) > 0)
    .map((entry) =>
      clamp(((entry.uptime ?? 0) / encounterDuration) * 100, 0, 100)
    );

  return {
    burstWindowScore: clamp(
      Math.round((topBurstDamage / totalDamage) * 55 + weightedCritRate * 0.9),
      0,
      99
    ),
    gcdUptime: toFixedNumber(clamp(character.activePct ?? 0, 0, 100), 1),
    dotUptime: toFixedNumber(
      dotUptimeCandidates.length ? Math.max(...dotUptimeCandidates) : 0,
      1
    ),
    skillRows,
    topPlayers: buildTopPlayers(character.job),
  };
};

export const loadEncounterSummary = async (
  report: ParsedReport,
  signal?: AbortSignal
) => {
  const { fightsData, selectedFight, fightId } = await loadSelectedFight(
    report,
    signal
  );
  const damageDoneData = await loadReportTable<Ff14TableEntry>(
    report.reportId,
    selectedFight,
    "damage-done",
    signal
  );

  return buildEncounterSummary(
    fightsData,
    fightId,
    selectedFight,
    damageDoneData
  );
};

export const loadCharacterDetail = async (
  report: ParsedReport,
  character: CharacterSummary,
  signal?: AbortSignal
): Promise<CharacterDetail> => {
  const { selectedFight } = await loadSelectedFight(report, signal);

  return loadCharacterDetailForFight(
    report.reportId,
    selectedFight,
    character,
    signal
  );
};

export const loadEncounterData = async (
  report: ParsedReport,
  signal?: AbortSignal
) => {
  const { fightsData, selectedFight, fightId } = await loadSelectedFight(
    report,
    signal
  );
  const damageDoneData = await loadReportTable<Ff14TableEntry>(
    report.reportId,
    selectedFight,
    "damage-done",
    signal
  );
  const summary = buildEncounterSummary(
    fightsData,
    fightId,
    selectedFight,
    damageDoneData
  );

  const detailResults = await Promise.allSettled(
    summary.map(async (character) => ({
      characterId: character.id,
      detail: await loadCharacterDetailForFight(
        report.reportId,
        selectedFight,
        character,
        signal
      ),
    }))
  );

  const detailsByCharacterId: Record<string, CharacterDetail> = {};
  const detailErrorsByCharacterId: Record<string, string> = {};

  detailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      detailsByCharacterId[result.value.characterId] = result.value.detail;
      return;
    }

    const character = summary[index];

    if (!character) {
      return;
    }

    detailErrorsByCharacterId[character.id] =
      result.reason instanceof Error
        ? result.reason.message
        : "加载技能明细失败";
  });

  return {
    summary,
    detailsByCharacterId,
    detailErrorsByCharacterId,
  };
};

export const parseFflogsReport = (input: string): ParsedReport | null => {
  const value = input.trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "fflogs.com" && !host.endsWith(".fflogs.com")) {
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
      top10Damage: template.top10Damage,
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
