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
  tableCasts: string;
  tableDeaths: string;
  tableParse: string;
  tableAmount: string;
  tableActive: string;
  tableDps: string;
  skillBreakdownTitle: string;
  burstWindowScore: string;
  gcdUptime: string;
  dotUptime: string;
  skillHeader: string;
  yourCasts: string;
  top10Average: string;
  delta: string;
  totalDamage: string;
  hits: string;
  crit: string;
  top10Title: string;
  killLabel: string;
  coachingTitle: string;
  coachingDesc1: string;
  coachingDesc2: string;
  emptyTitle: string;
  emptyDesc: string;
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
  rdps: number;
  adps: number;
  casts: number;
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
  skill: string;
  casts: number;
  hits: number;
  damage: number;
  critRate: number;
  top10Casts: number;
}

export interface TopPlayer {
  rank: number;
  name: string;
  server: string;
  rdps: number;
  killTimeSec: number;
}

export interface CharacterDetail {
  burstWindowScore: number;
  gcdUptime: number;
  dotUptime: number;
  skillRows: SkillRow[];
  topPlayers: TopPlayer[];
}
