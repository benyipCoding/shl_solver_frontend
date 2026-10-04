import type { NormalizedCandle } from "./market-data";

// Heuristic evidence ranking, not a calibrated probability of reversal.
export const SUPPORT_RESISTANCE_RULES = {
  version: 5,
  minBars: 7, // A pivot needs three bars on either side, not a fixed historical window.
  atrPeriod: 14,
  pivotRadius: 3,
  reactionBars: 8,
  volumePeriod: 20,
  clusterSpanAtr: 0.6,
  paddingAtr: 0.15,
  breakBufferAtr: 0.25,
  minScore: 60,
  maxPerSide: 2,
  acceptanceBars: 5,
  volumeAcceptanceBars: 3,
  breakoutVolume: 1.5,
  acceptanceDistanceAtr: 0.75,
  erosionSideBars: 2,
  erosionWindow: 40,
  erosionMinBars: 24,
  erosionCrossings: 3,
  erosionNearFraction: 0.7,
  erosionMaxDistanceAtr: 1.5,
} as const;

export type ZoneRole = "support" | "resistance";
export type SupportResistanceRange = { from: number; to: number };
export type ZoneStatus = "untested" | "testing" | "piercing" | "false_break" | "invalidated";
export const ZONE_STATUS_LABELS: Record<ZoneStatus, string> = {
  untested: "有效", testing: "区域内测试", piercing: "突破待确认",
  false_break: "越界后收回", invalidated: "已失效",
};
export type SupportResistanceZone = {
  id: string;
  label: string;
  role: ZoneRole;
  originRole: ZoneRole;
  lower: number;
  upper: number;
  score: number;
  startTime: number;
  lastTestTime: number;
  evidenceFrom: number;
  formedAt: number;
  detectedAt: number;
  formationAtr: number;
  tests: number;
  reactionAtr: number;
  relativeVolume: number | null;
  distanceAtr: number;
  status: ZoneStatus;
  statusReason: string;
  invalidatedAt: number | null;
  reasons: string[];
};

export type SupportResistanceSnapshot = {
  version: number;
  mode: "viewport" | "automatic";
  asOf: number | null;
  evaluatedAt: number | null;
  rangeStart: number | null;
  barsAnalyzed: number;
  referencePrice: number | null;
  atr: number;
  volumeCoverage: number;
  zones: SupportResistanceZone[];
  trackedZones: SupportResistanceZone[];
  candidateZones: SupportResistanceZone[];
  retiredZones: SupportResistanceZone[];
  message: string;
};

