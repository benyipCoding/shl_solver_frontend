// Run against a local frontend with Playwright (or FF14_PLAYWRIGHT_MODULE).
// API fixtures exercise the real page without relying on FFLogs availability.
const { chromium } = require(process.env.FF14_PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

const base = process.env.FF14_BASE_URL || "http://localhost:3000";
const reportUrl = "https://www.fflogs.com/reports/AbC123?fight=7";
const players = [
  { id: 1, name: "Player Alpha", type: "Paladin", server: "Test", fights: [{ id: 7 }, { id: 8 }] },
  { id: 2, name: "Player Beta", type: "Paladin", server: "Test", fights: [{ id: 7 }, { id: 8 }] },
];
const references = ["Reference One", "Reference Two"];

async function fixtures(context, requests) {
  await context.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    if (!url.pathname.startsWith("/api/ff14_logs/")) {
      return route.fulfill({ json: { code: 200, data: null } });
    }
    const code = url.searchParams.get("code");
    if (code === "Missing") return route.fulfill({ status: 404, json: { error: "Report unavailable" } });
    if (code === "Slow") await new Promise(resolve => setTimeout(resolve, 500));
    const referenceIndex = code === "Ref2" ? 1 : 0;
    let data;
    if (url.pathname.endsWith("/fights")) {
      data = {
        fights: [7, 8].map(id => ({ id, boss: 100, difficulty: 101, start_time: 0, end_time: 180000, combatTime: 180000 })),
        friendlies: code?.startsWith("Ref")
          ? [{ ...players[0], id: 10, name: references[referenceIndex] }]
          : players,
      };
    } else if (url.pathname.endsWith("/rankings/encounter")) {
      data = { hasMorePages: false, rankings: references.map((name, index) => ({ name, serverName: "Test", duration: 180000, total: 22000, reportID: `Ref${index + 1}`, fightID: 7 })) };
    } else if (url.pathname.endsWith("/events")) {
      data = { events: [1000, 3000, 5000].map(timestamp => ({ timestamp, type: "cast", sourceID: Number(url.searchParams.get("sourceid")), ability: { name: "Fast Blade", guid: 9 } })) };
    } else if (url.pathname.endsWith("/tables")) {
      data = { combatTime: 180000, entries: url.searchParams.has("sourceid")
        ? [{ name: "Fast Blade", guid: 9, total: url.searchParams.get("view") === "casts" ? 3 : 100000, hitCount: 3, uses: 3 }]
        : players.map((player, index) => ({ ...player, total: 1000000 - index * 200000, activeTime: 170000 })) };
    } else throw new Error(`Unmocked endpoint: ${url}`);
    return route.fulfill({ json: { code: 200, data } });
  });
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.FF14_BROWSER || "msedge", headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const requests = [];
      await fixtures(context, requests);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const summary = page.getByRole("heading", { name: "2. 战斗汇总", exact: true });
      const detail = page.getByRole("heading", { name: /3\. 技能明细: Player Beta/ });
      await page.goto(base + "/ff14?campaign=friend");
      await page.getByLabel("FFLogs 战斗链接", { exact: true }).fill(reportUrl);
      await summary.waitFor();
      assert.equal(new URL(page.url()).searchParams.get("report"), "AbC123");
      assert.equal(new URL(page.url()).searchParams.get("fight"), "7");
      const summaryUrl = page.url();

      await page.reload();
      await summary.waitFor();
      assert.equal(await page.getByLabel("FFLogs 战斗链接", { exact: true }).inputValue(), reportUrl);
      if (width < 760) {
        await page.getByRole("switch", { name: "切换战斗汇总显示模式" }).click();
        assert.equal(new URL(page.url()).searchParams.get("values"), "1");
      }
      await page.getByRole("button", { name: /Player Beta/ }).filter({ visible: true }).click();
      await detail.waitFor();
      assert.equal(new URL(page.url()).searchParams.get("player"), "2");
      const detailUrl = page.url();
      await page.getByRole("button", { name: "Reference Two 22,000 rDPS", exact: true }).filter({ visible: true }).click();
      await page.waitForURL(url => url.searchParams.get("compare") === "Ref2:10");
      await page.getByRole("button", { name: "缩放", exact: true }).first().click();
      await page.waitForURL(url => url.searchParams.get("zoom") === "6");
      await page.getByRole("switch", { name: "切换中英文" }).click();
      await page.waitForURL(url => url.searchParams.get("lang") === "en");
      const sharedUrl = page.url();
      assert.equal(new URL(sharedUrl).searchParams.get("campaign"), "friend");
      const loadedRequestCount = requests.length;

      await page.goBack();
      await detail.waitFor();
      await page.goBack();
      await page.waitForURL(url => !url.searchParams.has("zoom"));
      await page.goBack();
      await page.waitForURL(url => !url.searchParams.has("compare"));
      assert.equal(page.url(), detailUrl);
      await page.goForward();
      await page.waitForURL(url => url.searchParams.get("compare") === "Ref2:10");
      assert.equal(requests.length, loadedRequestCount, "view-only navigation does not refetch reports");

      // A different browser context simulates a friend opening the shared URL.
      const receiver = await browser.newContext({ viewport: { width: width === 1440 ? 390 : 1440, height: 1000 } });
      await fixtures(receiver, []);
      const freshPage = await receiver.newPage();
      freshPage.on("pageerror", error => errors.push(error.message));
      await freshPage.goto(sharedUrl);
      await freshPage.getByRole("heading", { name: /Skill Breakdown: Player Beta/ }).waitFor();
      await freshPage.getByText("30px/s", { exact: false }).waitFor();
      await freshPage.getByRole("button", { name: "Reference Two 22,000 rDPS", exact: true }).filter({ visible: true }).waitFor();
      assert.equal(await freshPage.getByRole("button", { name: "Reference Two 22,000 rDPS", exact: true }).filter({ visible: true }).getAttribute("aria-pressed"), "true");
      assert.equal(freshPage.url(), sharedUrl);
      await freshPage.reload();
      await freshPage.getByRole("heading", { name: /Skill Breakdown: Player Beta/ }).waitFor();
      await receiver.close();

      await page.getByRole("button", { name: "返回战斗汇总", exact: true }).click();
      await summary.waitFor();
      assert.equal(new URL(page.url()).searchParams.has("player"), false);
      await page.goBack();
      await detail.waitFor();
      assert.equal(new URL(page.url()).searchParams.get("compare"), "Ref2:10");
      await page.getByLabel("FFLogs 战斗链接", { exact: true }).fill(reportUrl.replace("fight=7", "fight=8"));
      await summary.waitFor();
      assert.equal(new URL(page.url()).searchParams.get("fight"), "8");
      assert.equal(new URL(page.url()).searchParams.has("player"), false);
      await page.goBack();
      await detail.waitFor();
      assert.equal(await page.getByLabel("FFLogs 战斗链接", { exact: true }).inputValue(), reportUrl);
      await page.getByLabel("FFLogs 战斗链接", { exact: true }).fill("");
      await page.getByRole("heading", { name: "请先粘贴有效的 FFLogs 战斗链接" }).waitFor();
      assert.equal(new URL(page.url()).searchParams.has("report"), false);

      await page.goto(summaryUrl + "&player=999");
      await summary.waitFor();
      await page.getByRole("status").filter({ hasText: "玩家不在当前战斗中" }).waitFor();
      assert.equal(await page.getByRole("heading", { name: /3\. 技能明细/ }).count(), 0);
      await page.goto(base + "/ff14?report=Missing&fight=7&player=2");
      await page.getByText("Report unavailable", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get("player"), "2", "load failures preserve the share target for retry");
      await page.goto(base + "/ff14?report=Slow&fight=7&player=2");
      await page.getByLabel("FFLogs 战斗链接", { exact: true }).fill(reportUrl);
      await summary.waitFor();
      await page.waitForTimeout(700);
      assert.equal(new URL(page.url()).searchParams.get("report"), "AbC123");
      await summary.waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: report/player links, history, refresh, comparison/zoom, cross-device sharing, invalid players, failures and stale requests`);
      await context.close();
    }
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
