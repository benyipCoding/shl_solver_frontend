type Bar = { time: number };

const DAY = 86400;
const nyHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23",
});

/** Exclusive end of a completed FXCM bar. A weekend/data gap is not part
 * of the preceding bar; only use the next open to shorten a bucket or
 * identify the actual adjacent daily/weekly session boundary. */
export function backtestBarEnd(open: number, seconds: number, nextOpen?: number) {
  let end = open + seconds;
  if (seconds === DAY || seconds === 7 * DAY) {
    if (nextOpen != null && Math.abs(nextOpen - end) <= 3600) return nextOpen;
    // At a page edge there may be no adjacent bar. FXCM's NY 17:00
    // calendar anchors retain their local hour across a DST transition.
    if (Number(nyHour.format(open * 1000)) === 17) {
      end += (17 - Number(nyHour.format(end * 1000))) * 3600;
    }
  }
  return nextOpen == null ? end : Math.min(end, nextOpen);
}

/** Count bars whose open is strictly before the completed source boundary.
 * This reveals the last constituent bar when zooming in, and the whole
 * containing bar when zooming out (also for non-nested hours like H3/H4). */
export function backtestCountBefore(bars: readonly Bar[], end: number) {
  let lo = 0, hi = bars.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (bars[mid].time < end) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function backtestSwitchCount(bars: readonly Bar[], seconds: number, cursor: { cursorOpen: number; cursorEnd: number }) {
  const count = backtestCountBefore(bars, cursor.cursorEnd);
  const last = bars[count - 1];
  if (!last || backtestBarEnd(last.time, seconds, bars[count]?.time) <= cursor.cursorOpen) {
    throw new Error("目标周期没有覆盖当前回测进度的 K 线");
  }
  return count;
}
