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
  SkillBenchmark,
  SkillRow,
  SkillTemplate,
  TimelineEvent,
  TimelineTrack,
  TopJobComparison,
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
  boss?: number;
  difficulty?: number;
  start_time: number;
  end_time: number;
  combatTime: number;
}

interface Ff14EncounterRankingEntry {
  name: string;
  serverName?: string;
  regionName?: string;
  hidden?: boolean;
  duration?: number;
  total?: number;
  rDPS?: number;
  reportID?: string;
  fightID?: number;
  startTime?: number;
}

interface Ff14EncounterRankingReference extends Ff14EncounterRankingEntry {
  reportID: string;
  fightID: number;
}

interface Ff14EncounterRankingsResponse {
  page?: number;
  hasMorePages?: boolean;
  rankings?: Ff14EncounterRankingEntry[];
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
  totalDPS?: number;
  totalRDPS?: number;
  totalADPS?: number;
}

interface Ff14AbilityTableEntry {
  name: string;
  guid?: number;
  abilityIcon?: string;
  type?: number | string;
  total: number;
  totalRDPS?: number;
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
  damageDowntime?: number;
}

interface Ff14EventAbility {
  name?: string;
  guid?: number;
  abilityIcon?: string;
  type?: number | string;
}

interface Ff14EventEntry {
  timestamp?: number;
  type?: string;
  ability?: Ff14EventAbility;
  duration?: number;
  packetID?: number;
  sourceID?: number;
}

interface Ff14EventResponse<TEvent = Ff14EventEntry> {
  events?: TEvent[];
  nextPageTimestamp?: number;
}

interface Ff14ReferenceAbilityRow {
  abilityKey: string;
  casts: number;
  hits: number;
  damage: number;
  rdps: number;
}

interface PendingTimelineCast {
  abilitySourceKey: string;
  beginEntry: Ff14EventEntry;
  index: number;
}

const TIMELINE_CAST_PAIR_TOLERANCE_MS = 250;

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

const JOB_TO_FFLOGS_SPEC_ID: Record<Job, number> = {
  AST: 1,
  BRD: 2,
  BLM: 3,
  DRK: 4,
  DRG: 5,
  MCH: 6,
  MNK: 7,
  NIN: 8,
  PLD: 9,
  SCH: 10,
  SMN: 11,
  WAR: 12,
  WHM: 13,
  RDM: 14,
  SAM: 15,
  DNC: 16,
  GNB: 17,
  RPR: 18,
  SGE: 19,
  VPR: 20,
  PCT: 21,
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

const TOP_REFERENCE_LIMIT = 10;
const FFLOGS_ABILITY_ICON_BASE_URL =
  "https://assets.rpglogs.com/img/ff/abilities/";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toFixedNumber = (value: number, digits: number) =>
  Number(value.toFixed(digits));

const roundAmount = (value?: number) => Math.round(value ?? 0);

const toAbilityIconUrl = (iconPath?: string | null) => {
  const trimmedPath = iconPath?.trim();

  if (!trimmedPath) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedPath)) {
    return trimmedPath;
  }

  if (trimmedPath.startsWith("abilities/")) {
    return `https://assets.rpglogs.com/img/ff/${trimmedPath}`;
  }

  return `${FFLOGS_ABILITY_ICON_BASE_URL}${trimmedPath}`;
};

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
  const baseline = Math.max(JOB_BASE_RDPS[job] ?? 17000, 1);
  const rdpsScore = clamp((rdps / baseline) * 100, 0, 99);
  const uptimeBonus = clamp((activePct - 75) * 0.8, 0, 12);

  return clamp(Math.round(rdpsScore * 0.88 + uptimeBonus), 1, 99);
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

const loadReportEvents = async <TEvent>(
  reportId: string,
  fight: Pick<Ff14ReportFight, "start_time" | "end_time">,
  view: string,
  signal?: AbortSignal,
  extraParams?: Record<string, string | number | undefined>
) =>
  fetchFf14Data<Ff14EventResponse<TEvent>>(
    `/api/ff14_logs/report/events?view=${encodeURIComponent(view)}&${buildReportTableQuery(
      reportId,
      fight,
      extraParams
    )}`,
    signal
  );

const getAbilityKey = (entry: Pick<Ff14AbilityTableEntry, "guid" | "name">) =>
  typeof entry.guid === "number" ? `guid:${entry.guid}` : `name:${entry.name}`;

