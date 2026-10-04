import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ISeriesApi, Time } from "lightweight-charts";
import type { NormalizedCandle } from "@/components/market-master/market-data";
import type { SupportResistanceSnapshot } from "@/components/market-master/support-resistance";
import { SupportResistancePrimitive } from "@/components/market-master/support-resistance-primitive";
import { SupportResistanceAutoTracker, type SupportResistanceHistoryPage, type SupportResistanceHistoryState } from "@/components/market-master/support-resistance-auto";

export function useSupportResistanceZones({ seriesRef, loadHistoryBeforeRef }: {
  seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
  loadHistoryBeforeRef: RefObject<(before: number, signal: AbortSignal) => Promise<SupportResistanceHistoryPage>>;
}) {
  const primitiveRef = useRef<SupportResistancePrimitive | null>(null);
  const snapshotRef = useRef<SupportResistanceSnapshot | null>(null);
  const cursorTimeRef = useRef<number | null>(null);
  const trackerRef = useRef<SupportResistanceAutoTracker | null>(null);
  const historyCacheRef = useRef<SupportResistanceHistoryPage | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerTaskRef = useRef<{ resolve: (snapshot: SupportResistanceSnapshot) => void; reject: (error: Error) => void } | null>(null);
  const enabledRef = useRef(false);
  const [isSupportResistanceEnabled, setEnabled] = useState(false);
  const [isSupportResistanceAutomatic, setAutomatic] = useState(false);
  const [isSupportResistanceBusy, setBusy] = useState(false);
  const [supportResistanceHistory, setHistory] = useState<SupportResistanceHistoryState>({ loading: false, hasMore: true, error: null });
  const [supportResistanceSnapshot, setSnapshot] = useState<SupportResistanceSnapshot | null>(null);
  const stopAutomaticSupportResistance = useCallback(() => {
    if (trackerRef.current) historyCacheRef.current = trackerRef.current.getHistoryContext();
    trackerRef.current?.stop();
    trackerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    workerTaskRef.current?.reject(new Error("自动跟踪已停止"));
    workerTaskRef.current = null;
    setAutomatic(false);
    setBusy(false);
    setHistory((previous) => ({ ...previous, loading: false }));
  }, []);

  useEffect(() => stopAutomaticSupportResistance, [stopAutomaticSupportResistance]);

  const clearSupportResistance = useCallback(() => {
    stopAutomaticSupportResistance();
    if (primitiveRef.current) seriesRef.current?.detachPrimitive(primitiveRef.current);
    primitiveRef.current = null;
    snapshotRef.current = null;
    historyCacheRef.current = null;
    cursorTimeRef.current = null;
    setSnapshot(null);
    setHistory({ loading: false, hasMore: true, error: null });
  }, [seriesRef, stopAutomaticSupportResistance]);

  const publishSnapshot = useCallback((snapshot: SupportResistanceSnapshot) => {
    if (!enabledRef.current) return snapshot;
    snapshotRef.current = snapshot;
    if (primitiveRef.current) primitiveRef.current.setZones(snapshot.zones);
    else if (seriesRef.current && snapshot.zones.length) {
      const primitive = new SupportResistancePrimitive(snapshot.zones);
      seriesRef.current.attachPrimitive(primitive);
      primitiveRef.current = primitive;
    }
    setSnapshot(snapshot);
    return snapshot;
  }, [seriesRef]);

  const startAutomaticSupportResistance = useCallback((candles: NormalizedCandle[], visibleCount: number, hasMoreHistory: boolean) => {
    stopAutomaticSupportResistance();
    try {
      const worker = new Worker(new URL("../components/market-master/support-resistance.worker.ts", import.meta.url));
      workerRef.current = worker;
      let workerError: Error | null = null;
      worker.onmessage = (event: MessageEvent<{ snapshot?: SupportResistanceSnapshot; error?: string }>) => {
        if (workerRef.current !== worker) return;
        const task = workerTaskRef.current;
        workerTaskRef.current = null;
        setBusy(false);
        if (event.data.snapshot) task?.resolve(event.data.snapshot);
        else task?.reject(new Error(event.data.error || "自动分析失败"));
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        workerError = new Error("自动分析加载失败，请关闭后重新开启顶部支撑/阻力按钮");
        workerTaskRef.current?.reject(workerError);
        workerTaskRef.current = null;
        setBusy(false);
      };
      const tracker = new SupportResistanceAutoTracker({
        initialSnapshot: snapshotRef.current,
        initialHistory: historyCacheRef.current,
        analyze: (bars, previous) => new Promise((resolve, reject) => {
          if (workerError) { reject(workerError); return; }
          setBusy(true);
          workerTaskRef.current = { resolve, reject };
          try {
            worker.postMessage({ candles: bars, previous });
          } catch (error) {
            workerTaskRef.current = null;
            setBusy(false);
            reject(error);
          }
        }),
        loadBefore: (before, signal) => loadHistoryBeforeRef.current(before, signal),
        onUpdate: (snapshot, history) => {
          setHistory(history);
          if (snapshot) publishSnapshot(snapshot);
        },
      });
      trackerRef.current = tracker;
      cursorTimeRef.current = candles[visibleCount - 1]?.time ?? null;
      setHistory({ loading: false, hasMore: hasMoreHistory, error: null });
      setAutomatic(true);
      tracker.refresh(candles, visibleCount, hasMoreHistory);
    } catch (error) {
      stopAutomaticSupportResistance();
      setHistory({ loading: false, hasMore: hasMoreHistory, error: error instanceof Error ? error.message : "无法启动自动分析" });
    }
  }, [loadHistoryBeforeRef, publishSnapshot, stopAutomaticSupportResistance]);

  const retrySupportResistanceHistory = useCallback(() => trackerRef.current?.retryHistory(), []);

  const toggleSupportResistance = useCallback((candles: NormalizedCandle[], visibleCount: number, hasMoreHistory: boolean) => {
    const enabled = !enabledRef.current;
    enabledRef.current = enabled;
    setEnabled(enabled);
    if (enabled) startAutomaticSupportResistance(candles, visibleCount, hasMoreHistory);
    else clearSupportResistance();
  }, [clearSupportResistance, startAutomaticSupportResistance]);

  const updateSupportResistance = useCallback((candles: NormalizedCandle[], visibleCount: number, hasMoreHistory: boolean) => {
    if (!enabledRef.current) return;
    const cursor = candles[visibleCount - 1]?.time ?? null;
    if (cursor == null) {
      clearSupportResistance();
      return;
    }
    if (cursorTimeRef.current != null && cursor < cursorTimeRef.current) clearSupportResistance();
    cursorTimeRef.current = cursor;
    if (trackerRef.current) {
      trackerRef.current.refresh(candles, visibleCount, hasMoreHistory);
    } else {
      // Only an activated overlay restarts after a market change or replay rewind.
      startAutomaticSupportResistance(candles, visibleCount, hasMoreHistory);
    }
  }, [clearSupportResistance, startAutomaticSupportResistance]);

  return {
    supportResistanceSnapshot, updateSupportResistance, clearSupportResistance,
    isSupportResistanceEnabled, toggleSupportResistance,
    isSupportResistanceAutomatic, isSupportResistanceBusy, supportResistanceHistory,
    retrySupportResistanceHistory,
  };
}
