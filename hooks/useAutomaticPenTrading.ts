import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CandlestickData, DataChangedScope, ISeriesApi, Time } from "lightweight-charts";
import { createAutomaticPenTradeTracker, type AutomaticTradingCandle } from "@/components/market-master/automatic-pen-trading";
import type { AutomaticPenMode } from "@/components/market-master/automatic-pens";

export function useAutomaticPenTrading({ seriesRef, canTrade, marketKey, viewportSyncRef, source }: {
  seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
  canTrade: boolean;
  marketKey: string;
  viewportSyncRef?: RefObject<boolean>;
  source?: () => { candles: readonly AutomaticTradingCandle[]; count: number };
}) {
  const [enabled, setEnabled] = useState(false);
  const modeRef = useRef<AutomaticPenMode>("simple");
  const sessionRef = useRef<{
    tracker: ReturnType<typeof createAutomaticPenTradeTracker>;
    key: string;
    entriesEnabled: boolean;
    cleanup: () => void;
    rebuild: () => void;
  } | null>(null);

  const stop = useCallback(() => {
    sessionRef.current?.cleanup();
    sessionRef.current = null;
    setEnabled(false);
  }, []);

  // Switching markets, exiting backtest, losing permission or entering recorded
  // replay always requires the user to explicitly enable trading again.
  useEffect(() => stop, [canTrade, marketKey, stop]);

  const toggle = useCallback((startTime?: Time | null, warmupStartTime?: Time | null) => {
    if (sessionRef.current) {
      if (!canTrade) return;
      sessionRef.current.entriesEnabled = !sessionRef.current.entriesEnabled;
      setEnabled(sessionRef.current.entriesEnabled);
      return;
    }
    const series = seriesRef.current;
    if (!canTrade || !series) return;
    let earliestWarmupTime = warmupStartTime;
    const readCandles = (from = startTime) => {
      const input = source?.();
      const bars = input ? input.candles.slice(0, input.count) : series.data();
      earliestWarmupTime ??= bars[0]?.time;
      const first = from == null ? 0 : bars.findIndex((bar) => bar.time >= from);
      const isCandle = (bar: AutomaticTradingCandle | { time: Time }): bar is CandlestickData<Time> => "open" in bar;
      return first < 0 ? { candles: [], atrWarmup: [] } : {
        candles: bars.slice(first).filter(isCandle),
        atrWarmup: bars.slice(Math.max(0, first - 101), first).filter(isCandle)
          .filter((bar) => earliestWarmupTime == null || bar.time >= earliestWarmupTime),
      };
    };
    const { candles, atrWarmup } = readCandles();
    if (!candles.length) return;
    const boundary = candles[0].time;
    const rebuild = () => {
      const session = sessionRef.current;
      if (!session) return;
      const next = readCandles(boundary);
      session.tracker = createAutomaticPenTradeTracker(next.candles, modeRef.current, next.atrWarmup);
    };
    const onDataChanged = (scope: DataChangedScope) => {
      if (scope !== "full" || !sessionRef.current || viewportSyncRef?.current) return;
      // History prepend/reload/rewind only rebuild context, never place orders.
      rebuild();
    };
    sessionRef.current = {
      tracker: createAutomaticPenTradeTracker(candles, modeRef.current, atrWarmup),
      key: marketKey,
      entriesEnabled: true,
      cleanup: () => series.unsubscribeDataChanged(onDataChanged),
      rebuild,
    };
    series.subscribeDataChanged(onDataChanged);
    setEnabled(true);
  }, [canTrade, marketKey, seriesRef, viewportSyncRef, source]);

  const setAutomaticTradingPenMode = useCallback((mode: AutomaticPenMode) => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    // Rebuild context without placing past orders; preserve the entry switch.
    sessionRef.current?.rebuild();
  }, []);

  const advance = useCallback((candle: AutomaticTradingCandle) => {
    const session = sessionRef.current;
    if (!canTrade || !session || session.key !== marketKey) return null;
    const event = session.tracker.advanceEvent(candle);
    // Turning entries off retains structural protection for existing positions.
    return event && !session.entriesEnabled ? { ...event, side: null } : event;
  }, [canTrade, marketKey]);

  return { isAutomaticTradingEnabled: enabled && canTrade, toggleAutomaticTrading: toggle, stopAutomaticTrading: stop, advanceAutomaticTrading: advance, setAutomaticTradingPenMode };
}
