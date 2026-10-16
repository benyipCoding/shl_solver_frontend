import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(name, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(name, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {exports, require: name => dependencies[name], ...globals});
  return exports;
}
const broker = load("./broker-trading.ts");
const management = load("./trade-management.ts");
const history = load("./trade-history.ts", {"./trade-management": management});
test("broker cash risk uses account pip cost and the execution side instead of raw units times price", () => {
  const instrument = {ask: 150.02, bid: 150, point_size: .01, pip_cost: .067, base_unit_size: 1000, digits: 3};
  assert.equal(broker.brokerRiskPrice("6.7", "amount", "Buy", "stop", 1000, instrument), 149.02);
  assert.equal(broker.brokerRiskPrice("6.7", "amount", "Sell", "limit", 1000, instrument), 149);
  assert.equal(broker.brokerRiskPrice("", "price", "Buy", "stop", 1000, instrument), null);
  assert.throws(() => broker.brokerRiskPrice("10", "amount", "Buy", "stop", 1000, {...instrument, pip_cost: null}), /点值/);
});
test("broker chart rows preserve actual fills, fees and net P/L while aligning markers to candles", () => {
  const position = {trade_id: "old", symbol: "EUR/USD", side: "Buy", amount: 1000, open_rate: 1.1, open_time: 65,
    close_rate: 1.2, close_time: 125, stop: 1, limit: 1.3, commission: 2, rollover: -3, net_pl: 5, close_order_id: "partial"};
  const snapshot = {account: {currency: "USD"}, instrument: {symbol: "EUR/USD"},
    positions: [{...position, trade_id: "remaining", amount: 1000}], closed_positions: [position, {...position, close_order_id: "final", amount: 2000}]};
  const rows = broker.brokerChartTrades(snapshot, [{time: 60}, {time: 120}]);
  assert.equal(rows[0].id, "remaining");
  assert.equal(rows[0].entryTime, 65);
  assert.equal(rows[0].chartEntryTime, 60);
  assert.equal(rows[1].chartCloseTime, 120);
  assert.notEqual(rows[1].id, rows[2].id);
  assert.equal(history.tradeHistoryPnl(rows[0], 999), 5);
  assert.equal(rows[0].brokerCommission, 2);
  assert.equal(rows[0].brokerRollover, -3);
  assert.equal(broker.brokerMoney(null, "USD"), "—");
});

function hookHarness({getStatus=200}={}) {
  const slots = [], effects = [], sources = [], requests = [], storage = new Map();
  const timers=[];
  let now=0;
  let cursor = 0, seq = 0, resolvePost;
  const same = (a,b) => a?.length === b.length && a.every((v,i) => v === b[i]);
  const react = {
    useState(value) {const i=cursor++; if (!(i in slots)) slots[i]=value; return [slots[i], v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
    useRef(value) {const i=cursor++; return slots[i]??={current:value};},
    useCallback(fn,deps) {const i=cursor++; if (!same(slots[i]?.deps,deps)) slots[i]={deps,fn}; return slots[i].fn;},
    useEffect(fn,deps) {const i=cursor++; if (!same(slots[i]?.deps,deps)) effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
  };
  const snapshot={type:"account",account:{id:"demo"},instrument:{symbol:"EUR/USD"},positions:[],closed_positions:[],unresolved:[]};
  class Source {constructor(){sources.push(this);} close(){this.closed=true;}}
  const {useBrokerTrading: runHook} = load("../../hooks/useBrokerTrading.ts", {react}, {
    fetch: async (url,options) => {
      requests.push({url,options});
      if (options?.method === "POST") return new Promise(resolve => {resolvePost=resolve;});
      return Response.json(getStatus===200 ? snapshot : {detail:"Unauthorized"},{status:getStatus});
    }, EventSource:Source, URLSearchParams, AbortController, AbortSignal,
    Date:class extends Date { static now(){return now;} },
    setInterval:fn=>{timers.push(fn);return timers.length-1;}, clearInterval(id){timers[id]=null;},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    crypto:{randomUUID:()=>`command-${++seq}`},
  });
  let params={enabled:true,symbol:"EUR/USD",onSnapshot(){}};
  return {requests,sources,storage,
    advance(ms){now+=ms;timers.forEach(fn=>fn?.());},
    render(changes={}) {params={...params,...changes};cursor=0;const value=runHook(params);effects.splice(0).forEach(fn=>fn());return value;},
    resolve(data) {resolvePost(Response.json(data));},
  };
}
test("broker submissions cannot double-send, persist uncertain IDs, and stop on stale mode/symbol", async () => {
  const h=hookHarness();h.render();await new Promise(resolve=>setImmediate(resolve));
  const hook=h.render();assert.equal(hook.ready,true);
  const first=hook.send({action:"open",side:"Buy",amount:1000});
  await assert.rejects(hook.send({action:"open",side:"Buy",amount:1000}), /上一条指令/);
  assert.equal(h.requests.filter(r=>r.options?.method==="POST").length,1);
  h.resolve({client_id:"command-1",status:"unknown",message:"timeout"});
  await assert.rejects(first,/timeout/);
  assert.match(h.storage.get("fxcm-demo-pending:demo"), /command-1/);
  await assert.rejects(h.render().send({action:"open",side:"Buy",amount:1000}), /待确认/);
  const switched=h.render({symbol:"XAU/USD"});assert.equal(switched.ready,false);
  await assert.rejects(switched.send({action:"close",trade_id:"old",amount:1000}), /账户未就绪/);
  assert.ok(h.sources[0].closed);
  const off=h.render({enabled:false});await assert.rejects(off.send({action:"open",amount:1000}),/账户未就绪/);
});

test("expired login during a mode switch stays disconnected and preserves the login prompt",async()=>{
  const h=hookHarness({getStatus:401});
  h.render({enabled:false});
  assert.equal(h.requests.length,0);
  h.render({enabled:true});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.render().ready,false);
  assert.match(h.render().status,/登录已失效.*重新登录/);
  assert.equal(h.sources.length,0);
  h.advance(20000);
  assert.match(h.render().status,/登录已失效.*重新登录/);
  assert.equal(h.requests.length,1);
  await assert.rejects(h.render().send({action:"open",side:"Buy",amount:1000}),/账户未就绪/);
  assert.equal(h.requests.length,1);
});

test("missing trading permissions remain visible instead of becoming a stale account warning",async()=>{
  const h=hookHarness({getStatus:403});
  h.render();
  await new Promise(resolve=>setImmediate(resolve));
  h.advance(20000);
  assert.match(h.render().status,/没有福汇交易权限/);
  assert.equal(h.sources.length,0);
  assert.equal(h.requests.length,1);
});