const normalizeComparableText = (value?: string) =>
  (value ?? "").trim().toLowerCase();

const getTotalHits = (entry?: Partial<Ff14AbilityTableEntry>) =>
  (entry?.hitCount ?? 0) +
  (entry?.tickCount ?? 0) +
  (entry?.multistrikeHitCount ?? 0) +
  (entry?.multistrikeTickCount ?? 0);

const getTotalCrits = (entry?: Partial<Ff14AbilityTableEntry>) =>
  (entry?.critHitCount ?? 0) + (entry?.critTickCount ?? 0);

const hasValidReferenceLog = (reference: {
  reportID?: string;
  fightID?: number;
}): reference is { reportID: string; fightID: number } =>
  typeof reference.reportID === "string" &&
  reference.reportID.trim() !== "" &&
  typeof reference.fightID === "number" &&
  Number.isFinite(reference.fightID);

const buildTopPlayerFromRankingEntry = (
  entry: Pick<
    Ff14EncounterRankingEntry,
    "name" | "serverName" | "regionName" | "rDPS" | "total" | "duration"
  >,
  rank: number
): TopPlayer => ({
  rank,
  name: entry.name,
  server: entry.serverName ?? entry.regionName ?? "-",
  rdps: roundAmount(entry.rDPS ?? entry.total),
  killTimeSec: Math.max(1, Math.round((entry.duration ?? 0) / 1000)),
});

const buildReferenceAbilityRows = (
  damageEntries: Ff14AbilityTableEntry[],
  castEntries: Ff14AbilityTableEntry[],
  encounterDuration: number
): Ff14ReferenceAbilityRow[] => {
  const castEntryByKey = new Map<string, Ff14AbilityTableEntry>();

  castEntries.forEach((entry) => {
    castEntryByKey.set(getAbilityKey(entry), entry);
  });

  return damageEntries
    .filter((entry) => roundAmount(entry.total) > 0 && entry.name.trim() !== "")
    .map((entry) => {
      const abilityKey = getAbilityKey(entry);
      const castEntry = castEntryByKey.get(abilityKey);

      return {
        abilityKey,
        casts: Math.max(roundAmount(castEntry?.total ?? entry.uses), 0),
        hits: Math.max(
          getTotalHits(entry),
          roundAmount(castEntry?.total ?? entry.uses),
          0
        ),
        damage: roundAmount(entry.totalADPS ?? entry.total),
        rdps: Math.round(
          ((entry.totalRDPS ?? entry.total ?? 0) * 1000) /
            Math.max(encounterDuration, 1)
        ),
      };
    });
};

const getTimelineEventMetadata = (entry: Ff14EventEntry) => {
  const abilityName = entry.ability?.name?.trim();

  if (!abilityName || typeof entry.timestamp !== "number") {
    return null;
  }

  return {
    abilityIconUrl: toAbilityIconUrl(entry.ability?.abilityIcon),
    abilityKey: getAbilityKey({
      guid: entry.ability?.guid,
      name: abilityName,
    }),
    skill: abilityName,
    timestampMs: entry.timestamp,
  };
};

const getTimelineAbilitySourceKey = (
  entry: Pick<Ff14EventEntry, "sourceID">,
  abilityKey: string
) => `${entry.sourceID ?? 0}:${abilityKey}`;

const getTimelineCastDurationMs = (
  entry: Pick<Ff14EventEntry, "duration" | "timestamp">,
  castTimestampMs?: number
) => {
  if (typeof entry.duration === "number" && Number.isFinite(entry.duration)) {
    return Math.max(entry.duration, 0);
  }

  if (
    typeof castTimestampMs === "number" &&
    typeof entry.timestamp === "number" &&
    Number.isFinite(castTimestampMs)
  ) {
    return Math.max(castTimestampMs - entry.timestamp, 0);
  }

  return null;
};

const getTimelineCastPairWindowMs = (
  entry: Pick<Ff14EventEntry, "duration" | "timestamp">
) => (getTimelineCastDurationMs(entry) ?? 0) + TIMELINE_CAST_PAIR_TOLERANCE_MS;

const getTimelineEventSortWeight = (entryType?: string) =>
  entryType === "begincast" ? 0 : 1;

