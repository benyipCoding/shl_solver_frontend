"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Crosshair, Gauge, Link2, Sword, Trophy } from "lucide-react";
import { Orbitron, Plus_Jakarta_Sans } from "next/font/google";

const headingFont = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const styles = {
  page: "relative min-h-screen overflow-hidden px-[clamp(14px,2.8vw,34px)] text-[#edf3ff] font-[var(--font-body)] bg-[radial-gradient(circle_at_8%_10%,rgba(57,134,255,0.22),transparent_35%),radial-gradient(circle_at_92%_2%,rgba(255,164,84,0.18),transparent_36%),linear-gradient(138deg,#060d1a_0%,#0b1324_46%,#141f39_100%)] max-[560px]:px-2.5",
  backdropA:
    "pointer-events-none absolute -right-[120px] -top-[180px] h-[420px] w-[420px] rounded-[46%_54%_38%_62%/52%_42%_58%_48%] bg-[linear-gradient(135deg,rgba(89,171,255,0.18),rgba(25,87,214,0.04))] blur-[2px]",
  backdropB:
    "pointer-events-none absolute -bottom-[180px] -left-[120px] h-[360px] w-[360px] rounded-[58%_42%_64%_36%/48%_61%_39%_52%] bg-[linear-gradient(150deg,rgba(255,168,98,0.16),rgba(255,125,74,0.05))] blur-[2px]",
  container:
    "relative z-[1] mx-auto grid max-w-[1220px] gap-[18px] max-[760px]:gap-3.5",
  hero: "grid gap-3 px-[clamp(18px,2.6vw,26px)] max-[760px]:gap-2 max-[760px]:px-0.5 max-[760px]:pb-1 [&>h1]:m-0 [&>h1]:font-[var(--font-heading)] [&>h1]:text-[clamp(1.68rem,8vw,2.9rem)] [&>h1]:leading-[1.1] [&>h1]:tracking-[0.02em] [&>p]:m-0 [&>p]:max-w-[760px] [&>p]:text-[#a8bbd8] [&>p]:leading-[1.6]",
  kicker:
    "m-0 text-[0.76rem] uppercase tracking-[0.16em] text-[#9ec5ff] font-[var(--font-heading)]",
  card: "rounded-[22px] border border-[rgba(139,182,255,0.25)] bg-[linear-gradient(160deg,rgba(15,23,39,0.88),rgba(11,17,30,0.92))] p-[clamp(14px,2vw,22px)] shadow-[0_20px_54px_rgba(7,13,25,0.52),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[7px] max-[760px]:rounded-[18px] max-[760px]:p-[11px]",
  cardHeader:
    "mb-3.5 flex items-start justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start max-[760px]:mb-[11px] [&>h2]:m-0 [&>h2]:inline-flex [&>h2]:items-center [&>h2]:gap-2 [&>h2]:text-[clamp(1rem,1.6vw,1.15rem)] [&>h2]:font-semibold [&>h2]:tracking-[0.02em] [&>h2]:font-[var(--font-heading)]",
  headerControls:
    "inline-flex flex-wrap items-center justify-end gap-2.5 max-[760px]:w-full max-[760px]:justify-start",
  languageSwitch:
    "inline-flex items-center gap-[7px] rounded-full border border-[rgba(124,171,247,0.4)] bg-[rgba(24,39,68,0.6)] px-2 py-1 text-[#d8e9ff] transition-colors hover:border-[rgba(160,197,255,0.72)] hover:bg-[rgba(32,50,86,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(114,178,255,0.3)]",
  langOption:
    "min-w-[22px] text-center text-[0.72rem] font-semibold text-[#87a8d1]",
  langOptionActive: "text-[#f3f8ff]",
  langTrack:
    "relative inline-flex h-[18px] w-[34px] items-center rounded-full bg-[rgba(81,120,186,0.5)]",
  langThumb:
    "absolute left-0.5 h-[14px] w-[14px] rounded-full bg-[#d8e8ff] transition-transform",
  langThumbRight: "translate-x-4",
  statusReady:
    "whitespace-nowrap rounded-full border border-[rgba(113,224,181,0.35)] bg-[rgba(18,108,72,0.25)] px-2.5 py-[5px] text-[0.75rem] text-[#9cffcb] max-[560px]:text-[0.72rem]",
  statusIdle:
    "whitespace-nowrap rounded-full border border-[rgba(255,183,117,0.34)] bg-[rgba(129,73,20,0.3)] px-2.5 py-[5px] text-[0.75rem] text-[#ffd8b0] max-[560px]:text-[0.72rem]",
  inputLabel: "mb-2 inline-block text-[0.9rem] text-[#bcd1ef]",
  urlInput:
    "w-full rounded-[14px] border border-[rgba(153,190,255,0.35)] bg-[rgba(8,14,28,0.84)] px-[14px] py-3 text-[0.94rem] text-[#edf3ff] placeholder:text-[#7f96ba] transition-[border-color,box-shadow] focus:border-[rgba(109,182,255,0.9)] focus:outline-none focus:ring-4 focus:ring-[rgba(60,156,255,0.2)]",
  metaRow: "mt-3 flex flex-wrap gap-2",
  metaBadge:
    "rounded-full border border-[rgba(127,174,255,0.36)] bg-[rgba(54,95,170,0.2)] px-2.5 py-1 text-[0.8rem] text-[#d7e6ff]",
  metaHint: "self-center text-[0.84rem] text-[#a6bbd9]",
  statsLine:
    "flex flex-wrap gap-2.5 text-[0.85rem] text-[#c5d8f3] max-[560px]:gap-1.5 max-[560px]:text-[0.76rem]",
  summaryViewSwitch:
    "hidden rounded-full border border-[rgba(126,173,249,0.42)] bg-[rgba(34,58,99,0.45)] px-2.5 py-1 text-[0.72rem] text-[#d6e7ff] transition-colors hover:border-[rgba(165,204,255,0.72)] hover:bg-[rgba(49,76,124,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(114,178,255,0.35)] max-[760px]:inline-flex",
  tableWrap:
    "overflow-x-auto rounded-[14px] border border-[rgba(124,156,210,0.22)] max-[760px]:hidden",
  summaryMobileList: "m-0 hidden list-none gap-2.5 p-0 max-[760px]:grid",
  summaryMobileCard:
    "w-full appearance-none rounded-[14px] border border-[rgba(123,165,233,0.3)] bg-[rgba(20,31,54,0.55)] p-2.5 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(115,180,255,0.38)]",
  summaryMobileCardSelected:
    "border-[rgba(140,187,255,0.62)] bg-[rgba(48,79,136,0.28)] shadow-[inset_0_0_0_1px_rgba(150,196,255,0.35)]",
  summaryMobileTop:
    "mb-2 flex items-start justify-between gap-2.5 rounded-lg border border-[rgba(125,158,214,0.2)] bg-[rgba(11,18,31,0.45)] p-2",
  summaryMobileIdentity: "flex min-w-0 items-start gap-2",
  summaryMobileNameWrap: "min-w-0",
  summaryMobileName: "m-0 text-[0.88rem] font-semibold",
  summaryMobileServer: "m-0 mt-0.5 text-[0.74rem] text-[#8ea8cd]",
  summaryMobileBadges: "mb-2 inline-flex flex-wrap items-center gap-1.5",
  summaryMobileAmount:
    "mb-2 flex items-center gap-2 text-[0.74rem] text-[#b8ccec]",
  summaryMobileTrack:
    "h-[11px] flex-1 overflow-hidden rounded bg-[rgba(10,18,33,0.8)] border border-[rgba(255,255,255,0.06)]",
  summaryMobileFill: "h-full rounded transition-all duration-500",
  summaryMobileStats: "grid grid-cols-2 gap-1.5",
  summaryMobileStat:
    "rounded-lg border border-[rgba(123,160,224,0.2)] bg-[rgba(16,26,44,0.45)] px-1.5 py-1.5 [&>span]:block [&>span]:text-[0.65rem] [&>span]:text-[#8ea8cd] [&>strong]:mt-1 [&>strong]:block [&>strong]:text-[0.78rem] [&>strong]:font-semibold [&>strong]:text-[#e8f2ff]",
  summaryMobileHint: "m-0 text-[0.72rem] text-[#8ea8cd]",
  summaryTable:
    "w-full min-w-[760px] border-collapse [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:border-b [&_th]:border-[rgba(105,130,170,0.25)] [&_th]:bg-[rgba(25,38,64,0.52)] [&_th]:p-[11px_12px] [&_th]:text-left [&_th]:text-[0.72rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-[#9fb9df] [&_td]:border-b [&_td]:border-[rgba(105,130,170,0.25)] [&_td]:p-[11px_12px] [&_td]:text-left [&_td]:text-[0.86rem] [&_tbody_tr]:transition-colors [&_tbody_tr:nth-child(odd)]:bg-[rgba(20,32,56,0.34)] [&_tbody_tr:nth-child(even)]:bg-[rgba(10,19,35,0.38)] [&_tbody_tr:hover]:bg-[rgba(80,122,198,0.13)] max-[760px]:[&_th]:p-[9px_10px] max-[760px]:[&_td]:p-[9px_10px] max-[760px]:[&_th]:text-[0.8rem] max-[760px]:[&_td]:text-[0.8rem]",
  skillMobileList: "m-0 hidden list-none gap-2.5 p-0 max-[760px]:grid",
  skillMobileCard:
    "rounded-[14px] border border-[rgba(123,165,233,0.3)] bg-[rgba(20,31,54,0.55)] p-2.5",
  skillMobileHeader: "mb-2 flex items-start justify-between gap-2",
  skillMobileName: "m-0 text-[0.84rem] font-semibold text-[#e7f2ff]",
  skillMobileDelta:
    "inline-flex rounded-full border px-2 py-0.5 text-[0.72rem] font-semibold",
  skillMobileDeltaGood:
    "border-[rgba(128,243,191,0.4)] bg-[rgba(22,115,75,0.28)] text-[#9ff6c8]",
  skillMobileDeltaBad:
    "border-[rgba(255,154,154,0.45)] bg-[rgba(132,54,54,0.27)] text-[#ffc6c6]",
  skillMobileGrid: "grid grid-cols-2 gap-1.5",
  skillMobileMetric:
    "rounded-lg border border-[rgba(123,160,224,0.2)] bg-[rgba(16,26,44,0.45)] px-1.5 py-1.5 [&>span]:block [&>span]:text-[0.65rem] [&>span]:text-[#8ea8cd] [&>strong]:mt-1 [&>strong]:block [&>strong]:text-[0.78rem] [&>strong]:font-semibold [&>strong]:text-[#e8f2ff]",
  jobBadge:
    "inline-block w-6 text-center text-[0.7rem] font-bold uppercase tracking-wider rounded bg-[rgba(255,255,255,0.1)] px-1 py-0.5",
  skillTable:
    "w-full min-w-[760px] border-collapse [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:border-b [&_th]:border-[rgba(105,130,170,0.25)] [&_th]:bg-[rgba(25,38,64,0.52)] [&_th]:p-[11px_12px] [&_th]:text-left [&_th]:text-[0.72rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-[#9fb9df] [&_td]:border-b [&_td]:border-[rgba(105,130,170,0.25)] [&_td]:p-[11px_12px] [&_td]:text-left [&_td]:text-[0.86rem] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[rgba(80,122,198,0.13)] max-[760px]:[&_th]:p-[9px_10px] max-[760px]:[&_td]:p-[9px_10px] max-[760px]:[&_th]:text-[0.8rem] max-[760px]:[&_td]:text-[0.8rem]",
  rowSelected:
    "!bg-[linear-gradient(90deg,rgba(84,140,233,0.28),rgba(84,140,233,0.08))] shadow-[inset_0_0_0_1px_rgba(141,183,255,0.35)]",
  summaryRow: "cursor-pointer",
  playerCell: "grid gap-0.5",
  playerName: "font-semibold text-[#eaf3ff]",
  playerServer: "text-[0.78rem] text-[#8ea8cd]",
  roleChip:
    "inline-block rounded-full border border-transparent px-2.5 py-[3px] text-[0.73rem]",
  parseChip:
    "inline-block rounded-full border border-transparent px-2.5 py-[3px] text-[0.73rem]",
  roleTank:
    "border-[rgba(128,170,255,0.45)] bg-[rgba(55,91,161,0.32)] text-[#bfdbff]",
  roleHealer:
    "border-[rgba(122,244,198,0.4)] bg-[rgba(39,120,88,0.3)] text-[#bffbe0]",
  roleMelee:
    "border-[rgba(255,157,124,0.42)] bg-[rgba(147,71,37,0.3)] text-[#ffd8c1]",
  roleCaster:
    "border-[rgba(204,148,255,0.45)] bg-[rgba(113,52,156,0.3)] text-[#e8cfff]",
  parseGold:
    "border-[rgba(255,208,112,0.48)] bg-[rgba(140,103,26,0.34)] text-[#ffe5a4]",
  parsePurple:
    "border-[rgba(210,163,255,0.45)] bg-[rgba(99,52,139,0.34)] text-[#e4ccff]",
  parseBlue:
    "border-[rgba(149,189,255,0.45)] bg-[rgba(53,94,167,0.34)] text-[#cfe2ff]",
  parseGreen:
    "border-[rgba(121,237,154,0.45)] bg-[rgba(28,122,57,0.34)] text-[#cfffd8]",
  detailGrid:
    "grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-[18px] max-[1040px]:grid-cols-1 max-[760px]:gap-3",
  metricGrid:
    "mb-3.5 grid grid-cols-3 gap-2.5 max-[760px]:mb-2.5 max-[760px]:grid-cols-1",
  metricCard:
    "grid gap-[7px] rounded-[14px] border border-[rgba(128,168,232,0.25)] bg-[rgba(34,50,80,0.36)] p-[11px] [&>strong]:text-[1.2rem] [&>strong]:leading-none [&>strong]:text-[#f6f9ff]",
  metricLabel: "inline-flex items-center gap-1.5 text-[0.77rem] text-[#a9c2e6]",
  deltaText: "font-bold",
  deltaGood: "text-[#8ef2be]",
  deltaBad: "text-[#ff9f9f]",
  rankList: "m-0 grid list-none gap-2 p-0",
  rankItem:
    "flex items-center justify-between gap-3 rounded-xl border border-[rgba(123,158,219,0.24)] bg-[rgba(26,37,63,0.36)] p-[11px] max-[760px]:grid max-[760px]:grid-cols-[1fr_auto] max-[760px]:items-center",
  rankName: "m-0 text-[0.9rem] font-semibold text-[#ebf3ff]",
  rankMeta: "m-0 mt-[3px] text-[0.77rem] text-[#95b0d5]",
  rankValue:
    "text-[0.98rem] tracking-[0.02em] text-[#ffdca8] font-[var(--font-heading)]",
  coachingBox:
    "mt-3.5 rounded-[14px] border border-[rgba(255,187,133,0.28)] bg-[linear-gradient(145deg,rgba(116,67,24,0.34),rgba(59,39,22,0.2))] p-3 [&>h3]:mb-2 [&>h3]:mt-0 [&>h3]:font-[var(--font-heading)] [&>h3]:text-[0.96rem] [&>p]:m-0 [&>p]:text-[0.82rem] [&>p]:leading-[1.5] [&>p]:text-[#f0dcc1] [&>p+p]:mt-2",
  emptyState:
    "rounded-[22px] border border-dashed border-[rgba(152,182,227,0.45)] bg-[rgba(15,22,40,0.65)] p-[clamp(20px,3vw,32px)] [&>h2]:mb-2 [&>h2]:mt-0 [&>h2]:font-[var(--font-heading)] [&>h2]:text-[clamp(1.1rem,2vw,1.35rem)] [&>p]:m-0 [&>p]:max-w-[720px] [&>p]:leading-[1.6] [&>p]:text-[#a8bddc]",
} as const;

