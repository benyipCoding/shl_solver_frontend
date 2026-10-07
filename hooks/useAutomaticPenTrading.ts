import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CandlestickData, DataChangedScope, ISeriesApi, Time } from "lightweight-charts";
import { createAutomaticPenTradeTracker, type AutomaticTradingCandle } from "@/components/market-master/automatic-pen-trading";

export function useAutomaticPenTrading({ seriesRef, canTrade, marketKey }: {
  seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
  canTrade: boolean;
  marketKey: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const sessionRef = useRef<{
    tracker: ReturnType<typeof createAutomaticPenTradeTracker>;
    key: string;
    entriesEnabled: boolean;
    cleanup: () => void;
  } | null>(null);

  const stop = useCallback(() => {
    sessionRef.current?.cleanup();
    sessionRef.current = null;
    setEnabled(false);
  }, []);

  // Switching markets, exiting backtest, losing permission or entering recorded
  // replay always requires the user to explicitly enable trading again.
  useEffect(() => stop, [canTrade, marketKey, stop]);

  const toggle = useCallback((startTime?: Time | null) => {
    if (sessionRef.current) {
      if (!canTrade) return;
      sessionRef.current.entriesEnabled = !sessionRef.current.entriesEnabled;
      setEnabled(sessionRef.current.entriesEnabled);
      return;
    }
    const series = seriesRef.current;
    if (!canTrade || !series) return;
    const readCandles = () => series.data().filter((bar): bar is CandlestickData<Time> =>
      "open" in bar && (startTime == null || bar.time >= startTime));
    const candles = readCandles();
    if (!candles.length) return;
    const boundary = candles[0].time;
    const onDataChanged = (scope: DataChangedScope) => {
      const session = sessionRef.current;
      if (scope !== "full" || !session) return;
      // History prepend/reload/rewind only rebuild context, never place orders.
      session.tracker = createAutomaticPenTradeTracker(readCandles().filter((bar) => bar.time >= boundary));
    };
    sessionRef.current = {
      tracker: createAutomaticPenTradeTracker(candles),
      key: marketKey,
      entriesEnabled: true,
      cleanup: () => series.unsubscribeDataChanged(onDataChanged),
    };
    series.subscribeDataChanged(onDataChanged);
    setEnabled(true);
  }, [canTrade, marketKey, seriesRef]);

  const advance = useCallback((candle: AutomaticTradingCandle) => {
    const session = sessionRef.current;
    if (!canTrade || !session || session.key !== marketKey) return null;
    const event = session.tracker.advanceEvent(candle);
    // Turning entries off retains structural protection for existing positions.
    return event && !session.entriesEnabled ? { ...event, side: null } : event;
  }, [canTrade, marketKey]);

  return { isAutomaticTradingEnabled: enabled && canTrade, toggleAutomaticTrading: toggle, stopAutomaticTrading: stop, advanceAutomaticTrading: advance };
}
