// Run against a local frontend. All API calls are intercepted in this isolated browser.
// npm install --no-save playwright, or set CMS_PLAYWRIGHT_MODULE to an existing module path.
const { chromium } = require(process.env.CMS_PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function main() {
  const output =
    process.env.CMS_SCREENSHOTS || path.join(os.tmpdir(), "cms-ui-review");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.CMS_BROWSER || "msedge",
    headless: true,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "light",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|descendant|nested/i.test(message.text())
      )
        errors.push(message.text());
    });
    const admin = {
      id: 1,
      username: "管理员",
      email: "admin@example.com",
      is_staff: true,
      is_superuser: true,
    };
    await context.addInitScript((user) => {
      localStorage.setItem("user_info", JSON.stringify(user));
      localStorage.setItem("theme", "light");
    }, admin);
    const wallet = {
      wallet_id: 12,
      user_id: 2,
      username: "林晓",
      email: "lin.xiao@example.com",
      mobile_phone: "13800000000",
      free_credits: 40,
      paid_credits: 100,
      total_credits: 140,
      last_reset_date: "2026-10-31",
      wallet_created_at: "2026-10-01T08:30:00Z",
      wallet_updated_at: "2026-10-31T02:15:00Z",
    };
    const users = [
      { id: 2, username: wallet.username, email: wallet.email },
      { id: 3, username: "陈远", email: "chen.yuan@example.com" },
      {
        id: 4,
        username: "一个用于验证换行的很长的用户名称",
        email: "a-very-long-email-address-for-layout-testing@example.com",
      },
    ].map((user, index) => ({
      ...user,
      is_active: index !== 1,
      is_staff: index === 2,
      is_superuser: false,
      mobile_phone: null,
      total_token_count: 17800 + index * 7300,
      free_credits: 40,
      paid_credits: 100,
      wallet_total_credits: 140,
      created_at: "2026-10-20T08:30:00Z",
      updated_at: null,
    }));
    const calls = [];
    const deductions = [];
    let listDelay = 50;
    let failWalletList = false;
    let failDeduction = true;
    const envelope = (data) => ({ code: 200, message: "success", data });
    await context.route("**/api/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      calls.push(url.pathname + url.search);
      const reply = (data) => route.fulfill({ json: envelope(data) });
      if (url.pathname === "/api/user/me") return reply(admin);
      if (url.pathname === "/api/user/balance")
        return reply({ free_credits: 40, paid_credits: 100, total: 140 });
      if (url.pathname.endsWith("/deduct")) {
        const body = req.postDataJSON();
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (failDeduction)
          return route.fulfill({
            status: 409,
            json: { detail: "余额已变化，请重新核对" },
          });
        deductions.push(body);
        assert.equal(body.credit_type, "PAID");
        wallet.paid_credits -= body.amount;
        wallet.total_credits -= body.amount;
        return reply({
          ...wallet,
          balance_after: wallet.total_credits,
          deducted_points: body.amount,
        });
      }
      if (url.pathname === "/api/admin/homepage")
        return reply({ active_version: 1, revision: 0 });
      if (/\/wallets\/\d+$/.test(url.pathname)) return reply(wallet);
      if (/\/users\/\d+$/.test(url.pathname))
        return reply({
          ...users[0],
          credit_log_count: 10,
          token_record_count: 20,
        });
      if (url.pathname.startsWith("/api/admin/")) {
        await new Promise((resolve) => setTimeout(resolve, listDelay));
        if (failWalletList && url.pathname.endsWith("/wallets"))
          return route.fulfill({
            status: 503,
            json: { message: "模拟网络错误" },
          });
        let items = users;
        if (url.pathname.endsWith("wallets"))
          items = users.map((user) => ({
            ...wallet,
            user_id: user.id,
            username: user.username,
            email: user.email,
          }));
        if (url.pathname.endsWith("credit-logs"))
          items = [
            {
              id: 1,
              user_id: 2,
              username: wallet.username,
              email: wallet.email,
              amount: -25,
              credit_type: "PAID",
              action_type: "ADMIN_DEDUCT",
              balance_after: 115,
              created_at: "2026-10-31T04:00:00Z",
              operator_user_id: 1,
              reason: "撤回重复赠送",
            },
          ];
        if (url.pathname.endsWith("token-records"))
          items = [
            {
              id: 1,
              user_id: 2,
              username: wallet.username,
              email: wallet.email,
              model: "gpt-4o",
              request_path: "/api/shl_analyze",
              ip: "127.0.0.1",
              token_count: 3400,
              created_at: "2026-10-31T04:00:00Z",
            },
          ];
        return reply({
          items,
          pagination: {
            page: Number(url.searchParams.get("page") || 1),
            page_size: Number(url.searchParams.get("page_size") || 20),
            total: 43,
            total_pages: 3,
          },
        });
      }
      return reply({});
    });
    const base = process.env.CMS_BASE_URL || "http://localhost:3000";
    await page.goto(base + "/cms/users");
    await page.getByRole("button", { name: "林晓", exact: true }).waitFor();
    await page.screenshot({
      path: path.join(output, "desktop-users.png"),
      fullPage: true,
    });
    const meCalls = calls.filter((url) => url === "/api/user/me").length;
    await page.getByRole("link", { name: "钱包管理", exact: true }).click();
    await page.waitForURL("**/cms/wallets");
    await page
      .getByRole("heading", { name: "钱包管理", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "扣减", exact: true })
      .first()
      .waitFor();
    await page.getByRole("link", { name: "用户管理", exact: true }).click();
    await page.waitForURL("**/cms/users");
    await page
      .getByRole("heading", { name: "用户管理", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "林晓", exact: true }).waitFor();
    assert.equal(await page.getByLabel("加载中", { exact: true }).count(), 0);
    assert.equal(
      calls.filter((url) => url === "/api/user/me").length,
      meCalls,
      "navigation must not recheck auth",
    );
    const beforeSearch = calls.filter((url) =>
      url.startsWith("/api/admin/users?"),
    ).length;
    await page.getByLabel("搜索关键词").fill("lin");
    await page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/users?") &&
        response.url().includes("keyword=lin"),
    );
    assert.equal(
      calls.filter((url) => url.startsWith("/api/admin/users?")).length,
      beforeSearch + 1,
    );
    await page.getByRole("link", { name: "钱包管理", exact: true }).click();
    await page.waitForURL("**/cms/wallets");
    await page
      .getByRole("heading", { name: "钱包管理", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "扣减", exact: true })
      .first()
      .waitFor();
    listDelay = 700;
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await page.waitForTimeout(100);
    assert.equal(
      await page.getByRole("button", { name: "林晓", exact: true }).count(),
      1,
      "refresh keeps visible rows",
    );
    await page
      .getByRole("button", { name: "刷新", exact: true })
      .waitFor({ state: "visible" });
    await page.waitForTimeout(800);
    failWalletList = true;
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "模拟网络错误" }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "林晓", exact: true }).count(),
      1,
    );
    failWalletList = false;
    listDelay = 50;
    await page.getByRole("button", { name: "重新加载", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "模拟网络错误" })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "扣减", exact: true })
      .first()
      .click();
    await page.getByLabel("扣减数量").fill("101");
    assert.equal(
      await page.getByRole("button", { name: "确认扣减" }).isDisabled(),
      true,
    );
    await page.getByLabel("扣减数量").fill("25");
    await page.getByLabel("扣减原因").fill("撤回重复赠送");
    await page.screenshot({ path: path.join(output, "desktop-deduction.png") });
    await page.getByRole("button", { name: "确认扣减" }).click();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("dialog", { name: "扣减用户算力" }).isVisible(),
      true,
    );
    await page
      .getByRole("dialog", { name: "扣减用户算力" })
      .getByRole("alert")
      .waitFor();
    assert.equal(await page.getByLabel("扣减数量").inputValue(), "25");
    failDeduction = false;
    await page.getByRole("button", { name: "确认扣减" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(deductions, [
      { amount: 25, credit_type: "PAID", reason: "撤回重复赠送" },
    ]);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(output, "desktop-wallets.png"),
      fullPage: true,
    });
    for (const width of [768, 375, 320]) {
      await page.setViewportSize({ width, height: 850 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
        `no horizontal overflow at ${width}px`,
      );
      await page.getByRole("button", { name: "打开导航菜单" }).click();
      await page
        .getByRole("dialog", { name: "后台导航菜单" })
        .getByRole("link", { name: "用户管理", exact: true })
        .click();
      await page.waitForURL("**/cms/users");
      await page
        .getByRole("heading", { name: "用户管理", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "林晓", exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("搜索关键词").inputValue(),
        "lin",
        "menu retains search",
      );
      await page.getByRole("button", { name: "筛选", exact: true }).click();
      assert.equal(await page.getByLabel("账号状态").isVisible(), true);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await page.getByRole("button", { name: "筛选", exact: true }).click();
      await page.screenshot({
        path: path.join(output, `users-${width}.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "打开导航菜单" }).click();
      await page
        .getByRole("dialog", { name: "后台导航菜单" })
        .getByRole("link", { name: "钱包管理", exact: true })
        .click();
      await page.waitForURL("**/cms/wallets");
      await page
        .getByRole("heading", { name: "钱包管理", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "扣减", exact: true })
        .first()
        .click();
      await page.getByLabel("扣减数量").fill("10");
      await page.getByLabel("扣减原因").fill("移动端布局验证");
      const submitBox = await page
        .getByRole("button", { name: "确认扣减" })
        .boundingBox();
      assert.ok(
        submitBox && submitBox.y + submitBox.height <= 850,
        "mobile action stays inside viewport",
      );
      await page.screenshot({
        path: path.join(output, `deduction-${width}.png`),
      });
      const dialog = page.getByRole("dialog", { name: "扣减用户算力" });
      assert.equal(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
        true,
      );
      await page.keyboard.press("Escape");
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("link", { name: "工作概览", exact: true }).click();
    await page.getByRole("heading", { name: "欢迎回来，管理员" }).waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(output, "desktop-overview.png"),
      fullPage: true,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(output, "dark-overview.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          result: "PASS",
          apiCalls: calls.length,
          deductions: deductions.length,
          screenshots: output,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