const buildTimelineEvent = ({
  entry,
  fightStartTime,
  index,
  timestampMs,
  castDurationMs = null,
  castState = null,
  idSuffix,
}: {
  entry: Ff14EventEntry;
  fightStartTime: number;
  index: number;
  timestampMs?: number;
  castDurationMs?: number | null;
  castState?: TimelineEvent["castState"];
  idSuffix?: string;
}): TimelineEvent | null => {
  const metadata = getTimelineEventMetadata(entry);

  if (!metadata) {
    return null;
  }

  const resolvedTimestampMs =
    typeof timestampMs === "number" && Number.isFinite(timestampMs)
      ? timestampMs
      : metadata.timestampMs;

  return {
    id: `${metadata.abilityKey}:${resolvedTimestampMs}:${idSuffix ?? entry.type ?? "event"}:${index}`,
    abilityKey: metadata.abilityKey,
    abilityIconUrl: metadata.abilityIconUrl,
    skill: metadata.skill,
    timestampMs: resolvedTimestampMs,
    relativeMs: Math.max(resolvedTimestampMs - fightStartTime, 0),
    castDurationMs,
    castState,
  };
};

const loadCharacterTimelineEvents = async (
  reportId: string,
  selectedFight: Pick<Ff14ReportFight, "start_time" | "end_time">,
  sourceId: number,
  signal?: AbortSignal
) => {
  const rawTimelineEntries: Array<{ entry: Ff14EventEntry; index: number }> =
    [];
  const seenEventKeys = new Set<string>();
  let nextStartTime = selectedFight.start_time;

  while (nextStartTime < selectedFight.end_time) {
    const payload = await loadReportEvents<Ff14EventEntry>(
      reportId,
      {
        start_time: nextStartTime,
        end_time: selectedFight.end_time,
      },
      "casts",
      signal,
      { sourceid: sourceId }
    );

    (payload.events ?? []).forEach((entry, index) => {
      const metadata = getTimelineEventMetadata(entry);

      if (!metadata) {
        return;
      }

      const eventKey =
        typeof entry.packetID === "number"
          ? `packet:${entry.packetID}`
          : `${entry.type ?? "event"}:${metadata.timestampMs}:${entry.sourceID ?? 0}:${metadata.abilityKey}`;

      if (seenEventKeys.has(eventKey)) {
        return;
      }

      seenEventKeys.add(eventKey);
      rawTimelineEntries.push({ entry, index });
    });

    const cursor = payload.nextPageTimestamp;

    if (!cursor || cursor <= nextStartTime) {
      break;
    }

    nextStartTime = cursor;
  }

  rawTimelineEntries.sort((left, right) => {
    const leftTimestamp = left.entry.timestamp ?? 0;
    const rightTimestamp = right.entry.timestamp ?? 0;

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    return (
      getTimelineEventSortWeight(left.entry.type) -
      getTimelineEventSortWeight(right.entry.type)
    );
  });

  const timelineEvents: TimelineEvent[] = [];
  const pendingTimelineCasts = new Map<string, PendingTimelineCast>();

  const finalizePendingTimelineCast = (
    pendingCast: PendingTimelineCast,
    castState: TimelineEvent["castState"]
  ) => {
    const timelineEvent = buildTimelineEvent({
      entry: pendingCast.beginEntry,
      fightStartTime: selectedFight.start_time,
      index: pendingCast.index,
      castDurationMs: getTimelineCastDurationMs(pendingCast.beginEntry),
      castState,
      idSuffix: `begincast:${castState}`,
    });

    if (timelineEvent) {
      timelineEvents.push(timelineEvent);
    }
  };

  const flushPendingTimelineCast = (
    abilitySourceKey: string,
    castState: TimelineEvent["castState"]
  ) => {
    const pendingCast = pendingTimelineCasts.get(abilitySourceKey);

    if (!pendingCast) {
      return;
    }

    pendingTimelineCasts.delete(abilitySourceKey);
    finalizePendingTimelineCast(pendingCast, castState);
  };

  const flushExpiredPendingTimelineCasts = (currentTimestampMs: number) => {
    Array.from(pendingTimelineCasts.entries()).forEach(
      ([abilitySourceKey, pendingCast]) => {
        const beginTimestampMs = pendingCast.beginEntry.timestamp ?? 0;

        if (
          beginTimestampMs +
            getTimelineCastPairWindowMs(pendingCast.beginEntry) >=
          currentTimestampMs
        ) {
          return;
        }

        flushPendingTimelineCast(abilitySourceKey, "interrupted");
      }
    );
  };

  rawTimelineEntries.forEach(({ entry, index }) => {
    const metadata = getTimelineEventMetadata(entry);

    if (!metadata) {
      return;
    }

    flushExpiredPendingTimelineCasts(metadata.timestampMs);

    const abilitySourceKey = getTimelineAbilitySourceKey(
      entry,
      metadata.abilityKey
    );

    if (entry.type === "begincast") {
      flushPendingTimelineCast(abilitySourceKey, "interrupted");
      pendingTimelineCasts.set(abilitySourceKey, {
        abilitySourceKey,
        beginEntry: entry,
        index,
      });
      return;
    }

    if (entry.type === "cast") {
      const pendingCast = pendingTimelineCasts.get(abilitySourceKey);

      if (pendingCast) {
        const beginTimestampMs = pendingCast.beginEntry.timestamp ?? 0;

        if (
          metadata.timestampMs >= beginTimestampMs &&
          metadata.timestampMs <=
            beginTimestampMs +
              getTimelineCastPairWindowMs(pendingCast.beginEntry)
        ) {
          const completedCastEvent = buildTimelineEvent({
            entry: pendingCast.beginEntry,
            fightStartTime: selectedFight.start_time,
            index: pendingCast.index,
            castDurationMs: getTimelineCastDurationMs(
              pendingCast.beginEntry,
              metadata.timestampMs
            ),
            castState: "completed",
            idSuffix: "begincast:completed",
          });

          pendingTimelineCasts.delete(abilitySourceKey);

          if (completedCastEvent) {
            timelineEvents.push(completedCastEvent);
            return;
          }
        } else {
          flushPendingTimelineCast(abilitySourceKey, "interrupted");
        }
      }
    }

    const timelineEvent = buildTimelineEvent({
      entry,
      fightStartTime: selectedFight.start_time,
      index,
    });

    if (timelineEvent) {
      timelineEvents.push(timelineEvent);
    }
  });

  pendingTimelineCasts.forEach((pendingCast) => {
    finalizePendingTimelineCast(pendingCast, "interrupted");
  });

  return timelineEvents.sort(
    (left, right) => left.relativeMs - right.relativeMs
  );
};

