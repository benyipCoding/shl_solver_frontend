export type AutomaticRunProgress = { processed: number; target: number; phase: "running" | "loading" | "saving" };

/** Execute the same single-candle callback in short, cancellable time slices. */
export async function runAutomaticTradingBatch(options: {
  limit: number;
  cursor: () => number;
  available: () => number;
  total: () => number;
  advance: () => void;
  loadMore: () => Promise<void>;
  cancelled: () => boolean;
  progress: (progress: AutomaticRunProgress) => void;
  yieldToBrowser?: () => Promise<void>;
  now?: () => number;
  checkpoint?: () => Promise<void>;
}) {
  const yieldToBrowser = options.yieldToBrowser ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const now = options.now ?? (() => performance.now());
  const start = options.cursor();
  // Freeze the right edge of this run: newly arriving market data is not an
  // invitation to run forever, and preloaded future bars are never warmup.
  const target = Math.max(0, Math.min(options.limit, options.total() - start));
  let processed = 0;
  let lastReport = -Infinity;
  let lastPhase: AutomaticRunProgress["phase"] | null = null;
  const report = (phase: AutomaticRunProgress["phase"], force = false) => {
    const time = now();
    if (!force && phase === lastPhase && time - lastReport < 50) return;
    lastPhase = phase; lastReport = time;
    options.progress({ processed, target, phase });
  };
  report("running");
  await yieldToBrowser();
  while (processed < target && !options.cancelled()) {
    if (options.cursor() >= options.available()) {
      report("loading");
      const before = options.available();
      await options.loadMore();
      if (options.cancelled()) break;
      if (options.available() <= before) throw new Error("后续 K 线未能加载，已保留当前结果，可重试继续运行");
    }
    const sliceStart = now();
    let slice = 0;
    while (processed < target && options.cursor() < options.available() && !options.cancelled()) {
      const before = options.cursor();
      options.advance();
      if (options.cursor() !== before + 1) throw new Error("K 线推进中断，已保留当前结果");
      processed++;
      if (++slice >= 250 || now() - sliceStart >= 8) break;
    }
    report("running");
    await options.checkpoint?.();
    await yieldToBrowser();
  }
  report("running", true);
  return { processed, target, cancelled: options.cancelled() };
}
