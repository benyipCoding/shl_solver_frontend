import { detectAutomaticSupportResistance, type SupportResistanceSnapshot } from "./support-resistance";
import type { NormalizedCandle } from "./market-data";

// Analysis stays off the UI thread; history can be much wider than the chart viewport.
self.onmessage = (event: MessageEvent<{ candles: NormalizedCandle[]; previous: SupportResistanceSnapshot | null }>) => {
  try {
    const { candles, previous } = event.data;
    self.postMessage({ snapshot: detectAutomaticSupportResistance(candles, candles.length, previous) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "自动分析失败" });
  }
};
