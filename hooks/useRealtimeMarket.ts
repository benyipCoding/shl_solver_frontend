import { useEffect, useRef, useState } from "react";
import type { CandleInput } from "@/components/market-master/market-data";
import type { RealtimeQuote } from "@/components/market-master/realtime-data";

export type RealtimeSeed = { timestamp: number; price: number };

export type RealtimeEvent = {
  type: "snapshot" | "candles" | "heartbeat" | "error";
  symbol?: string;
  interval?: string;
  streamSymbol?: string;
  streamInterval?: string;
  candles?: CandleInput[];
  quote?: RealtimeQuote;
  quotes?: RealtimeQuote[];
  message?: string;
  retryable?: boolean;
};

export function useRealtimeMarket({ enabled, paused = false, symbol, interval, seed, onEvent }: {
  enabled: boolean; paused?: boolean; symbol: string; interval: string;
  seed?: RealtimeSeed | null;
  onEvent: (event: RealtimeEvent) => void;
}) {
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const [status, setStatus] = useState("未连接");
  const [ready, setReady] = useState(false);
  const [scope, setScope] = useState("");
  const key = `${symbol}:${interval}`;
  const activeKey = useRef("");
  activeKey.current = enabled ? key : "";
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const resumeRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!enabled) return;
    setScope(key);
    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let lastMessage = Date.now();
    let lastQuote = 0;
    let snapshotReady = false;
    // Realtime mode owns its chart window. Start with a small FXCM-only
    // snapshot so the SSE becomes ready quickly; request the larger provider
    // window only when an actual overlap gap proves it is needed.
    let snapshotSize = 256;
    let pending: RealtimeEvent[] = [];
    const isActive = () => !disposed && activeKey.current === key;
    const retry = (message = "K 线连接中断，正在重连", immediate = false) => {
      source?.close();
      source = null;
      pending = [];
      snapshotReady = false;
      setReady(false);
      if (!isActive() || retryTimer) return;
      setStatus(message);
      const delay = immediate ? 0 : Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5));
      retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, delay);
    };
    const apply = (event: RealtimeEvent) => {
      // Scope every callback to the connection that produced it.  This keeps
      // a late event from an old timeframe from being mistaken for the new
      // chart's snapshot during a fast H1 -> D1 switch.
      callback.current({ ...event, streamSymbol: symbol, streamInterval: interval });
      if (event.type === "snapshot") {
        snapshotReady = true;
        attempts = 0;
      }
      if (event.quote) lastQuote = event.quote.timestamp * 1000;
      if (snapshotReady) {
        const fresh = Math.abs(Date.now() - lastQuote) < 30000;
        setReady(fresh);
        setStatus(fresh ? "实时更新中" : "K 线已就绪，暂无新报价（可能休市）");
      }
    };
    const fail = (error: unknown) => {
      if (error instanceof Error && error.name === "RealtimeHistoryGap" && snapshotSize < 5000) {
        snapshotSize = 5000;
        retry("历史有缺口，正在补齐 K 线", true);
        return;
      }
      source?.close(); source = null; pending = [];
      setReady(false);
      setStatus(error instanceof Error ? error.message : "实时行情格式异常");
    };
    const drain = () => {
      if (!isActive() || pausedRef.current) return;
      const events = pending;
      pending = [];
      try {
        for (const event of events) apply(event);
      } catch (error) { fail(error); }
    };
    resumeRef.current = drain;
    const connect = () => {
      if (!isActive()) return;
      snapshotReady = false;
      setReady(false);
      lastMessage = Date.now();
      lastQuote = 0;
      setStatus("正在连接 K 线行情");
      const params = new URLSearchParams({ symbol, interval, snapshot_size: String(snapshotSize) });
      if (seed && Number.isFinite(seed.timestamp) && Number.isFinite(seed.price) && seed.price > 0) {
        params.set("seed_timestamp", String(seed.timestamp));
        params.set("seed_price", String(seed.price));
      }
      const current = new EventSource(`/api/market_master/realtime/stream?${params}`);
      source = current;
      current.onopen = () => {
        if (isActive() && source === current && !snapshotReady) {
          setStatus("行情已连接，正在加载 FXCM K 线");
        }
      };
      current.onmessage = (message) => {
        if (!isActive() || source !== current) return;
        lastMessage = Date.now();
        try {
          const event: RealtimeEvent = JSON.parse(message.data);
          if (event.type === "error") {
            if (event.retryable === false) {
              current.close(); source = null;
              pending = [];
              setReady(false);
              setStatus(event.message || "实时行情不可用");
            } else retry(event.message);
            return;
          }
          if (pausedRef.current) {
            // Keep the stream alive while the database page/older history loads.
            // A bounded buffer preserves order without mixing chart scopes.
            if (pending.length >= 128) { retry("图表加载较慢，正在重新获取 FXCM 快照"); return; }
            pending.push(event);
            setReady(false);
            setStatus("行情已连接，正在加载图表历史");
            return;
          }
          drain();
          if (source === current) apply(event);
        } catch (error) {
          fail(error);
        }
      };
      current.onerror = () => { if (source === current) retry(); };
    };
    connect();
    const watchdog = setInterval(() => {
      if (source && Date.now() - lastMessage > (snapshotReady ? 35000 : 120000)) retry();
      if (source && snapshotReady && !pausedRef.current && Date.now() - lastQuote > 30000) {
        setReady(false);
        setStatus("K 线已就绪，暂无新报价（可能休市）");
      }
    }, 5000);
    return () => {
      disposed = true;
      resumeRef.current = () => {};
      pending = [];
      source?.close();
      clearTimeout(retryTimer);
      clearInterval(watchdog);
    };
  // Capture the seed when a connection starts; changing it on every live
  // candle must not tear down and recreate the stream.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, symbol, interval, key]);
  useEffect(() => { if (!paused) resumeRef.current(); }, [paused, enabled, key]);
  return {
    status: enabled ? scope === key ? status : "正在连接 K 线行情" : "已暂停",
    ready: enabled && !paused && scope === key && ready,
  };
}
