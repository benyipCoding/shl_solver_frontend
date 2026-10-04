import { mergeCandleData, type NormalizedCandle } from "./market-data";
import { needsMoreSupportResistanceHistory, type SupportResistanceSnapshot } from "./support-resistance";

export type SupportResistanceHistoryState = {
  loading: boolean;
  hasMore: boolean;
  error: string | null;
};
export type SupportResistanceHistoryPage = { candles: NormalizedCandle[]; hasMore: boolean };

/** Owns analysis history, never changes chart data, logical ranges or replay indexes. */
export class SupportResistanceAutoTracker {
  private active = true;
  private running = false;
  private pending = false;
  private revision = 0;
  private cursor: number | null = null;
  private history: NormalizedCandle[] = [];
  private snapshot: SupportResistanceSnapshot | null;
  private state: SupportResistanceHistoryState = { loading: false, hasMore: true, error: null };
  private abort = new AbortController();

  constructor(private options: {
    initialSnapshot: SupportResistanceSnapshot | null;
    initialHistory?: SupportResistanceHistoryPage | null;
    analyze: (bars: NormalizedCandle[], previous: SupportResistanceSnapshot | null) => Promise<SupportResistanceSnapshot>;
    loadBefore: (before: number, signal: AbortSignal) => Promise<SupportResistanceHistoryPage>;
    onUpdate: (snapshot: SupportResistanceSnapshot | null, state: SupportResistanceHistoryState) => void;
  }) {
    this.snapshot = options.initialSnapshot;
    this.history = options.initialHistory?.candles ?? [];
    this.state.hasMore = options.initialHistory?.hasMore ?? true;
  }

  getHistoryContext(): SupportResistanceHistoryPage {
    return { candles: this.history, hasMore: this.state.hasMore };
  }

  refresh(candles: NormalizedCandle[], visibleCount: number, hasMoreHistory: boolean) {
    if (!this.active) return;
    const end = Number.isFinite(visibleCount) ? Math.max(0, Math.min(candles.length, Math.floor(visibleCount))) : 0;
    const revealed = candles.slice(0, end);
    const cursor = revealed[revealed.length - 1]?.time;
    if (cursor == null) return;
    // Replay rewinds start a new session at the hook level; also defend this boundary here.
    if (this.cursor != null && cursor < this.cursor) { this.stop(); return; }
    const oldStart = this.history[0]?.time;
    if (oldStart == null || revealed[0].time < oldStart) this.state.hasMore = hasMoreHistory;
    this.cursor = cursor;
    this.history = mergeCandleData(revealed, this.history).filter((bar) => bar.time <= cursor);
    this.revision++;
    this.pending = true;
    void this.pump();
  }

  retryHistory() {
    if (!this.active) return;
    this.state.error = null;
    this.pending = true;
    void this.pump();
  }

  stop() {
    this.active = false;
    this.abort.abort();
    this.history = [];
    this.snapshot = null;
  }

  private publish() {
    if (this.active) this.options.onUpdate(this.snapshot, { ...this.state });
  }

  private async pump() {
    if (this.running || !this.active) return;
    this.running = true;
    try {
      while (this.active && this.pending) {
        this.pending = false;
        const revision = this.revision;
        try {
          const result = await this.options.analyze(this.history, this.snapshot);
          if (!this.active) return;
          this.snapshot = result;
        } catch (error) {
          if (!this.active) return;
          this.state.error = error instanceof Error ? error.message : "自动分析失败，请关闭后重新开启顶部支撑/阻力按钮";
          this.publish();
          return;
        }
        // Coalesce rapid playback updates; the newest revealed cursor wins.
        if (revision !== this.revision) continue;
        this.publish();
        if (!this.snapshot || !this.state.hasMore || this.state.error || !needsMoreSupportResistanceHistory(this.snapshot)) continue;

        const before = this.history[0]?.time;
        if (before == null) continue;
        this.state.loading = true;
        this.publish();
        try {
          const page = await this.options.loadBefore(before, this.abort.signal);
          if (!this.active) return;
          // Defend against inclusive boundaries, overlapping pages and unexpected future data.
          const older = page.candles.filter((bar) => bar.time < before && bar.time <= this.cursor!);
          if (!older.length && page.hasMore) throw new Error("历史接口未返回更早的 K 线，已保留当前分析结果，可重试补充历史。");
          if (older.length) {
            const first = Math.min(...older.map((bar) => bar.time));
            if (first <= this.history[0].time) this.state.hasMore = page.hasMore;
            this.history = mergeCandleData(this.history, older);
            this.pending = true;
          } else {
            this.state.hasMore = false;
          }
        } catch (error) {
          if (!this.active) return;
          this.state.error = error instanceof Error ? error.message : "补充历史失败，已保留当前分析结果";
        } finally {
          if (this.active) {
            this.state.loading = false;
            this.publish();
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