type Pivot = {
  index: number;
  price: number;
  role: ZoneRole;
  atr: number;
  approach: number;
  reaction: number;
  relativeVolume: number | null;
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const positiveVolume = (value: number | null) => value != null && Number.isFinite(value) && value > 0;

function calculateAtr(bars: NormalizedCandle[]) {
  const ranges: number[] = [];
  let sum = 0;
  return bars.map((bar, index) => {
    const previousClose = bars[index - 1]?.close ?? bar.open;
    const range = Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
    ranges.push(range);
    sum += range;
    if (index >= SUPPORT_RESISTANCE_RULES.atrPeriod) sum -= ranges[index - SUPPORT_RESISTANCE_RULES.atrPeriod];
    return sum / Math.min(index + 1, SUPPORT_RESISTANCE_RULES.atrPeriod);
  });
}

function findPivots(bars: NormalizedCandle[], atr: number[]): Pivot[] {
  const rules = SUPPORT_RESISTANCE_RULES;
  const result: Pivot[] = [];
  for (let index = rules.pivotRadius; index + rules.pivotRadius < bars.length; index++) {
    if (atr[index] <= 0) continue;
    const bar = bars[index];
    const left = bars.slice(index - rules.pivotRadius, index);
    const right = bars.slice(index + 1, index + rules.pivotRadius + 1);
    // Strict comparison on the left counts a flat-topped run only once.
    const roles: ZoneRole[] = [];
    if (left.every((other) => bar.high > other.high) && right.every((other) => bar.high >= other.high)) roles.push("resistance");
    if (left.every((other) => bar.low < other.low) && right.every((other) => bar.low <= other.low)) roles.push("support");

    for (const role of roles) {
      const price = role === "resistance" ? bar.high : bar.low;
      const direction = role === "resistance" ? -1 : 1;
      const before = bars.slice(Math.max(0, index - rules.reactionBars), index);
      const approach = Math.max(...before.map((other) => direction * (other.close - price))) / atr[index];
      let reaction = 0;
      // Only observed bars are available here. Stop measuring on adverse acceptance.
      for (let next = index + 1; next < Math.min(bars.length, index + rules.reactionBars + 1); next++) {
        const distance = direction * (bars[next].close - price) / atr[index];
        if (distance < -rules.breakBufferAtr) break;
        reaction = Math.max(reaction, distance);
      }
      if (approach < 0.8 || reaction < 0.8) continue;
      const baseline = bars.slice(Math.max(0, index - rules.volumePeriod), index)
        .map((other) => other.volume).filter((value): value is number => positiveVolume(value));
      const relativeVolume = positiveVolume(bar.volume) && baseline.length >= 10
        ? bar.volume! / median(baseline)
        : null;
      result.push({ index, price, role, atr: atr[index], approach, reaction, relativeVolume });
    }
  }
  return result;
}

function evaluateCluster(
  cluster: Pivot[], bars: NormalizedCandle[], currentAtr: number
): SupportResistanceZone | null {
  const rules = SUPPORT_RESISTANCE_RULES;
  const role = cluster[0].role;
  const lower = Math.min(...cluster.map((pivot) => pivot.price)) - rules.paddingAtr * currentAtr;
  const upper = Math.max(...cluster.map((pivot) => pivot.price)) + rules.paddingAtr * currentAtr;
  const ordered = [...cluster].sort((a, b) => a.index - b.index);

  const independent: Pivot[] = [];
  for (const pivot of ordered) {
    const previous = independent[independent.length - 1];
    if (previous) {
      if (pivot.index - previous.index < rules.reactionBars) continue;
      const departed = bars.slice(previous.index + 1, pivot.index).some((bar) =>
        role === "resistance"
          ? bar.close < lower - 0.75 * Math.min(previous.atr, pivot.atr)
          : bar.close > upper + 0.75 * Math.min(previous.atr, pivot.atr)
      );
      if (!departed) continue;
    }
    independent.push(pivot);
  }
  if (!independent.length) return null;
  const last = independent[independent.length - 1];
  const exceptionalSingle = independent.length === 1 && last.reaction >= 2.5 &&
    last.approach >= 2 && (last.relativeVolume ?? 0) >= 1.8;
  if (independent.length < 2 && !exceptionalSingle) return null;

  const reactions = independent.map((pivot) => pivot.reaction);
  const reactionAtr = median(reactions);
  if (reactionAtr < 1) return null;
  const knownVolumes = independent.map((pivot) => pivot.relativeVolume)
    .filter((value): value is number => value != null);
  const relativeVolume = knownVolumes.length ? median(knownVolumes) : null;
  // Missing volume contributes zero bonus; raw volume levels never compare instruments.
  const volumeBonus = mean(independent.map((pivot) => Math.min(2, Math.max(0, (pivot.relativeVolume ?? 1) - 1)))) * 6;
  const age = bars.length - 1 - last.index;
  const weakerReaction = independent.length > 1 && last.reaction < 0.6 * median(reactions.slice(0, -1));
  let crossings = 0;
  let lastSide = 0;
  for (const bar of bars.slice(Math.max(independent[0].index, bars.length - 40))) {
    const side = bar.close > upper ? 1 : bar.close < lower ? -1 : 0;
    if (side && lastSide && side !== lastSide) crossings++;
    if (side) lastSide = side;
  }
  const score = Math.round(Math.max(0, Math.min(100,
    20 + Math.min(3, independent.length) * 10 + Math.min(3, reactionAtr) * 8 +
    volumeBonus + 14 * Math.pow(0.5, age / 240) - (weakerReaction ? 8 : 0) - Math.min(3, crossings) * 6
  )));
  if (score < rules.minScore) return null;

  const price = bars[bars.length - 1].close;
  const distanceAtr = Math.max(lower - price, price - upper, 0) / currentAtr;
  const inside = price >= lower && price <= upper;
  const wrongSide = role === "resistance" ? price > upper : price < lower;
  const reasons = [
    exceptionalSingle ? "单次显著放量转折" : `${independent.length} 次独立测试`,
    `历史反应中位数 ${reactionAtr.toFixed(1)} ATR`,
    relativeVolume == null ? "量能不足，依据价格结构" : `转折相对量 ${relativeVolume.toFixed(2)} 倍`,
    `形成评分时，最近测试距识别末端 ${age} 根 K 线`,
  ];
  if (weakerReaction) reasons.push("最近反应减弱，已扣分");
  if (crossings) reasons.push("近期穿越区域，已扣分");
  return {
    id: `${role}-${bars[independent[0].index].time}-${lower.toPrecision(8)}-${bars[bars.length - 1].time}`,
    label: "", role, originRole: role, lower, upper, score,
    startTime: bars[independent[0].index].time,
    lastTestTime: bars[last.index].time,
    evidenceFrom: bars[0].time,
    // Reaction evidence can use up to eight bars after the latest pivot.
    formedAt: bars[Math.min(bars.length - 1, last.index + rules.reactionBars)].time,
    detectedAt: bars[bars.length - 1].time,
    formationAtr: currentAtr,
    tests: independent.length, reactionAtr, relativeVolume, distanceAtr,
    status: inside ? "testing" : wrongSide ? "piercing" : "untested",
    statusReason: "价格结构成立，等待后续测试。",
    invalidatedAt: null,
    reasons,
  };
}

export function detectSupportResistance(
  candles: NormalizedCandle[], visibleCount: number, visibleRange: SupportResistanceRange | null,
  previous: SupportResistanceSnapshot | null = null,
  mode: "viewport" | "automatic" = "viewport",
): SupportResistanceSnapshot {
  const rules = SUPPORT_RESISTANCE_RULES;
  const end = Number.isFinite(visibleCount) ? Math.min(candles.length, Math.max(0, Math.floor(visibleCount))) : 0;
  // Match automatic pens' visible-time filtering, while retaining normalized volume.
  // Neither off-screen bars nor unrevealed replay bars contribute to any calculation.
  const bars = visibleRange && Number.isFinite(visibleRange.from) && Number.isFinite(visibleRange.to)
    ? candles.slice(0, end).filter((bar) => bar.time >= visibleRange.from && bar.time <= visibleRange.to)
    : [];
  const snapshot: SupportResistanceSnapshot = {
    version: rules.version,
    mode,
    asOf: bars[bars.length - 1]?.time ?? null,
    evaluatedAt: bars[bars.length - 1]?.time ?? null,
    rangeStart: bars[0]?.time ?? null,
    barsAnalyzed: bars.length,
    referencePrice: bars[bars.length - 1]?.close ?? null,
    atr: 0,
    volumeCoverage: bars.length ? bars.filter((bar) => positiveVolume(bar.volume)).length / bars.length : 0,
    zones: [],
    trackedZones: [],
    candidateZones: [],
    retiredZones: [],
    message: "",
  };
  const tracked = previous
    ? updateSupportResistanceSnapshot(previous, candles, visibleCount, snapshot.asOf)
    : snapshot;
  snapshot.trackedZones = tracked.trackedZones;
  snapshot.zones = tracked.zones;
  snapshot.retiredZones = tracked.retiredZones;
  snapshot.candidateZones = mode === "automatic" ? tracked.candidateZones : [];
  if (bars.length < rules.minBars) {
    snapshot.message = `${mode === "automatic" ? "分析历史" : "可视区域"}内只有 ${bars.length} 根已揭示 K 线，转折确认至少需要 ${rules.minBars} 根。`;
    return snapshot;
  }
  const atr = calculateAtr(bars);
  const currentAtr = atr[atr.length - 1];
  snapshot.atr = currentAtr;
  if (!Number.isFinite(currentAtr) || currentAtr <= 0) {
    snapshot.message = "当前波动不足，无法识别可靠区间。";
    return snapshot;
  }

  // Retired evidence cannot be resurrected by pressing the button again.
  // Fresh pivots after invalidation may establish a new structure at the same price.
  const pivots = findPivots(bars, atr).filter((pivot) => !snapshot.retiredZones.some((zone) =>
    bars[pivot.index].time <= zone.invalidatedAt! &&
    pivot.price >= zone.lower - 0.3 * zone.formationAtr && pivot.price <= zone.upper + 0.3 * zone.formationAtr
  ));
  const candidates: SupportResistanceZone[] = [];
  for (const role of ["support", "resistance"] as const) {
    const sorted = pivots.filter((pivot) => pivot.role === role).sort((a, b) => a.price - b.price);
    const clusters: Pivot[][] = [];
    for (const pivot of sorted) {
      const last = clusters[clusters.length - 1];
      // Bound the full cluster span; avoid chained merges producing enormous zones.
      if (last && pivot.price - last[0].price <= rules.clusterSpanAtr * currentAtr) last.push(pivot);
      else clusters.push([pivot]);
    }
    for (const cluster of clusters) {
      const zone = evaluateCluster(cluster, bars, currentAtr);
      if (zone) candidates.push(evaluateZoneLifecycle(zone, bars));
    }
  }

  if (mode === "automatic") {
    // Keep qualified historical candidates, including those not selected to draw.
    // A new price position can make an existing candidate the next nearby level.
    const pool = [...snapshot.candidateZones];
    for (const zone of snapshot.trackedZones) {
      if (!pool.some((other) => other.id === zone.id)) pool.push(zone);
    }
    candidates.sort((a, b) => b.score - a.score);
    for (const zone of candidates) {
      if (zone.status === "invalidated") continue;
      if (pool.some((other) => other.status !== "invalidated" && zone.lower <= other.upper && zone.upper >= other.lower)) continue;
      pool.push(zone);
    }
    snapshot.candidateZones = pool;
    const price = snapshot.referencePrice!;
    const available = pool.filter((zone) => zone.status !== "invalidated" && zone.detectedAt <= snapshot.asOf!);
    const nearby = (zones: SupportResistanceZone[], limit: number) => zones
      .sort((a, b) => a.distanceAtr - b.distanceAtr || b.score - a.score).slice(0, limit);
    const selected = [
      ...nearby(available.filter((zone) => zone.role === "support" && zone.lower <= price), rules.maxPerSide),
      ...nearby(available.filter((zone) => zone.role === "resistance" && zone.upper >= price), rules.maxPerSide),
    ];
    for (const zone of selected) {
      if (snapshot.zones.some((other) => zone.lower <= other.upper && zone.upper >= other.lower)) continue;
      snapshot.zones.push(zone);
      if (!snapshot.trackedZones.some((other) => other.id === zone.id)) snapshot.trackedZones.push(zone);
    }
    labelZones(snapshot.zones);
    if (!snapshot.zones.length) snapshot.message = "当前已分析历史中暂无证据足够的区域，继续跟踪后续结构。";
    return snapshot;
  }

  // Limits rank NEW formations only. Existing valid zones never compete for slots.
  const counts = {
    support: snapshot.zones.filter((zone) => zone.role === "support").length,
    resistance: snapshot.zones.filter((zone) => zone.role === "resistance").length,
  };
  candidates.sort((a, b) => b.score - a.score || a.lower - b.lower);
  for (const zone of candidates) {
    if (zone.status === "invalidated") continue;
    const bucket = zone.role;
    if (counts[bucket] >= rules.maxPerSide) continue;
    if (snapshot.zones.some((other) => zone.lower <= other.upper && zone.upper >= other.lower)) continue;
    counts[bucket]++;
    snapshot.zones.push(zone);
    snapshot.trackedZones.push(zone);
  }
  labelZones(snapshot.zones);
  if (!snapshot.zones.length) snapshot.message = "当前可视区域内没有证据足够的支撑/阻力区，可调整视野或在后续走势形成后重新识别。";
  return snapshot;
}

/** Automatic discovery uses the revealed replay cursor, never the screen viewport. */
export function detectAutomaticSupportResistance(
  candles: NormalizedCandle[], visibleCount: number, previous: SupportResistanceSnapshot | null = null,
) {
  const end = Number.isFinite(visibleCount) ? Math.max(0, Math.min(candles.length, Math.floor(visibleCount))) : 0;
  const range = end ? { from: candles[0].time, to: candles[end - 1].time } : null;
  return detectSupportResistance(candles, end, range, previous, "automatic");
}

export function needsMoreSupportResistanceHistory(snapshot: SupportResistanceSnapshot, minimumBars = 5000) {
  if (snapshot.barsAnalyzed < minimumBars) return true;
  const price = snapshot.referencePrice;
  if (price == null) return true;
  const candidates = snapshot.candidateZones.filter((zone) => zone.status !== "invalidated");
  return !candidates.some((zone) => zone.role === "support" && zone.lower <= price) ||
    !candidates.some((zone) => zone.role === "resistance" && zone.upper >= price);
}

function labelZones(zones: SupportResistanceZone[]) {
  zones.sort((a, b) => a.lower - b.lower);
  for (const role of ["support", "resistance"] as const) {
    zones.filter((zone) => zone.role === role)
      .sort((a, b) => b.score - a.score || a.lower - b.lower)
      .forEach((zone, index) => { zone.label = `${role === "support" ? "S" : "R"}${index + 1}`; });
  }
}

function erodedStructure(bars: NormalizedCandle[], zone: SupportResistanceZone) {
  const rules = SUPPORT_RESISTANCE_RULES;
  if (bars.length < rules.erosionMinBars) return false;
  const distances = bars.map((bar) => Math.max(zone.lower - bar.close, bar.close - zone.upper, 0) / zone.formationAtr);
  // Oscillation at an edge or a strong departure is not evidence of erosion.
  if (Math.max(...distances) > rules.erosionMaxDistanceAtr ||
      distances.filter((distance) => distance <= 1).length / bars.length < rules.erosionNearFraction) return false;
  let acceptedSide = 0;
  let previousSide = 0;
  let run = 0;
  let crossings = 0;
  for (const bar of bars) {
    const buffer = rules.breakBufferAtr * zone.formationAtr;
    const side = bar.close > zone.upper + buffer ? 1 : bar.close < zone.lower - buffer ? -1 : 0;
    run = side && side === previousSide ? run + 1 : side ? 1 : 0;
    previousSide = side;
    if (run >= rules.erosionSideBars && side !== acceptedSide) {
      if (acceptedSide) crossings++;
      acceptedSide = side;
    }
  }
  return crossings >= rules.erosionCrossings;
}

/** Replays the lifecycle from fixed formation evidence, using only supplied observations. */
export function evaluateZoneLifecycle(seed: SupportResistanceZone, observed: NormalizedCandle[]): SupportResistanceZone {
  const rules = SUPPORT_RESISTANCE_RULES;
  const bars = observed.filter((bar) => bar.time >= seed.evidenceFrom);
  const zone = { ...seed, role: seed.originRole, status: "untested" as ZoneStatus, invalidatedAt: null as number | null };
  const atr = calculateAtr(bars);
  const first = bars.findIndex((bar) => bar.time > seed.formedAt);
  let event: { atr: number; volumes: (number | null)[] } | null = null;
  let recovered = false;
  zone.statusReason = "形成证据保留；尚无结构失效信号。";
  for (let index = first < 0 ? bars.length : first; index < bars.length; index++) {
    const bar = bars[index];
    const direction = zone.role === "resistance" ? 1 : -1;
    const breakEdge = zone.role === "resistance" ? zone.upper : zone.lower;
    const excess = direction * (bar.close - breakEdge);
    const inside = bar.close >= zone.lower && bar.close <= zone.upper;
    if (!event && excess > 0) {
      // Freeze the pre-break volatility for this attempt. The breakout candle
      // cannot enlarge its own threshold or move the rectangle's price edges.
      event = { atr: Math.max(seed.formationAtr, atr[index - 1] || seed.formationAtr), volumes: [] };
    }
    if (event) {
      const buffer = rules.breakBufferAtr * event.atr;
      const baseline = bars.slice(Math.max(0, index - rules.volumePeriod), index)
        .map((other) => other.volume).filter((value): value is number => positiveVolume(value));
      const relative = positiveVolume(bar.volume) && baseline.length >= 10 ? bar.volume! / median(baseline) : null;
      event.volumes = excess > buffer ? [...event.volumes, relative].slice(-rules.acceptanceBars) : [];
      const recentVolume = event.volumes.slice(-rules.volumeAcceptanceBars);
      const volumeConfirmed = recentVolume.length === rules.volumeAcceptanceBars &&
        recentVolume.every((value) => value != null) && median(recentVolume as number[]) >= rules.breakoutVolume;
      if (excess >= rules.acceptanceDistanceAtr * event.atr &&
          (volumeConfirmed || event.volumes.length >= rules.acceptanceBars)) {
        zone.status = "invalidated";
        zone.invalidatedAt = bar.time;
        zone.statusReason = `确认突破：${event.volumes.length} 根连续收盘越过 0.25 ATR 缓冲带${volumeConfirmed ? "，量能确认" : ""}，最新收盘离开至少 0.75 ATR；区间生命周期结束。`;
        break;
      } else if (excess <= 0) {
        event = null;
        recovered = true;
        zone.status = inside ? "testing" : "false_break";
        zone.statusReason = "越界未获持续接受，价格已收回；原区域继续观察。";
      } else {
        zone.status = "piercing";
        zone.statusReason = `越界观察中：${event.volumes.length} 根连续收盘超过 0.25 ATR 缓冲，尚未满足持续性、距离和量能条件。`;
      }
    } else {
      zone.status = inside ? "testing" : recovered ? "false_break" : "untested";
    }
    const recent = bars.slice(Math.max(first, index - rules.erosionWindow + 1), index + 1);
    if (erodedStructure(recent, zone)) {
      zone.status = "invalidated";
      zone.invalidatedAt = bar.time;
      zone.statusReason = `结构消耗：最近 ${recent.length} 根内至少 3 次双向完整穿越（每侧连续两根确认），至少 70% 收盘停留在区域附近，且未出现超过 1.5 ATR 的离开反应。`;
      break;
    }
  }
  const price = bars[bars.length - 1]?.close;
  if (price != null) {
    zone.distanceAtr = Math.max(zone.lower - price, price - zone.upper, 0) / (atr[atr.length - 1] || seed.formationAtr);
    if (first < 0 && price >= zone.lower && price <= zone.upper) zone.status = "testing";
  }
  return zone;
}

/** Advances existing zones only; formation and ranking never delete a tracked zone. */
export function updateSupportResistanceSnapshot(
  previous: SupportResistanceSnapshot, candles: NormalizedCandle[], visibleCount: number, horizon: number | null,
): SupportResistanceSnapshot {
  const end = Number.isFinite(visibleCount) ? Math.max(0, Math.min(candles.length, Math.floor(visibleCount))) : 0;
  const observed = horizon != null && Number.isFinite(horizon) ? candles.slice(0, end).filter((bar) => bar.time <= horizon) : [];
  const evaluatedAt = observed[observed.length - 1]?.time ?? null;
  const seeds = previous.mode === "automatic" ? previous.candidateZones : previous.trackedZones;
  const evaluated = seeds.map((zone) =>
    evaluatedAt != null && zone.detectedAt <= evaluatedAt ? evaluateZoneLifecycle(zone, observed) : { ...zone }
  );
  // When looking back in time, hide zones whose evidence had not been observed yet.
  const evaluatedById = new Map(evaluated.map((zone) => [zone.id, zone]));
  // Preserve discovery order even when the automatic candidate pool has a different order.
  const trackedZones = previous.trackedZones.map((zone) => evaluatedById.get(zone.id) ?? { ...zone });
  const known = trackedZones.filter((zone) => evaluatedAt != null && zone.detectedAt <= evaluatedAt);
  const zones: SupportResistanceZone[] = [];
  for (const zone of known.filter((item) => item.status !== "invalidated").sort((a, b) => a.detectedAt - b.detectedAt)) {
    // A historical re-analysis can discover an earlier version of a later zone.
    // Keep the first observed version when both become visible again.
    if (!zones.some((other) => zone.lower <= other.upper && zone.upper >= other.lower)) zones.push(zone);
  }
  labelZones(zones);
  return { ...previous, evaluatedAt, referencePrice: observed[observed.length - 1]?.close ?? null,
    trackedZones, zones, candidateZones: previous.mode === "automatic" ? evaluated : previous.candidateZones,
    retiredZones: evaluated.filter((zone) => evaluatedAt != null && zone.detectedAt <= evaluatedAt && zone.status === "invalidated"),
    message: zones.length ? "" : known.length ? "已跟踪区域均已失效，可展开失效记录查看原因；继续跟踪后续新结构。" : previous.message };
}
