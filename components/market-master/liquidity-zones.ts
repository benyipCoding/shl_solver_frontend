import type { Time } from "lightweight-charts";

export type LiquiditySide = "above" | "below";

export type LiquidityZone = {
  id: string;
  time: Time;
  price: number;
  side: LiquiditySide;
  score: number;
  touches: number;
};

export type LiquidityConfig = {
  enabled: boolean;
  lookback: number;
  swingStrength: number;
  equalToleranceAtr: number;
  minScore: number;
  maxZones: number;
  aboveColor: string;
  belowColor: string;
};

const timeValue = (time: Time) => {
  if (typeof time === "number") return time;
  if (typeof time === "string") return Date.parse(time);
  return Date.UTC(time.year, time.month - 1, time.day);
};

export function calculateLiquidityZones(data: any[], config: LiquidityConfig): LiquidityZone[] {
  if (!config.enabled || data.length < config.swingStrength * 2 + 3) return [];
  const candles = data
    .filter((c) => Number.isFinite(Number(c.high)) && Number.isFinite(Number(c.low)))
    .slice(-Math.max(30, config.lookback));
  const strength = Math.max(1, Math.floor(config.swingStrength));
  if (candles.length < strength * 2 + 3) return [];

  const ranges = candles.map((c, index) => {
    const previous = candles[index - 1];
    return previous
      ? Math.max(c.high - c.low, Math.abs(c.high - previous.close), Math.abs(c.low - previous.close))
      : c.high - c.low;
  });
  const atrPeriod = Math.min(14, Math.max(5, Math.floor(candles.length / 8)));
  const atr = ranges.slice(-atrPeriod).reduce((sum, value) => sum + value, 0) / atrPeriod || 1;
  const tolerance = atr * Math.max(0.03, config.equalToleranceAtr);
  const pivots: Array<{ time: Time; price: number; side: LiquiditySide }> = [];

  for (let index = strength; index < candles.length - strength; index += 1) {
    const candle = candles[index];
    const left = candles.slice(index - strength, index);
    const right = candles.slice(index + 1, index + strength + 1);
    if (left.every((item) => candle.high >= item.high) && right.every((item) => candle.high >= item.high)) {
      pivots.push({ time: candle.time, price: candle.high, side: "above" });
    }
    if (left.every((item) => candle.low <= item.low) && right.every((item) => candle.low <= item.low)) {
      pivots.push({ time: candle.time, price: candle.low, side: "below" });
    }
  }

  const zones: LiquidityZone[] = [];
  for (const pivot of pivots) {
    const existing = zones.find((zone) => zone.side === pivot.side && Math.abs(zone.price - pivot.price) <= tolerance);
    if (existing) {
      existing.price = (existing.price * existing.touches + pivot.price) / (existing.touches + 1);
      existing.touches += 1;
      existing.score = Math.min(100, existing.score + 14);
      continue;
    }
    const pivotIndex = candles.findIndex((item) => item.time === pivot.time);
    const ageRatio = (candles.length - 1 - pivotIndex) / Math.max(1, candles.length);
    const roundNumberBonus = Math.abs((pivot.price / atr) - Math.round(pivot.price / atr)) < 0.04 ? 8 : 0;
    zones.push({
      id: `liquidity_${String(pivot.time)}_${pivot.side}_${pivot.price}`,
      time: pivot.time,
      price: pivot.price,
      side: pivot.side,
      score: Math.min(100, 38 + (1 - ageRatio) * 15 + roundNumberBonus),
      touches: 1,
    });
  }

  return zones
    .filter((zone) => zone.score >= config.minScore)
    .sort((a, b) => b.score - a.score || b.touches - a.touches)
    .slice(0, Math.max(1, config.maxZones));
}
