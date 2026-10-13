import { useEffect, useRef, useState } from "react";
import type { CandleInput } from "@/components/market-master/market-data";
import type { RealtimeQuote } from "@/components/market-master/realtime-data";

export type RealtimeEvent = {
  type: "snapshot" | "candles" | "heartbeat" | "error";
  candles?: CandleInput[];
  quote?: RealtimeQuote;
  quotes?: RealtimeQuote[];
  message?: string;
  retryable?: boolean;
};

export function useRealtimeMarket({ enabled, symbol, interval, onEvent }: {
  enabled: boolean; symbol: string; interval: string;
  onEvent: (event: RealtimeEvent) => void;
}) {
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const [status, setStatus] = useState("未连接");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let lastMessage = Date.now();
    let lastQuote = 0;
    let snapshotReady = false;
    const retry = (message = "连接中断，正在重连") => {
      source?.close();
      source = null;
      setReady(false);
      if (disposed || retryTimer) return;
      setStatus(message);
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5));
      retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, delay);
    };
    const connect = () => {
      if (disposed) return;
      snapshotReady = false;
      setReady(false);
      lastMessage = Date.now();
      setStatus("连接中，正在补齐行情");
      const params = new URLSearchParams({ symbol, interval });
      const current = new EventSource(`/api/market_master/realtime/stream?${params}`);
      source = current;
      current.onmessage = (message) => {
        if (disposed || source !== current) return;
        lastMessage = Date.now();
        try {
          const event: RealtimeEvent = JSON.parse(message.data);
          if (event.type === "error") {
            if (event.retryable === false) {
              current.close(); source = null;
              setReady(false);
              setStatus(event.message || "实时行情不可用");
            } else retry(event.message);
            return;
          }
          callback.current(event);
          if (event.type === "snapshot") {
            snapshotReady = true;
            attempts = 0;
            setStatus("已连接，等待报价");
          }
          if (event.quote) {
            lastQuote = event.quote.timestamp * 1000;
            const fresh = Math.abs(Date.now() - lastQuote) < 30000;
            setReady(fresh);
            setStatus(fresh ? "实时更新中" : "已连接，暂无新报价（可能休市）");
          } else if (snapshotReady && Date.now() - lastQuote > 30000) {
            setStatus("已连接，暂无新报价（可能休市）");
            setReady(false);
          }
        } catch (error) {
          current.close(); source = null;
          setReady(false);
          setStatus(error instanceof Error ? error.message : "实时行情格式异常");
        }
      };
      current.onerror = () => { if (source === current) retry(); };
    };
    connect();
    const watchdog = setInterval(() => {
      if (source && Date.now() - lastMessage > (snapshotReady ? 35000 : 120000)) retry();
      if (source && snapshotReady && Date.now() - lastQuote > 30000) {
        setReady(false);
        setStatus("已连接，暂无新报价（可能休市）");
      }
    }, 5000);
    return () => {
      disposed = true;
      source?.close();
      clearTimeout(retryTimer);
      clearInterval(watchdog);
    };
  }, [enabled, symbol, interval]);
  return { status: enabled ? status : "已暂停", ready: enabled && ready };
}