const buildTimelineTrack = ({
  actorId,
  rank,
  name,
  server,
  rdps,
  killTimeSec,
  combatTimeMs,
  isSelectedCharacter,
  events,
}: {
  actorId: string;
  rank: number | null;
  name: string;
  server: string;
  rdps: number;
  killTimeSec: number;
  combatTimeMs: number;
  isSelectedCharacter: boolean;
  events: TimelineEvent[];
}): TimelineTrack => ({
  actorId,
  rank,
  name,
  server,
  rdps,
  killTimeSec,
  combatTimeMs: Math.max(combatTimeMs, 1),
  isSelectedCharacter,
  events,
});

const aggregateSkillBenchmarks = (
  referenceRowsList: Ff14ReferenceAbilityRow[][],
  sampleSize: number
): Record<string, SkillBenchmark> => {
  if (sampleSize <= 0) {
    return {};
  }

  const aggregateByAbilityKey: Record<
    string,
    {
      totalCasts: number;
      totalDamage: number;
      totalHits: number;
      totalRdps: number;
    }
  > = {};

  referenceRowsList.forEach((rows) => {
    rows.forEach((row) => {
      const aggregate =
        aggregateByAbilityKey[row.abilityKey] ??
        (aggregateByAbilityKey[row.abilityKey] = {
          totalCasts: 0,
          totalDamage: 0,
          totalHits: 0,
          totalRdps: 0,
        });

      aggregate.totalCasts += row.casts;
      aggregate.totalDamage += row.damage;
      aggregate.totalHits += row.hits;
      aggregate.totalRdps += row.rdps;
    });
  });

  return Object.fromEntries(
    Object.entries(aggregateByAbilityKey).map(([abilityKey, aggregate]) => [
      abilityKey,
      {
        top10Casts: Math.round(aggregate.totalCasts / sampleSize),
        top10Hits: Math.round(aggregate.totalHits / sampleSize),
        top10Damage: Math.round(aggregate.totalDamage / sampleSize),
        top10Rdps: Math.round(aggregate.totalRdps / sampleSize),
      },
    ])
  );
};

