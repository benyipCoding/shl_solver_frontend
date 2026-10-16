import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function harness() {
  const slots = [], effects = [], sources = [], timers = new Map();
  let cursor = 0, timerId = 0;
  const same = (a, b) => a?.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (value) => { slots[i] = value; }]; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) effects.push(() => {
      slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
    }); },
  };
  class EventSource {
    constructor(url) { this.url = url; sources.push(this); }
    close() { this.closed = true; }
    emit(event) { this.onmessage?.({ data: JSON.stringify(event) }); }
  }
  const target = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../../hooks/useRealtimeMarket.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports: target.exports, module: target, require: () => react, EventSource, URLSearchParams, Error,
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => timers.delete(id), setInterval: () => 0, clearInterval() {},
  });
  let params = { enabled: true, symbol: "EUR/USD", interval: "1min", onEvent() {} };
  return { sources, timers,
    render(changes = {}) {
      params = { ...params, ...changes }; cursor = 0;
      const value = target.exports.useRealtimeMarket(params);
      effects.splice(0).forEach((fn) => fn());
      return value;
    },
  };
}

test("historical mode and replay pause open no stream; cleanup rejects late messages", () => {
  const h = harness(), events = [];
  h.render({ enabled: false, onEvent: (event) => events.push(event) });
  assert.equal(h.sources.length, 0);
  h.render({ enabled: true });
  const source = h.sources[0];
  source.emit({ type: "snapshot", candles: [] });
  assert.equal(events.length, 1);
  h.render({ enabled: false });
  assert.ok(source.closed);
  source.emit({ type: "candles" });
  assert.equal(events.length, 1);
  assert.equal(h.render().ready, false);
});
test("symbol switch closes the old stream and cannot deliver its quotes", () => {
  const h = harness(), events = [];
  h.render({ onEvent: (event) => events.push(event) });
  h.render({ symbol: "XAU/USD" });
  assert.ok(h.sources[0].closed);
  h.sources[0].emit({ type: "snapshot" });
  assert.equal(events.length, 0);
  assert.match(h.sources[1].url, /XAU%2FUSD/);
});
test("connection failures schedule one retry; leaving the mode cancels it", () => {
  const h = harness(); h.render();
  h.sources[0].onerror(); h.sources[0].onerror();
  assert.equal(h.timers.size, 1);
  const [id, timer] = [...h.timers][0];
  assert.equal(timer.delay, 1000);
  h.timers.delete(id); timer.fn();
  assert.equal(h.sources.length, 2);
  h.sources[1].onerror();
  assert.equal([...h.timers.values()][0].delay, 2000);
  h.render({ enabled: false });
  assert.equal(h.timers.size, 0);
});
test("terminal errors stop retries and stale snapshots cannot enable simulated orders", () => {
  const h = harness(); h.render();
  h.sources[0].emit({ type: "snapshot", quote: { timestamp: 1, bid: 1, ask: 2 } });
  assert.equal(h.render().ready, false);
  h.sources[0].emit({ type: "error", retryable: false, message: "disabled" });
  assert.ok(h.sources[0].closed);
  assert.equal(h.timers.size, 0);
  assert.equal(h.render().status, "disabled");
});
test("a rejected non-overlapping snapshot stops the stream and never reports ready", () => {
  const h = harness();
  h.render({ onEvent: () => { throw new Error("history gap"); } });
  h.sources[0].emit({ type: "snapshot", quote: { timestamp: Date.now() / 1000, bid: 1, ask: 2 } });
  const result = h.render();
  assert.equal(result.ready, false);
  assert.ok(h.sources[0].closed);
});

test("the stream connects during history loading and applies buffered snapshot/deltas in order", () => {
  const h = harness(), events = [];
  h.render({ paused: true, onEvent: event => events.push(event) });
  const source = h.sources[0];
  source.onopen();
  assert.match(h.render().status, /行情已连接.*校准/);
  source.emit({ type: "snapshot", candles: [{datetime:"2026-10-14T00:00:00"}], quote: {timestamp:Date.now()/1000,bid:1,ask:2} });
  source.emit({ type: "candles", candles: [{datetime:"2026-10-14T00:01:00"}], quote: {timestamp:Date.now()/1000,bid:2,ask:3} });
  assert.equal(events.length, 0);
  assert.equal(h.render().ready, false);
  assert.match(h.render().status, /加载图表历史/);
  h.render({ paused: false });
  assert.deepEqual(events.map(e=>e.type), ["snapshot", "candles"]);
  assert.equal(h.render().ready, true);
  assert.equal(h.render().status, "实时更新中");
  assert.equal(h.sources.length, 1);
  h.render({paused:true}); // Fetching an older page must not resubscribe.
  source.emit({type:"candles",quote:{timestamp:Date.now()/1000,bid:3,ask:4}});
  h.render({paused:false});
  assert.equal(h.sources.length, 1);
  assert.equal(events.length, 3);
  assert.ok(!source.closed);
});

test("switching charts discards the previous chart's buffered data and readiness", () => {
  const h=harness(), events=[];
  h.render({onEvent:event=>events.push(event)});
  h.sources[0].emit({type:"snapshot",quote:{timestamp:Date.now()/1000,bid:1,ask:2}});
  assert.equal(h.render().ready,true);
  h.render({paused:true});
  h.sources[0].emit({type:"candles"});
  assert.equal(h.render({interval:"4h",paused:false}).ready,false);
  assert.ok(h.sources[0].closed);
  assert.equal(events.length,1);
  h.sources[0].emit({type:"candles"});
  assert.equal(events.length,1);
  assert.match(h.sources[1].url,/interval=4h/);
});

test("only an actual history gap escalates the tail snapshot, once per connection scope", () => {
  const h=harness();
  h.render({onEvent:()=>{throw Object.assign(new Error("gap"),{name:"RealtimeHistoryGap"});}});
  assert.match(h.sources[0].url,/snapshot_size=256/);
  h.sources[0].emit({type:"snapshot"});
  assert.ok(h.sources[0].closed);
  const [id,timer]=[...h.timers][0];
  assert.equal(timer.delay,0);
  h.timers.delete(id);timer.fn();
  assert.match(h.sources[1].url,/snapshot_size=5000/);
  h.sources[1].emit({type:"snapshot"});
  assert.ok(h.sources[1].closed);
  assert.equal(h.timers.size,0);
  assert.equal(h.render().ready,false);
});

test("slow chart loading bounds memory and requests a new snapshot instead of dropping deltas", () => {
  const h=harness(),events=[];
  h.render({paused:true,onEvent:event=>events.push(event)});
  for(let i=0;i<129;i++) h.sources[0].emit({type:i===0?"snapshot":"candles"});
  assert.ok(h.sources[0].closed);
  assert.equal(h.timers.size,1);
  h.render({paused:false});
  assert.equal(events.length,0);
});

test("a reconnect snapshot cannot borrow a fresh quote from the previous connection", () => {
  const h=harness();h.render();
  h.sources[0].emit({type:"snapshot",quote:{timestamp:Date.now()/1000,bid:1,ask:2}});
  assert.equal(h.render().ready,true);
  h.sources[0].onerror();
  const [id,timer]=[...h.timers][0];h.timers.delete(id);timer.fn();
  h.sources[1].emit({type:"snapshot",candles:[]});
  assert.equal(h.render().ready,false);
});
