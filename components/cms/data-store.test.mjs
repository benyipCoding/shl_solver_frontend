import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(
  new URL("./data-store.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { CmsStore } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("revisiting a menu keeps data and coalesces in-flight requests", async () => {
  const store = new CmsStore();
  const request = deferred();
  let calls = 0;
  const loader = () => {
    calls++;
    return request.promise;
  };
  const first = store.load("users", "page1", loader);
  const second = store.load("users", "page1", loader);
  assert.equal(first, second);
  request.resolve([1]);
  await first;
  await store.load("users", "page1", loader);
  assert.equal(calls, 1);
  assert.deepEqual(store.get("users").data, [1]);
});

test("refresh retains rows; a failed refresh exposes its error without clearing rows", async () => {
  const store = new CmsStore();
  await store.load("wallets", "all", async () => [20]);
  const pending = store.load(
    "wallets",
    "all",
    async () => {
      throw new Error("offline");
    },
    true,
  );
  assert.deepEqual(store.get("wallets").data, [20]);
  assert.equal(store.get("wallets").loading, true);
  await pending;
  assert.equal(store.get("wallets").error, "offline");
  assert.deepEqual(store.get("wallets").data, [20]);
});

test("a slow previous filter cannot overwrite a newer result", async () => {
  const store = new CmsStore();
  const old = deferred();
  const first = store.load("users", "old", () => old.promise);
  await store.load("users", "new", async () => [2]);
  old.resolve([1]);
  await first;
  assert.deepEqual(store.get("users").data, [2]);
  assert.equal(store.get("users").query, "new");
});

test("mutation invalidates inactive resources and rejects responses from before the mutation", async () => {
  const store = new CmsStore();
  await store.load("users", "all", async () => [100]);
  const stale = deferred();
  const pending = store.load("wallets", "all", () => stale.promise);
  store.invalidate();
  await store.load("wallets", "all", async () => [75]);
  stale.resolve([100]);
  await pending;
  assert.deepEqual(store.get("wallets").data, [75]);
  await store.load("users", "all", async () => [75]);
  assert.deepEqual(store.get("users").data, [75]);
});

test("view preferences and data are isolated between CMS sessions", async () => {
  const first = new CmsStore();
  first.setView("users", { page: 3, keyword: "alex" });
  await first.load("users", "q", async () => [1]);
  const second = new CmsStore();
  assert.deepEqual(first.getView("users", {}), { page: 3, keyword: "alex" });
  assert.deepEqual(second.getView("users", {}), {});
  assert.equal(second.get("users").data, undefined);
});
