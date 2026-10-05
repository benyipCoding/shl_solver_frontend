import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(name) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`./${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, URL, fetch });
  return exports;
}
const { buildBacktestShareUrl, removeBacktestShareParam } = load("backtest-sharing");
const { createBacktestPersistClient } = load("backtest-persistence");

test("share links contain only the replay identifier and use the current deployment origin", () => {
  const url = new URL(buildBacktestShareUrl("https://example.com", "a7cdb147-cad2-4c16-b741-43ad22000d0c"));
  assert.equal(url.origin, "https://example.com");
  assert.equal(url.pathname, "/market-master");
  assert.deepEqual([...url.searchParams.keys()], ["share"]);
  assert.equal(url.searchParams.get("share"), "a7cdb147-cad2-4c16-b741-43ad22000d0c");
});

test("finishing a share import preserves unrelated URL state and avoids replay on refresh", () => {
  assert.equal(removeBacktestShareParam("https://example.com/market-master?tab=chart&share=abc#trades"), "/market-master?tab=chart#trades");
  assert.equal(removeBacktestShareParam("https://example.com/market-master?share=abc"), "/market-master");
});

test("share, save and revoke use authenticated mutation endpoints and propagate cancellation", async () => {
  const client = createBacktestPersistClient();
  const requests = [];
  const controller = new AbortController();
  client.configure({ enabled: true, fetchFn: async (url, init) => {
    requests.push({ url, ...init });
    return new Response(JSON.stringify({ code: 200, data: { public_id: "abc", already_saved: true, session: { public_id: "abc" } } }));
  } });
  await client.shareSession("abc", controller.signal);
  const imported = await client.saveSharedSession("abc", controller.signal);
  await client.revokeShare("abc");
  assert.deepEqual(requests.map(({ url, method }) => [url, method]), [
    ["/api/market_master/backtest/sessions/abc/share", "POST"],
    ["/api/market_master/backtest/shared/abc", "POST"],
    ["/api/market_master/backtest/sessions/abc/share", "DELETE"],
  ]);
  assert.equal(requests[0].signal, controller.signal);
  assert.equal(requests[1].signal, controller.signal);
  assert.equal(imported.already_saved, true);
  assert.equal(imported.session.public_id, "abc");
});

test("invalid/revoked shares surface the server message without pretending to import", async () => {
  const client = createBacktestPersistClient();
  client.configure({ enabled: true, fetchFn: async () => new Response(JSON.stringify({ code: 404, message: "分享链接已失效" }), { status: 404 }) });
  await assert.rejects(client.saveSharedSession("missing"), /分享链接已失效/);
});
