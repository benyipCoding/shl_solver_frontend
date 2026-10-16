import { useCallback, useEffect, useRef, useState } from "react";
import type { BrokerCommand, BrokerResult, BrokerSnapshot } from "@/components/market-master/broker-trading";

async function readResponse(response: Response) {
  if (response.status === 401) throw Object.assign(new Error("登录已失效，请重新登录后连接福汇 Demo"), { status: 401 });
  if (response.status === 403) throw Object.assign(new Error("当前账号没有福汇交易权限，请使用管理员账号登录"), { status: 403 });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message || body.error || (typeof body.detail === "string" ? body.detail : "交易请求失败")), { status: response.status });
  return body;
}

export function useBrokerTrading({ enabled, symbol, onSnapshot }: {
  enabled: boolean; symbol: string; onSnapshot: (snapshot: BrokerSnapshot) => void;
}) {
  const [snapshot, setSnapshot] = useState<BrokerSnapshot | null>(null);
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("未连接福汇账户");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BrokerResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState("");
  const currentScope = `${symbol}:${accountId}`;
  const activeSnapshot = scope === currentScope ? snapshot : null;
  const latest = useRef({ enabled, symbol, snapshot: activeSnapshot, connected });
  latest.current = { enabled, symbol, snapshot: activeSnapshot, connected: connected && scope === currentScope };
  const callback = useRef(onSnapshot);
  callback.current = onSnapshot;
  const inFlight = useRef(false);
  const storageKey = (account: string) => `fxcm-demo-pending:${account}`;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false, lastMessage = Date.now(), source: EventSource | null = null;
    let receivedSnapshot = false, terminalError = false;
    const controller = new AbortController();
    const params = new URLSearchParams({symbol});
    if (accountId) params.set("account_id", accountId);
    const accept = (data: BrokerSnapshot) => {
      if (disposed || latest.current.symbol !== symbol) return;
      receivedSnapshot = true;
      lastMessage = Date.now();
      setScope(`${symbol}:${accountId}`);
      setSnapshot(data); setConnected(true); setStatus("福汇 Demo 已连接");
      callback.current(data);
      try {
        const saved = localStorage.getItem(storageKey(data.account.id));
        if (saved) setResult(JSON.parse(saved));
      } catch { /* storage may be unavailable */ }
    };
    setConnected(false); setResult(null); setStatus("正在连接福汇 Demo 账户…");
    fetch(`/api/market_master/trading/state?${params}`, {signal: controller.signal, cache: "no-store"})
      .then(readResponse).then(data => {
        if (disposed) return;
        accept(data);
        source = new EventSource(`/api/market_master/trading/stream?${params}`);
        source.onmessage = event => {
          if (disposed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "error") throw new Error(data.message);
            accept(data);
          } catch (error) {
            terminalError = true;
            setConnected(false); setStatus(error instanceof Error ? error.message : "账户数据异常");
            source?.close();
          }
        };
        source.onerror = () => { if (!disposed) { setConnected(false); setStatus("账户连接中断，正在重新连接；持仓仍由福汇管理"); } };
      }).catch(error => { if (!disposed) { terminalError = true; setConnected(false); setStatus(error.message); } });
    const watchdog = setInterval(() => {
      if (receivedSnapshot && !terminalError && Date.now() - lastMessage > 10000) { setConnected(false); setStatus("账户状态已过期，请重新连接核对持仓"); }
    }, 2000);
    return () => { disposed = true; controller.abort(); source?.close(); clearInterval(watchdog); };
  }, [enabled, symbol, accountId, attempt]);

  const remember = useCallback((data: BrokerResult, account: string) => {
    setResult(data);
    if (["confirmed", "rejected"].includes(data.status)) localStorage.removeItem(storageKey(account));
    else localStorage.setItem(storageKey(account), JSON.stringify(data));
  }, []);
  const send = useCallback(async (input: Omit<BrokerCommand, "client_id" | "account_id" | "symbol">) => {
    const current = latest.current;
    if (inFlight.current || !current.enabled || !current.connected || !current.snapshot) throw new Error("账户未就绪或上一条指令仍在处理中");
    const account = current.snapshot.account.id;
    if (input.action === "open" && (current.snapshot.unresolved.length || localStorage.getItem(storageKey(account)))) {
      throw new Error("有待确认指令，请先核对结果再开仓");
    }
    const payload = { ...input, client_id: crypto.randomUUID(), account_id: account, symbol: current.snapshot.instrument.symbol };
    inFlight.current = true; setBusy(true);
    const pending: BrokerResult = {client_id: payload.client_id, status: "unknown", message: "指令提交中，请勿重复操作"};
    try {
      remember(pending, account);
      const response = await fetch("/api/market_master/trading/commands", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(100000),
      });
      const data: BrokerResult = await readResponse(response);
      remember(data, account);
      if (data.status !== "confirmed") throw Object.assign(new Error(data.message), { brokerResult: true });
      return data;
    } catch (error) {
      const e = error as Error & {status?: number; brokerResult?: boolean};
      if (!e.brokerResult) remember({ ...pending, status: e.status && e.status < 500 ? "rejected" : "unknown", message: e.message }, account);
      throw error;
    } finally { inFlight.current = false; setBusy(false); }
  }, [remember]);

  const reconcile = async (id: string) => {
    try {
      const data: BrokerResult = await readResponse(await fetch(`/api/market_master/trading/commands/${id}`, {cache: "no-store"}));
      const account = latest.current.snapshot?.account.id;
      if (account) remember(data, account);
      setAttempt(n => n + 1);
    } catch (error) { setStatus(error instanceof Error ? error.message : "查询指令失败"); }
  };
  const ready = enabled && connected && activeSnapshot != null && !busy;
  return {snapshot: activeSnapshot, ready, busy, status: enabled ? status : "请以管理员身份登录后连接福汇 Demo", result, send, reconcile, accountId, setAccountId,
    reconnect: () => setAttempt(n => n + 1)};
}

export type BrokerTrading = ReturnType<typeof useBrokerTrading>;
