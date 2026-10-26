/**
 * Helpers for the toolbar "locate" popover. Chart times are UTC unix seconds,
 * and the chart's time axis is shown in UTC, so dates and times of day here
 * are UTC as well.
 */
type TimedCandle = { time: number };

const DAY_SECONDS = 86400;

/**
 * Distinct times of day (minutes after 00:00) of the loaded bars, sorted.
 * Built from real bars, so H8 offers 00:00 / 08:00 / 16:00 and a feed with
 * other session anchors offers exactly those anchors.
 */
export function barMinutesOfDay(data: readonly TimedCandle[], count = data.length) {
  const minutes = new Set<number>();
  const end = Math.min(count, data.length);
  for (let index = 0; index < end; index++) {
    minutes.add(Math.floor((((data[index].time % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / 60));
  }
  return [...minutes].sort((a, b) => a - b);
}

/** Hours that have at least one bar, and the bar minutes within each hour. */
export function groupMinutesByHour(minutesOfDay: readonly number[]) {
  const byHour = new Map<number, number[]>();
  for (const value of minutesOfDay) {
    const hour = Math.floor(value / 60);
    const list = byHour.get(hour) ?? [];
    list.push(value % 60);
    byHour.set(hour, list);
  }
  return byHour;
}

/** Index of the bar closest in time to `target` within data[0, count). */
export function nearestCandleIndex(data: readonly TimedCandle[], count: number, target: number) {
  const end = Math.min(count, data.length);
  if (end <= 0) return -1;
  let lo = 0;
  let hi = end - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (data[mid].time < target) lo = mid + 1;
    else hi = mid;
  }
  // lo is the first bar at or after target (or the last bar).
  if (lo > 0 && Math.abs(data[lo - 1].time - target) <= Math.abs(data[lo].time - target)) return lo - 1;
  return lo;
}

export const toUtcDateInput = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

/** `YYYY-MM-DD` (from a date input) plus minutes after midnight, as UTC unix seconds. */
export function utcDateTimeToUnix(date: string, minutesOfDay = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 1000 + minutesOfDay * 60;
}

export const minutesOfDayOf = (unix: number) =>
  Math.floor((((unix % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / 60);

export const pad2 = (value: number) => String(value).padStart(2, "0");