type Role = "Tank" | "Healer" | "Melee" | "Caster";
type Job = "SAM" | "NIN" | "DRG" | "RPR" | "PLD" | "WHM" | "SGE" | "BLM";
type ParseTier = "gold" | "purple" | "blue" | "green";
type Locale = "zh" | "en";

interface StaticText {
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

interface CharacterSummary {
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
}

interface SkillTemplate {
  skill: string;
  top10Casts: number;
  hitRate: number;
  top10Damage: number;
  critRate: number;
}

interface SkillRow {
  skill: string;
  casts: number;
  hits: number;
  damage: number;
  critRate: number;
  top10Casts: number;
}

interface TopPlayer {
  rank: number;
  name: string;
  server: string;
  rdps: number;
  killTimeSec: number;
}

interface CharacterDetail {
  burstWindowScore: number;
  gcdUptime: number;
  dotUptime: number;
  skillRows: SkillRow[];
  topPlayers: TopPlayer[];
}

const MOCK_SUMMARY: CharacterSummary[] = [
  {
    id: "you",
    name: "Aster Vale",
    server: "Tonberry",
    role: "Melee",
    job: "SAM",
    rdps: 16432,
    adps: 16990,
    casts: 287,
    deaths: 1,
    parse: 61,
    tier: "blue",
  },
  {
    id: "p2",
    name: "Rin Kuro",
    server: "Tonberry",
    role: "Melee",
    job: "NIN",
    rdps: 17751,
    adps: 18344,
    casts: 302,
    deaths: 0,
    parse: 93,
    tier: "gold",
  },
  {
    id: "p3",
    name: "Sol Maren",
    server: "Kujata",
    role: "Melee",
    job: "DRG",
    rdps: 17020,
    adps: 17610,
    casts: 294,
    deaths: 0,
    parse: 88,
    tier: "purple",
  },
  {
    id: "p4",
    name: "Iris Crow",
    server: "Aegis",
    role: "Melee",
    job: "RPR",
    rdps: 16811,
    adps: 17239,
    casts: 289,
    deaths: 0,
    parse: 79,
    tier: "purple",
  },
  {
    id: "p5",
    name: "Kael Ward",
    server: "Ifrit",
    role: "Tank",
    job: "PLD",
    rdps: 11235,
    adps: 12120,
    casts: 238,
    deaths: 0,
    parse: 76,
    tier: "purple",
  },
  {
    id: "p6",
    name: "Ena Bloom",
    server: "Unicorn",
    role: "Healer",
    job: "WHM",
    rdps: 7340,
    adps: 8410,
    casts: 210,
    deaths: 0,
    parse: 84,
    tier: "purple",
  },
  {
    id: "p7",
    name: "Mio Crest",
    server: "Durandal",
    role: "Healer",
    job: "SGE",
    rdps: 7112,
    adps: 8288,
    casts: 224,
    deaths: 0,
    parse: 72,
    tier: "blue",
  },
  {
    id: "p8",
    name: "Lyn Hart",
    server: "Ridill",
    role: "Caster",
    job: "BLM",
    rdps: 18508,
    adps: 18832,
    casts: 267,
    deaths: 1,
    parse: 90,
    tier: "gold",
  },
];

const JOB_SKILL_TEMPLATES: Record<Job, SkillTemplate[]> = {
  SAM: [
    {
      skill: "Midare Setsugekka",
      top10Casts: 17,
      hitRate: 1,
      top10Damage: 4880000,
      critRate: 41.5,
    },
    {
      skill: "Kaeshi Setsugekka",
      top10Casts: 17,
      hitRate: 1,
      top10Damage: 4760000,
      critRate: 39.2,
    },
    {
      skill: "Higanbana",
      top10Casts: 5,
      hitRate: 7.4,
      top10Damage: 1660000,
      critRate: 29.8,
    },
    {
      skill: "Shinten",
      top10Casts: 41,
      hitRate: 1,
      top10Damage: 3380000,
      critRate: 33.4,
    },
    {
      skill: "Senei",
      top10Casts: 8,
      hitRate: 1,
      top10Damage: 1420000,
      critRate: 43.1,
    },
  ],
  NIN: [
    {
      skill: "Raiton",
      top10Casts: 24,
      hitRate: 1,
      top10Damage: 3020000,
      critRate: 37.2,
    },
    {
      skill: "Bhavacakra",
      top10Casts: 19,
      hitRate: 1,
      top10Damage: 2810000,
      critRate: 34.2,
    },
    {
      skill: "Hyosho Ranryu",
      top10Casts: 8,
      hitRate: 1,
      top10Damage: 1860000,
      critRate: 44.5,
    },
    {
      skill: "Aeolian Edge",
      top10Casts: 30,
      hitRate: 1,
      top10Damage: 2600000,
      critRate: 31.7,
    },
    {
      skill: "Forked Raiju",
      top10Casts: 15,
      hitRate: 1,
      top10Damage: 2170000,
      critRate: 35.9,
    },
  ],
  DRG: [
    {
      skill: "Heavens Thrust",
      top10Casts: 23,
      hitRate: 1,
      top10Damage: 3090000,
      critRate: 36.8,
    },
    {
      skill: "Nastrond",
      top10Casts: 16,
      hitRate: 1,
      top10Damage: 2780000,
      critRate: 38.6,
    },
    {
      skill: "Stardiver",
      top10Casts: 8,
      hitRate: 1,
      top10Damage: 1920000,
      critRate: 42.8,
    },
    {
      skill: "Wyrmwind Thrust",
      top10Casts: 13,
      hitRate: 1,
      top10Damage: 1660000,
      critRate: 35.2,
    },
    {
      skill: "Chaotic Spring",
      top10Casts: 6,
      hitRate: 6.5,
      top10Damage: 1490000,
      critRate: 28.9,
    },
  ],
  RPR: [
    {
      skill: "Communio",
      top10Casts: 11,
      hitRate: 1,
      top10Damage: 3030000,
      critRate: 39.8,
    },
    {
      skill: "Gluttony",
      top10Casts: 10,
      hitRate: 1,
      top10Damage: 1860000,
      critRate: 37.1,
    },
    {
      skill: "Lemures Slice",
      top10Casts: 30,
      hitRate: 1,
      top10Damage: 2680000,
      critRate: 30.2,
    },
    {
      skill: "Gibbet",
      top10Casts: 27,
      hitRate: 1,
      top10Damage: 2390000,
      critRate: 32.4,
    },
    {
      skill: "Plentiful Harvest",
      top10Casts: 8,
      hitRate: 1,
      top10Damage: 1670000,
      critRate: 35.4,
    },
  ],
  PLD: [
    {
      skill: "Confiteor",
      top10Casts: 12,
      hitRate: 1,
      top10Damage: 1880000,
      critRate: 34.4,
    },
    {
      skill: "Blade of Faith",
      top10Casts: 12,
      hitRate: 1,
      top10Damage: 1530000,
      critRate: 33.1,
    },
    {
      skill: "Atonement",
      top10Casts: 28,
      hitRate: 1,
      top10Damage: 2220000,
      critRate: 27.5,
    },
    {
      skill: "Expiacion",
      top10Casts: 12,
      hitRate: 1,
      top10Damage: 1210000,
      critRate: 31.8,
    },
    {
      skill: "Circle of Scorn",
      top10Casts: 11,
      hitRate: 4.6,
      top10Damage: 910000,
      critRate: 22.1,
    },
  ],
  WHM: [
    {
      skill: "Glare III",
      top10Casts: 167,
      hitRate: 1,
      top10Damage: 3800000,
      critRate: 22.8,
    },
    {
      skill: "Afflatus Misery",
      top10Casts: 6,
      hitRate: 1,
      top10Damage: 1540000,
      critRate: 28.1,
    },
    {
      skill: "Dia",
      top10Casts: 5,
      hitRate: 7.1,
      top10Damage: 990000,
      critRate: 15.6,
    },
    {
      skill: "Assize",
      top10Casts: 11,
      hitRate: 1,
      top10Damage: 1020000,
      critRate: 18.4,
    },
    {
      skill: "Presence of Mind",
      top10Casts: 7,
      hitRate: 1,
      top10Damage: 0,
      critRate: 0,
    },
  ],
  SGE: [
    {
      skill: "Dosis III",
      top10Casts: 162,
      hitRate: 1,
      top10Damage: 3620000,
      critRate: 23.6,
    },
    {
      skill: "Pneuma",
      top10Casts: 7,
      hitRate: 1,
      top10Damage: 1120000,
      critRate: 21.4,
    },
    {
      skill: "Phlegma III",
      top10Casts: 13,
      hitRate: 1,
      top10Damage: 1460000,
      critRate: 27.9,
    },
    {
      skill: "Eukrasian Dosis",
      top10Casts: 5,
      hitRate: 7.3,
      top10Damage: 970000,
      critRate: 16.8,
    },
    {
      skill: "Toxikon",
      top10Casts: 9,
      hitRate: 1,
      top10Damage: 740000,
      critRate: 19.2,
    },
  ],
  BLM: [
    {
      skill: "Xenoglossy",
      top10Casts: 14,
      hitRate: 1,
      top10Damage: 2890000,
      critRate: 31.9,
    },
    {
      skill: "Despair",
      top10Casts: 18,
      hitRate: 1,
      top10Damage: 3150000,
      critRate: 29.6,
    },
    {
      skill: "Fire IV",
      top10Casts: 66,
      hitRate: 1,
      top10Damage: 5540000,
      critRate: 25.3,
    },
    {
      skill: "Paradox",
      top10Casts: 18,
      hitRate: 1,
      top10Damage: 1380000,
      critRate: 20.8,
    },
    {
      skill: "Thunder III",
      top10Casts: 5,
      hitRate: 7.6,
      top10Damage: 1220000,
      critRate: 17.1,
    },
  ],
};

const JOB_BASE_RDPS: Record<Job, number> = {
  SAM: 18350,
  NIN: 18100,
  DRG: 17840,
  RPR: 17620,
  PLD: 12480,
  WHM: 8650,
  SGE: 8520,
  BLM: 19120,
};

const TOP_PLAYER_NAMES = [
  "Noel Rift",
  "Kite Arc",
  "Yuna Vale",
  "Ari Sora",
  "Nero Gale",
  "Mina Crest",
  "Eli Dawn",
  "Taro Lux",
  "Rhea Voss",
  "Kian Moro",
];

const SERVERS = [
  "Tonberry",
  "Kujata",
  "Aegis",
  "Ridill",
  "Unicorn",
  "Durandal",
];

const TEXT: Record<Locale, StaticText> = {
  zh: {
    kicker: "团队复盘实验室",
    heroTitle: "FFXIV 战斗分析器",
    heroDesc:
      "粘贴一条 FFLogs 战斗链接，即可在同一页面查看团队汇总、个人技能施放和同职业 Top 10 对比。",
    reportInputTitle: "1. 战斗日志输入",
    statusReady: "模拟数据已就绪",
    statusIdle: "等待有效链接",
    switchAria: "切换中英文",
    reportUrlLabel: "FFLogs 战斗链接",
    reportUrlPlaceholder: "https://www.fflogs.com/reports/...?...",
    reportPrefix: "报告ID",
    fightPrefix: "战斗ID",
    todoHint: "TODO：后续替换为真实 FFLogs V1 API 响应",
    examplePrefix: "示例：",
    encounterSummaryTitle: "2. 战斗汇总",
    totalRdpsLabel: "团队总 rDPS",
    avgParseLabel: "平均 parse",
    tableRank: "排名",
    tablePlayer: "玩家",
    tableRole: "职责",
    tableJob: "职业",
    tableRdps: "rDPS",
    tableAdps: "aDPS",
    tableCasts: "施放数",
    tableDeaths: "死亡",
    tableParse: "Parse %",
    tableAmount: "伤害量",
    tableActive: "活跃度",
    tableDps: "DPS",
    skillBreakdownTitle: "3. 技能明细",
    burstWindowScore: "爆发窗口评分",
    gcdUptime: "GCD 覆盖率",
    dotUptime: "DOT 覆盖率",
    skillHeader: "技能",
    yourCasts: "你的施放",
    top10Average: "Top10 均值",
    delta: "差值",
    totalDamage: "总伤害",
    hits: "命中",
    crit: "暴击率",
    top10Title: "4. 同职业 Top 10",
    killLabel: "击杀",
    coachingTitle: "复盘建议",
    coachingDesc1:
      "优先关注与你同职业 Top 10 均值差距最大的负向技能，通常这是最直接的提升点。",
    coachingDesc2:
      "下一步可加入时间轴标记（2分钟团队增益、爆发药、机制停手），定位技能缺失发生在何时。",
    emptyTitle: "请先粘贴有效的 FFLogs 战斗链接",
    emptyDesc:
      "当前原型使用静态模拟数据。接入后端 API 后，这里将自动加载战斗汇总与角色技能细节。",
    switchZh: "中",
    switchEn: "EN",
    summaryViewSwitchAria: "切换战斗汇总显示模式",
    summaryToggleShowValues: "显示 rDPS / aDPS",
    summaryToggleBarsOnly: "仅看柱状图",
    summaryBarsOnlyHint:
      "当前仅显示占比柱状图，点击上方开关可查看 rDPS / aDPS。",
  },
  en: {
    kicker: "Raid Decision Lab",
    heroTitle: "FFXIV Combat Analyzer",
    heroDesc:
      "Paste one FFLogs fight URL and explore role summaries, personal skill usage, and same-job Top 10 comparisons in one screen.",
    reportInputTitle: "1. Report Input",
    statusReady: "Mock data ready",
    statusIdle: "Waiting for valid URL",
    switchAria: "Switch language",
    reportUrlLabel: "FFLogs fight URL",
    reportUrlPlaceholder: "https://www.fflogs.com/reports/...?...",
    reportPrefix: "Report",
    fightPrefix: "Fight",
    todoHint: "TODO: replace with real FFLogs V1 API response",
    examplePrefix: "Example:",
    encounterSummaryTitle: "2. Encounter Summary",
    totalRdpsLabel: "Total rDPS",
    avgParseLabel: "Avg parse",
    tableRank: "Rank",
    tablePlayer: "Name",
    tableRole: "Role",
    tableJob: "Job",
    tableRdps: "rDPS",
    tableAdps: "aDPS",
    tableCasts: "Casts",
    tableDeaths: "Deaths",
    tableParse: "Parse %",
    tableAmount: "Amount",
    tableActive: "Active",
    tableDps: "DPS",
    skillBreakdownTitle: "3. Skill Breakdown",
    burstWindowScore: "Burst Window Score",
    gcdUptime: "GCD Uptime",
    dotUptime: "DOT/Uptime",
    skillHeader: "Skill",
    yourCasts: "Your casts",
    top10Average: "Top10 avg",
    delta: "Delta",
    totalDamage: "Total damage",
    hits: "Hits",
    crit: "Crit",
    top10Title: "4. Same Job Top 10",
    killLabel: "kill",
    coachingTitle: "Coaching Snapshot",
    coachingDesc1:
      "Compare your cast counts against Top 10 averages and prioritize the largest negative deltas first.",
    coachingDesc2:
      "Next step: surface timeline markers (2-minute buffs, potion windows, forced downtime) for each skill.",
    emptyTitle: "Paste a valid FFLogs fight link to begin",
    emptyDesc:
      "This prototype page uses static mock data only. Once backend API is connected, this panel can auto-load encounter summary and player skill-level details.",
    switchZh: "中",
    switchEn: "EN",
    summaryViewSwitchAria: "Toggle encounter summary view mode",
    summaryToggleShowValues: "Show rDPS / aDPS",
    summaryToggleBarsOnly: "Bars only",
    summaryBarsOnlyHint:
      "Now showing contribution bars only. Use the switch above to reveal rDPS / aDPS.",
  },
};

const parseFflogsReport = (
  input: string
): { reportId: string; fightId: string } | null => {
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

const buildCharacterDetail = (character: CharacterSummary): CharacterDetail => {
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

const formatNumber = (value: number): string => value.toLocaleString("en-US");

const jobColorMap: Record<Job, string> = {
  SAM: "#e46d04",
  NIN: "#af1964",
  DRG: "#4164cd",
  RPR: "#965a90",
  PLD: "#a8d2e6",
  WHM: "#fff0dc",
  SGE: "#80a0f0",
  BLM: "#a579d6",
};

const roleClassMap: Record<Role, string> = {
  Tank: styles.roleTank,
  Healer: styles.roleHealer,
  Melee: styles.roleMelee,
  Caster: styles.roleCaster,
};

const parseClassMap: Record<ParseTier, string> = {
  gold: styles.parseGold,
  purple: styles.parsePurple,
  blue: styles.parseBlue,
  green: styles.parseGreen,
};

const FF14Page = () => {
  const [reportUrl, setReportUrl] = useState(
    "https://www.fflogs.com/reports/yZrcbBYf8GL9TqCF?fight=112"
  );
  const [locale, setLocale] = useState<Locale>("zh");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(
    MOCK_SUMMARY[0]?.id ?? ""
  );
  const [showMobileSummaryValues, setShowMobileSummaryValues] = useState(false);

  const t = TEXT[locale];

  const parsedReport = useMemo(() => parseFflogsReport(reportUrl), [reportUrl]);
  const hasValidReport = Boolean(parsedReport);
  const sortedSummary = useMemo(
    () => [...MOCK_SUMMARY].sort((a, b) => b.rdps - a.rdps),
    []
  );

  useEffect(() => {
    if (!hasValidReport) {
      return;
    }

    // TODO: Replace mock data with backend call based on reportUrl.
    // Example: GET /api/ff14/report?url=${encodeURIComponent(reportUrl)}
    // Then hydrate summary rows + per-character skill details.
  }, [hasValidReport, reportUrl]);

  const selectedCharacter = useMemo(() => {
    if (!hasValidReport) {
      return null;
    }
    return (
      sortedSummary.find((item) => item.id === selectedCharacterId) ??
      sortedSummary[0] ??
      null
    );
  }, [hasValidReport, selectedCharacterId, sortedSummary]);

  const selectedDetail = useMemo(() => {
    if (!selectedCharacter) {
      return null;
    }
    return buildCharacterDetail(selectedCharacter);
  }, [selectedCharacter]);

  const raidTotals = useMemo(() => {
    const raidRdps = sortedSummary.reduce((sum, item) => sum + item.rdps, 0);
    const maxRdps = sortedSummary[0]?.rdps ?? 1;
    const avgParse =
      sortedSummary.reduce((sum, item) => sum + item.parse, 0) /
      sortedSummary.length;
    return {
      raidRdps,
      maxRdps,
      avgParse,
    };
  }, [sortedSummary]);

  const toggleLocale = () => {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  };

  return (
    <main
      className={`${styles.page} ${headingFont.variable} ${bodyFont.variable}`}
    >
      <div className={styles.backdropA} aria-hidden />
      <div className={styles.backdropB} aria-hidden />

      <div className={styles.container}>
        <section className={styles.hero}>
          <p className={styles.kicker}>{t.kicker}</p>
          <h1>{t.heroTitle}</h1>
          <p>{t.heroDesc}</p>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>
              <Link2 size={18} />
              {t.reportInputTitle}
            </h2>
            <div className={styles.headerControls}>
              <button
                type="button"
                className={styles.languageSwitch}
                role="switch"
                aria-checked={locale === "en"}
                aria-label={t.switchAria}
                onClick={toggleLocale}
              >
                <span
                  className={`${styles.langOption} ${
                    locale === "zh" ? styles.langOptionActive : ""
                  }`}
                >
                  {t.switchZh}
                </span>
                <span className={styles.langTrack}>
                  <span
                    className={`${styles.langThumb} ${
                      locale === "en" ? styles.langThumbRight : ""
                    }`}
                  />
                </span>
                <span
                  className={`${styles.langOption} ${
                    locale === "en" ? styles.langOptionActive : ""
                  }`}
                >
                  {t.switchEn}
                </span>
              </button>

              <span
                className={
                  hasValidReport ? styles.statusReady : styles.statusIdle
                }
              >
                {hasValidReport ? t.statusReady : t.statusIdle}
              </span>
            </div>
          </div>

          <label className={styles.inputLabel} htmlFor="fflogs-report-url">
            {t.reportUrlLabel}
          </label>
          <input
            id="fflogs-report-url"
            className={styles.urlInput}
            placeholder={t.reportUrlPlaceholder}
            value={reportUrl}
            onChange={(event) => setReportUrl(event.target.value)}
          />

          <div className={styles.metaRow}>
            {parsedReport ? (
              <>
                <span className={styles.metaBadge}>
                  {t.reportPrefix}: {parsedReport.reportId}
                </span>
                <span className={styles.metaBadge}>
                  {t.fightPrefix}: #{parsedReport.fightId}
                </span>
                <span className={styles.metaHint}>{t.todoHint}</span>
              </>
            ) : (
              <span className={styles.metaHint}>
                {t.examplePrefix}
                https://www.fflogs.com/reports/yZrcbBYf8GL9TqCF?fight=112
              </span>
            )}
          </div>
        </section>

        {hasValidReport ? (
          <>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>
                  <Sword size={18} />
                  {t.encounterSummaryTitle}
                </h2>

                <button
                  type="button"
                  className={styles.summaryViewSwitch}
                  role="switch"
                  aria-checked={showMobileSummaryValues}
                  aria-label={t.summaryViewSwitchAria}
                  onClick={() => setShowMobileSummaryValues((prev) => !prev)}
                >
                  {showMobileSummaryValues
                    ? t.summaryToggleBarsOnly
                    : t.summaryToggleShowValues}
                </button>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.summaryTable}>
                  <thead>
                    <tr>
                      <th className="w-60">{t.tablePlayer}</th>
                      <th className="min-w-65">{t.tableAmount}</th>
                      <th className="text-right">{t.tableRdps}</th>
                      <th className="text-right">{t.tableAdps}</th>
                      <th className="text-center">{t.tableCasts}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSummary.map((member) => {
                      const isSelected = member.id === selectedCharacter?.id;
                      const amountPercent = (
                        (member.rdps / raidTotals.raidRdps) *
                        100
                      ).toFixed(2);
                      const barWidth = `${(member.rdps / raidTotals.maxRdps) * 100}%`;
                      const jobColor = jobColorMap[member.job] || "#ccc";

                      return (
                        <tr
                          key={member.id}
                          className={`${styles.summaryRow} ${
                            isSelected ? styles.rowSelected : ""
                          }`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedCharacterId(member.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedCharacterId(member.id);
                            }
                          }}
                        >
                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                className={styles.jobBadge}
                                style={{
                                  color: jobColor,
                                  backgroundColor: `color-mix(in srgb, ${jobColor} 15%, transparent)`,
                                }}
                              >
                                {member.job}
                              </span>
                              <div className={styles.playerCell}>
                                <span
                                  className={styles.playerName}
                                  style={{ color: jobColor }}
                                >
                                  {member.name}
                                </span>
                                <span className={styles.playerServer}>
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
                              <div className="flex-1 h-3.5 bg-[rgba(15,23,42,0.4)] rounded-sm overflow-hidden flex items-center border border-[rgba(255,255,255,0.05)]">
                                <div
                                  style={{
                                    width: barWidth,
                                    backgroundColor: jobColor,
                                  }}
                                  className="h-full rounded-sm transition-all duration-500 opacity-90 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                                />
                              </div>
                              <span className="w-11.25 text-right font-medium">
                                {((member.rdps * 516) / 1000000).toFixed(2)}m
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

              <ul className={styles.summaryMobileList}>
                {sortedSummary.map((member) => {
                  const isSelected = member.id === selectedCharacter?.id;
                  const amountPercent = (
                    (member.rdps / raidTotals.raidRdps) *
                    100
                  ).toFixed(2);
                  const barWidth = `${(member.rdps / raidTotals.maxRdps) * 100}%`;
                  const jobColor = jobColorMap[member.job] || "#ccc";
                  const roleClass = roleClassMap[member.role];
                  const parseClass = parseClassMap[member.tier];

                  return (
                    <li key={`mobile-${member.id}`}>
                      <button
                        type="button"
                        className={`${styles.summaryMobileCard} ${
                          isSelected ? styles.summaryMobileCardSelected : ""
                        }`}
                        onClick={() => setSelectedCharacterId(member.id)}
                      >
                        <div className={styles.summaryMobileTop}>
                          <div className={styles.summaryMobileIdentity}>
                            <span
                              className={styles.jobBadge}
                              style={{
                                color: jobColor,
                                backgroundColor: `color-mix(in srgb, ${jobColor} 15%, transparent)`,
                              }}
                            >
                              {member.job}
                            </span>
                            <div className={styles.summaryMobileNameWrap}>
                              <p
                                className={styles.summaryMobileName}
                                style={{ color: jobColor }}
                              >
                                {member.name}
                              </p>
                              <p className={styles.summaryMobileServer}>
                                {member.server}
                              </p>
                            </div>
                          </div>
                          <span className={`${styles.parseChip} ${parseClass}`}>
                            {t.tableParse} {member.parse}
                          </span>
                        </div>

                        <div className={styles.summaryMobileBadges}>
                          <span className={`${styles.roleChip} ${roleClass}`}>
                            {member.role}
                          </span>
                        </div>

                        <div className={styles.summaryMobileAmount}>
                          <span className="w-11 text-right font-medium">
                            {amountPercent}%
                          </span>
                          <div className={styles.summaryMobileTrack}>
                            <div
                              className={styles.summaryMobileFill}
                              style={{
                                width: barWidth,
                                backgroundColor: jobColor,
                              }}
                            />
                          </div>
                          <span className="w-12 text-right font-medium">
                            {((member.rdps * 516) / 1000000).toFixed(2)}m
                          </span>
                        </div>

                        {showMobileSummaryValues && (
                          <div className={styles.summaryMobileStats}>
                            <div className={styles.summaryMobileStat}>
                              <span>{t.tableRdps}</span>
                              <strong>{formatNumber(member.rdps)}</strong>
                            </div>
                            <div className={styles.summaryMobileStat}>
                              <span>{t.tableAdps}</span>
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

            {selectedCharacter && selectedDetail ? (
              <section className={styles.detailGrid}>
                <article className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2>
                      <Crosshair size={18} />
                      {t.skillBreakdownTitle}: {selectedCharacter.name} (
                      {selectedCharacter.job})
                    </h2>
                  </div>

                  <div className={styles.metricGrid}>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>
                        <Gauge size={16} />
                        {t.burstWindowScore}
                      </span>
                      <strong>{selectedDetail.burstWindowScore}</strong>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>
                        <Activity size={16} />
                        {t.gcdUptime}
                      </span>
                      <strong>{selectedDetail.gcdUptime.toFixed(1)}%</strong>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>
                        <Trophy size={16} />
                        {t.dotUptime}
                      </span>
                      <strong>{selectedDetail.dotUptime.toFixed(1)}%</strong>
                    </div>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.skillTable}>
                      <thead>
                        <tr>
                          <th>{t.skillHeader}</th>
                          <th>{t.yourCasts}</th>
                          <th>{t.top10Average}</th>
                          <th>{t.delta}</th>
                          <th>{t.totalDamage}</th>
                          <th>{t.hits}</th>
                          <th>{t.crit}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.skillRows.map((skill) => {
                          const delta = skill.casts - skill.top10Casts;
                          const deltaClass =
                            delta >= 0 ? styles.deltaGood : styles.deltaBad;

                          return (
                            <tr key={skill.skill}>
                              <td>{skill.skill}</td>
                              <td>{skill.casts}</td>
                              <td>{skill.top10Casts}</td>
                              <td>
                                <span
                                  className={`${styles.deltaText} ${deltaClass}`}
                                >
                                  {delta > 0 ? `+${delta}` : delta}
                                </span>
                              </td>
                              <td>
                                {skill.damage > 0
                                  ? formatNumber(skill.damage)
                                  : "-"}
                              </td>
                              <td>{skill.hits}</td>
                              <td>
                                {skill.critRate > 0
                                  ? `${skill.critRate.toFixed(1)}%`
                                  : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <ul className={styles.skillMobileList}>
                    {selectedDetail.skillRows.map((skill) => {
                      const delta = skill.casts - skill.top10Casts;
                      const deltaClass =
                        delta >= 0
                          ? styles.skillMobileDeltaGood
                          : styles.skillMobileDeltaBad;

                      return (
                        <li key={`mobile-${skill.skill}`}>
                          <div className={styles.skillMobileCard}>
                            <div className={styles.skillMobileHeader}>
                              <p className={styles.skillMobileName}>
                                {skill.skill}
                              </p>
                              <span
                                className={`${styles.skillMobileDelta} ${deltaClass}`}
                              >
                                {t.delta} {delta > 0 ? `+${delta}` : delta}
                              </span>
                            </div>

                            <div className={styles.skillMobileGrid}>
                              <div className={styles.skillMobileMetric}>
                                <span>{t.yourCasts}</span>
                                <strong>{skill.casts}</strong>
                              </div>
                              <div className={styles.skillMobileMetric}>
                                <span>{t.top10Average}</span>
                                <strong>{skill.top10Casts}</strong>
                              </div>
                              <div className={styles.skillMobileMetric}>
                                <span>{t.totalDamage}</span>
                                <strong>
                                  {skill.damage > 0
                                    ? formatNumber(skill.damage)
                                    : "-"}
                                </strong>
                              </div>
                              <div className={styles.skillMobileMetric}>
                                <span>{t.hits}</span>
                                <strong>{skill.hits}</strong>
                              </div>
                              <div className={styles.skillMobileMetric}>
                                <span>{t.crit}</span>
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

                <aside className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2>
                      <Trophy size={18} />
                      {t.top10Title} ({selectedCharacter.job})
                    </h2>
                  </div>

                  <ul className={styles.rankList}>
                    {selectedDetail.topPlayers.map((player) => (
                      <li
                        key={`${selectedCharacter.job}-${player.rank}`}
                        className={styles.rankItem}
                      >
                        <div>
                          <p className={styles.rankName}>
                            #{player.rank} {player.name}
                          </p>
                          <p className={styles.rankMeta}>
                            {player.server} | {t.killLabel} {player.killTimeSec}
                            s
                          </p>
                        </div>
                        <span className={styles.rankValue}>
                          {formatNumber(player.rdps)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className={styles.coachingBox}>
                    <h3>{t.coachingTitle}</h3>
                    <p>{t.coachingDesc1}</p>
                    <p>{t.coachingDesc2}</p>
                  </div>
                </aside>
              </section>
            ) : null}
          </>
        ) : (
          <section className={styles.emptyState}>
            <h2>{t.emptyTitle}</h2>
            <p>{t.emptyDesc}</p>
          </section>
        )}
      </div>
    </main>
  );
};

export default FF14Page;