const buildRealSkillRows = (
  character: CharacterSummary,
  damageEntries: Ff14AbilityTableEntry[],
  castEntries: Ff14AbilityTableEntry[],
  encounterDuration: number
): SkillRow[] => {
  const castEntryByKey = new Map<string, Ff14AbilityTableEntry>();

  castEntries.forEach((entry) => {
    castEntryByKey.set(getAbilityKey(entry), entry);
  });

  return damageEntries
    .filter((entry) => roundAmount(entry.total) > 0 && entry.name.trim() !== "")
    .sort((left, right) => roundAmount(right.total) - roundAmount(left.total))
    .map((entry) => {
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
      const rdps = Math.round(
        ((entry.totalRDPS ?? entry.total ?? 0) * 1000) /
          Math.max(encounterDuration, 1)
      );

      return {
        abilityKey: getAbilityKey(entry),
        abilityIconUrl: toAbilityIconUrl(
          entry.abilityIcon ?? castEntry?.abilityIcon
        ),
        skill: entry.name,
        casts,
        hits: Math.max(getTotalHits(entry), casts),
        damage,
        rdps,
        top10Hits: null,
        top10Damage: null,
        top10Rdps: null,
        critRate,
        top10Casts: null,
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
    damageDoneData.totalTime ??
      damageDoneData.combatTime ??
      selectedFight.combatTime,
    1
  );
  const effectiveEncounterDuration = Math.max(
    (damageDoneData.combatTime ?? selectedFight.combatTime) -
      (damageDoneData.damageDowntime ?? 0),
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
      const dps = Math.round(
        typeof entry.totalDPS === "number"
          ? entry.totalDPS
          : ((entry.total ?? 0) * 1000) / effectiveEncounterDuration
      );
      const rdps = Math.round(
        ((entry.totalRDPS ?? entry.total ?? 0) * 1000) /
          effectiveEncounterDuration
      );
      const adps = Math.round(
        ((entry.totalADPS ?? entry.total ?? 0) * 1000) /
          effectiveEncounterDuration
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
        dps,
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
    .sort((left, right) => right.dps - left.dps);
};

const loadReportFight = async (
  reportId: string,
  requestedFightId: number | string,
  signal?: AbortSignal
) => {
  const fightsData = await fetchFf14Data<Ff14ReportFightsResponse>(
    `/api/ff14_logs/report/fights?code=${encodeURIComponent(reportId)}`,
    signal
  );

  const normalizedFightId =
    typeof requestedFightId === "string"
      ? requestedFightId.trim().toLowerCase()
      : requestedFightId;
  const fightId =
    normalizedFightId === "last"
      ? (fightsData.fights.at(-1)?.id ?? NaN)
      : Number(normalizedFightId);

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

const loadSelectedFight = async (report: ParsedReport, signal?: AbortSignal) =>
  loadReportFight(report.reportId, report.fightId, signal);

const resolveReferenceCharacterId = (
  fightsData: Ff14ReportFightsResponse,
  fightId: number,
  reference: Pick<Ff14EncounterRankingReference, "name" | "serverName">,
  job: Job
) => {
  const encounterFriendlies = fightsData.friendlies.filter((friendly) =>
    friendly.fights?.some((fight) => fight.id === fightId)
  );
  const matchingNameAndJob = encounterFriendlies.filter(
    (friendly) =>
      friendly.name === reference.name &&
      getJobFromFflogsType(friendly.type) === job
  );

  if (!matchingNameAndJob.length) {
    return null;
  }

  const exactServerMatch = matchingNameAndJob.find(
    (friendly) =>
      normalizeComparableText(friendly.server) ===
      normalizeComparableText(reference.serverName)
  );

  return exactServerMatch?.id ?? matchingNameAndJob[0]?.id ?? null;
};

const loadEncounterRankingReferences = async (
  selectedFight: Pick<Ff14ReportFight, "boss" | "difficulty">,
  job: Job,
  signal?: AbortSignal
): Promise<Ff14EncounterRankingReference[]> => {
  const encounterId = selectedFight.boss;
  const specId = JOB_TO_FFLOGS_SPEC_ID[job];

  if (!encounterId) {
    throw new Error("当前战斗缺少有效的 Boss 信息");
  }

  const rankingReferences: Ff14EncounterRankingReference[] = [];
  let page = 1;
  let hasMorePages = true;

  while (rankingReferences.length < TOP_REFERENCE_LIMIT && hasMorePages) {
    const query = new URLSearchParams({
      encounterID: String(encounterId),
      spec: String(specId),
      page: String(page),
    });

    if (selectedFight.difficulty) {
      query.set("difficulty", String(selectedFight.difficulty));
    }

    const rankingsData = await fetchFf14Data<Ff14EncounterRankingsResponse>(
      `/api/ff14_logs/rankings/encounter?${query.toString()}`,
      signal
    );

    const visibleRankings = (rankingsData.rankings ?? []).filter(
      (entry): entry is Ff14EncounterRankingReference =>
        !entry.hidden && entry.name.trim() !== "" && hasValidReferenceLog(entry)
    );

    visibleRankings.forEach((entry) => {
      if (rankingReferences.length >= TOP_REFERENCE_LIMIT) {
        return;
      }

      rankingReferences.push(entry);
    });

    hasMorePages = Boolean(rankingsData.hasMorePages);
    page += 1;
  }

  if (!rankingReferences.length) {
    throw new Error("未获取到可展示的 Top10 榜单数据");
  }

  return rankingReferences;
};

const loadReferenceSkillRows = async (
  reference: Ff14EncounterRankingReference,
  job: Job,
  signal?: AbortSignal
) => {
  const { fightsData, selectedFight } = await loadReportFight(
    reference.reportID,
    reference.fightID,
    signal
  );
  const sourceId = resolveReferenceCharacterId(
    fightsData,
    reference.fightID,
    reference,
    job
  );

  if (!sourceId) {
    throw new Error(`未在参考日志中定位到角色 ${reference.name}`);
  }

  const [damageDoneData, castsData] = await Promise.all([
    loadReportTable<Ff14AbilityTableEntry>(
      reference.reportID,
      selectedFight,
      "damage-done",
      signal,
      { sourceid: sourceId }
    ),
    loadReportTable<Ff14AbilityTableEntry>(
      reference.reportID,
      selectedFight,
      "casts",
      signal,
      { sourceid: sourceId }
    ),
  ]);
  const effectiveEncounterDuration = Math.max(
    (damageDoneData.combatTime ??
      castsData.combatTime ??
      selectedFight.combatTime) - (damageDoneData.damageDowntime ?? 0),
    1
  );

  return buildReferenceAbilityRows(
    damageDoneData.entries ?? [],
    castsData.entries ?? [],
    effectiveEncounterDuration
  );
};

const loadReferenceSkillRowsWithFallback = async (
  reference: Ff14EncounterRankingReference,
  job: Job,
  signal?: AbortSignal
) => loadReferenceSkillRows(reference, job, signal);

const loadReferenceTimelineTrack = async (
  reference: Ff14EncounterRankingReference,
  job: Job,
  rank: number,
  signal?: AbortSignal
) => {
  const { fightsData, selectedFight } = await loadReportFight(
    reference.reportID,
    reference.fightID,
    signal
  );
  const sourceId = resolveReferenceCharacterId(
    fightsData,
    reference.fightID,
    reference,
    job
  );

  if (!sourceId) {
    throw new Error(`未在参考日志中定位到角色 ${reference.name}`);
  }

  const events = await loadCharacterTimelineEvents(
    reference.reportID,
    selectedFight,
    sourceId,
    signal
  );
  const topPlayer = buildTopPlayerFromRankingEntry(reference, rank);

  return buildTimelineTrack({
    actorId: `${reference.reportID}:${sourceId}`,
    rank,
    name: topPlayer.name,
    server: topPlayer.server,
    rdps: topPlayer.rdps,
    killTimeSec: topPlayer.killTimeSec,
    combatTimeMs: selectedFight.combatTime,
    isSelectedCharacter: false,
    events,
  });
};

const loadReferenceTimelineTrackWithFallback = async (
  reference: Ff14EncounterRankingReference,
  job: Job,
  rank: number,
  signal?: AbortSignal
) => loadReferenceTimelineTrack(reference, job, rank, signal);

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
  const encounterDuration = Math.max(
    damageDoneData.combatTime ??
      castsData.combatTime ??
      selectedFight.combatTime,
    1
  );
  const effectiveEncounterDuration = Math.max(
    (damageDoneData.combatTime ??
      castsData.combatTime ??
      selectedFight.combatTime) - (damageDoneData.damageDowntime ?? 0),
    1
  );
  const skillRows = buildRealSkillRows(
    character,
    damageEntries,
    castEntries,
    effectiveEncounterDuration
  );

  if (!skillRows.length) {
    throw new Error("未获取到技能明细数据");
  }

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
    topPlayers: [],
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

export const loadEncounterTopPlayers = async (
  report: ParsedReport,
  character: CharacterSummary,
  signal?: AbortSignal
): Promise<TopPlayer[]> =>
  (await loadEncounterTopComparison(report, character, signal)).topPlayers;

export const loadEncounterTopComparison = async (
  report: ParsedReport,
  character: CharacterSummary,
  signal?: AbortSignal
): Promise<TopJobComparison> => {
  const { selectedFight } = await loadSelectedFight(report, signal);
  const rankingReferences = await loadEncounterRankingReferences(
    selectedFight,
    character.job,
    signal
  );
  const topPlayers = rankingReferences.map((entry, index) =>
    buildTopPlayerFromRankingEntry(entry, index + 1)
  );
  const [selectedTimelineTrack, referenceResults, referenceTimelineResults] =
    await Promise.all([
      loadCharacterTimelineEvents(
        report.reportId,
        selectedFight,
        Number(character.id),
        signal
      )
        .then((events) =>
          buildTimelineTrack({
            actorId: character.id,
            rank: null,
            name: character.name,
            server: character.server,
            rdps: character.rdps,
            killTimeSec: Math.max(
              1,
              Math.round(selectedFight.combatTime / 1000)
            ),
            combatTimeMs: selectedFight.combatTime,
            isSelectedCharacter: true,
            events,
          })
        )
        .catch(() =>
          buildTimelineTrack({
            actorId: character.id,
            rank: null,
            name: character.name,
            server: character.server,
            rdps: character.rdps,
            killTimeSec: Math.max(
              1,
              Math.round(selectedFight.combatTime / 1000)
            ),
            combatTimeMs: selectedFight.combatTime,
            isSelectedCharacter: true,
            events: [],
          })
        ),
      Promise.allSettled(
        rankingReferences.map((reference) =>
          loadReferenceSkillRowsWithFallback(reference, character.job, signal)
        )
      ),
      Promise.allSettled(
        rankingReferences.map((reference, index) =>
          loadReferenceTimelineTrackWithFallback(
            reference,
            character.job,
            index + 1,
            signal
          )
        )
      ),
    ]);
  const successfulReferenceRows = referenceResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const successfulReferenceTimelineTracks = referenceTimelineResults.flatMap(
    (result) => (result.status === "fulfilled" ? [result.value] : [])
  );
  const timelineTracks = [
    selectedTimelineTrack,
    ...successfulReferenceTimelineTracks,
  ];
  const maxDurationMs = Math.max(
    selectedFight.combatTime,
    ...successfulReferenceTimelineTracks.map((track) => track.combatTimeMs),
    1
  );

  return {
    topPlayers,
    benchmarksByAbilityKey: aggregateSkillBenchmarks(
      successfulReferenceRows,
      successfulReferenceRows.length
    ),
    sampleSize: successfulReferenceRows.length,
    timelineTracks,
    maxDurationMs,
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
      abilityKey: `name:${template.skill}`,
      abilityIconUrl: null,
      skill: template.skill,
      casts,
      hits,
      damage,
      rdps: 0,
      top10Hits: Math.round(template.top10Casts * template.hitRate),
      top10Damage: template.top10Damage,
      top10Rdps: null,
      critRate,
      top10Casts: template.top10Casts,
    };
  });
  const totalSkillDamage = Math.max(
    skillRows.reduce((sum, row) => sum + row.damage, 0),
    1
  );
  const skillRowsWithRdps = skillRows.map((row) => ({
    ...row,
    rdps: Math.round((row.damage / totalSkillDamage) * character.rdps),
  }));

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
    skillRows: skillRowsWithRdps,
    topPlayers: buildTopPlayers(character.job),
  };
};

export const formatNumber = (value: number): string =>
  value.toLocaleString("en-US");
