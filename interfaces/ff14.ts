export type Role = "Tank" | "Healer" | "Melee" | "Ranged" | "Caster";
export type Job =
  | "PLD"
  | "WAR"
  | "DRK"
  | "GNB"
  | "WHM"
  | "SCH"
  | "AST"
  | "SGE"
  | "MNK"
  | "DRG"
  | "NIN"
  | "SAM"
  | "RPR"
  | "VPR"
  | "BRD"
  | "MCH"
  | "DNC"
  | "BLM"
  | "SMN"
  | "RDM"
  | "PCT";
export type ParseTier = "gold" | "purple" | "blue" | "green";
export type Locale = "zh" | "en";

export interface StaticText {
  kicker: string;
  heroTitle: string;
  heroDesc: string;
  reportInputTitle: string;
  statusReady: string;
  statusIdle: string;
  switchAria: string;
  reportUrlLabel: string;
  reportUrlPlaceholder: string;
  reportPrefix: string;
  fightPrefix: string;
  todoHint: string;
  examplePrefix: string;
  encounterSummaryTitle: string;
  totalRdpsLabel: string;
  avgParseLabel: string;
  tableRank: string;
  tablePlayer: string;
  tableRole: string;
  tableJob: string;
  tableRdps: string;
  tableAdps: string;
  tableDeaths: string;
  tableParse: string;
  tableAmount: string;
  tableActive: string;
  tableDps: string;
  skillBreakdownTitle: string;
  burstWindowScoreHint: string;
  burstWindowScore: string;
  gcdUptime: string;
  dotUptime: string;
  skillHeader: string;
  yourCasts: string;
  top10Average: string;
  top10HitsAverage: string;
  top10Damage: string;
  delta: string;
  hitDelta: string;
  totalDamage: string;
  hits: string;
  crit: string;
  top10Title: string;
  killLabel: string;
  timelineHint: string;
  timelineScale: string;
  timelineSampleLabel: string;
  timelineSelfLabel: string;
  timelineEmpty: string;
  timelineMobileHint: string;
  timelineBackToOverview: string;
  coachingTitle: string;
  coachingDesc1: string;
  coachingDesc2: string;
  emptyTitle: string;
  emptyDesc: string;
  backToSummary: string;
  switchZh: string;
  switchEn: string;
  summaryViewSwitchAria: string;
  summaryToggleShowValues: string;
  summaryToggleBarsOnly: string;
  summaryBarsOnlyHint: string;
}

export interface ParsedReport {
  reportId: string;
  fightId: string;
}

export interface CharacterSummary {
  id: string;
  name: string;
  server: string;
  role: Role;
  job: Job;
  dps: number;
  rdps: number;
  adps: number;
  deaths: number;
  parse: number;
  tier: ParseTier;
  totalDamage?: number;
  activePct?: number;
}

export interface SkillTemplate {
  skill: string;
  top10Casts: number;
  hitRate: number;
  top10Damage: number;
  critRate: number;
}

export interface SkillRow {
  abilityKey: string;
  abilityIconUrl: string | null;
  skill: string;
  casts: number;
  hits: number;
  damage: number;
  rdps: number;
  top10Hits: number | null;
  top10Damage: number | null;
  critRate: number;
  top10Casts: number | null;
}

export interface SkillBenchmark {
  top10Casts: number;
  top10Hits: number;
  top10Damage: number;
}

export type TimelineCastState = "completed" | "interrupted";

export interface TopPlayer {
  rank: number;
  name: string;
  server: string;
  rdps: number;
  killTimeSec: number;
}

export interface TimelineEvent {
  id: string;
  abilityKey: string;
  abilityIconUrl: string | null;
  skill: string;
  timestampMs: number;
  relativeMs: number;
  castDurationMs: number | null;
  castState: TimelineCastState | null;
}

export interface TimelineTrack {
  actorId: string;
  rank: number | null;
  name: string;
  server: string;
  rdps: number;
  killTimeSec: number;
  combatTimeMs: number;
  isSelectedCharacter: boolean;
  events: TimelineEvent[];
}

export interface CharacterDetail {
  burstWindowScore: number;
  gcdUptime: number;
  dotUptime: number;
  skillRows: SkillRow[];
  topPlayers: TopPlayer[];
}

export interface TopJobComparison {
  topPlayers: TopPlayer[];
  benchmarksByAbilityKey: Record<string, SkillBenchmark>;
  sampleSize: number;
  timelineTracks: TimelineTrack[];
  maxDurationMs: number;
}
