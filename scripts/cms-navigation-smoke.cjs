// Regression for first-visit menu loading: real page stays until new rows are ready.
// All requests use fixtures in an isolated browser, never the business database.
const { chromium } = require(process.env.CMS_PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

async function main() {
  const browser = await chromium.launch({ channel: process.env.CMS_BROWSER || "msedge", headless: true });
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const admin = { id: 1, username: "管理员", email: "admin@example.com", is_superuser: true };
      await context.addInitScript(user => localStorage.setItem("user_info", JSON.stringify(user)), admin);
      const requests = [];
      const user = { id: 2, username: "测试用户", email: "test@example.com", is_active: true, is_staff: false, is_superuser: false, wallet_total_credits: 100, total_token_count: 1000, created_at: "2026-10-31T00:00:00Z" };
      let releaseWallet;
      const walletReady = new Promise(resolve => { releaseWallet = resolve; });
      await context.route("**/api/**", async route => {
        const pathname = new URL(route.request().url()).pathname;
        requests.push(pathname);
        if (pathname === "/api/user/me") return route.fulfill({ json: { data: admin } });
        if (pathname === "/api/admin/wallets") await walletReady;
        if (pathname === "/api/admin/credit-logs") await new Promise(resolve => setTimeout(resolve, 800));
        if (pathname === "/api/admin/token-records") await new Promise(resolve => setTimeout(resolve, 50));
        let item = user;
        if (pathname.endsWith("wallets")) item = { ...user, user_id: 2, wallet_id: 1, free_credits: 40, paid_credits: 60, total_credits: 100, last_reset_date: null };
        if (pathname.endsWith("credit-logs")) item = { ...user, user_id: 2, amount: -10, credit_type: "PAID", action_type: "ADMIN_DEDUCT", balance_after: 90 };
        if (pathname.endsWith("token-records")) item = { ...user, user_id: 2, model: "test-model", request_path: "/test", token_count: 120, ip: "127.0.0.1" };
        return route.fulfill({ json: { data: { items: Array.from({ length: 20 }, (_, index) => ({ ...item, id: index + 2, user_id: index + 2 })), pagination: { total: 40, page: 1, page_size: 20, total_pages: 2 } } } });
      });
      await page.goto((process.env.CMS_BASE_URL || "http://localhost:3000") + "/cms/users");
      const result = page.getByRole("region", { name: "查询结果" });
      await result.locator("tbody tr").first().waitFor({ state: "attached" });
      const originalHeight = (await result.boundingBox()).height;
      const select = async label => {
        if (width < 1024) await page.getByRole("button", { name: "打开导航菜单" }).click();
        const nav = width < 1024 ? page.getByRole("dialog", { name: "后台导航菜单" }) : page.getByRole("navigation", { name: "后台导航" });
        await nav.getByRole("link", { name: label, exact: true }).click();
      };
      await select("钱包管理");
      await page.waitForTimeout(100);
      assert.equal(new URL(page.url()).pathname, "/cms/users");
      assert.equal((await result.boundingBox()).height, originalHeight, "outgoing list never collapses");
      assert.equal(await page.getByText("正在打开页面…", { exact: true }).isVisible(), false, "fast requests should not flash a notice");
      await page.waitForTimeout(300);
      assert.equal(await page.getByText("正在打开页面…", { exact: true }).isVisible(), true, "slow requests get an out-of-flow notice");
      assert.equal((await result.boundingBox()).height, originalHeight, "notice does not change height");
      // Capture every painted frame, not only the settled result.
      await page.evaluate(() => {
        window.cmsFrames = [];
        window.cmsRecording = true;
        const sample = () => {
          if (!window.cmsRecording) return;
          const section = document.querySelector('section[aria-label="查询结果"]');
          window.cmsFrames.push({ pathname: location.pathname, rows: section?.querySelectorAll("tbody tr").length ?? 0, height: section?.getBoundingClientRect().height ?? 0 });
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      releaseWallet();
      await page.waitForURL("**/cms/wallets");
      await page.waitForTimeout(150);
      const frames = await page.evaluate(() => { window.cmsRecording = false; return window.cmsFrames; });
      assert.ok(frames.length > 0);
      assert.ok(frames.every(frame => frame.rows === 20 && frame.height > 1000), "every frame shows a full list, without a short loading box");
      assert.equal(await page.getByLabel("加载中", { exact: true }).count(), 0);
      await select("算力流水");
      await page.waitForTimeout(100);
      await select("Token 记录");
      await page.waitForURL("**/cms/token-records");
      await page.waitForTimeout(900);
      assert.equal(new URL(page.url()).pathname, "/cms/token-records", "slow earlier clicks cannot redirect the latest selection");
      assert.equal(requests.filter(url => url === "/api/admin/wallets").length, 1, "the ready destination must not reload on mount");
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: stable first navigation, delayed notice, 20 real rows in every frame, latest menu wins`);
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
