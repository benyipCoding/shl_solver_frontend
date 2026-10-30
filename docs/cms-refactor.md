# CMS 管理后台

## 交互

- 桌面侧栏、移动端抽屉导航；小屏列表使用卡片，筛选条件可展开。
- 菜单间保留列表、搜索、页码和每页条数。会话缓存 30 秒，离开 CMS 或更换登录用户后释放。
- 菜单切换先准备目标列表，再一次性显示真实数据；等待期间保留原页面。移除首次加载的表格骨架，直接打开页面时也不渲染临时小表格。超过 300ms 才显示不占布局空间的悬浮提示。
- 刷新保留当前结果，失败显示错误并允许重试；搜索防抖 300ms，较旧的请求不能覆盖新结果。
- 钱包支持充值付费算力，以及按免费 / 付费类型主动扣减。扣减需填写原因，确认前预览余额；余额不足时后端拒绝。
- 算力流水可筛选「管理员扣减」，详情包含操作人 ID 和原因。

## 部署

本次变更同时涉及 `shl-solver-frontend` 和 `shl-solver-backend`。发布新版后端前，在后端项目执行：

```powershell
.venv/Scripts/python.exe -m alembic upgrade head
```

新迁移为 `f9a4c2d71e60`，承接 `b1c8d4e6f209`，增加 `ADMIN_DEDUCT` 动作、流水操作人和原因字段。已有扣减记录时，迁移拒绝回滚删除审计字段。开发验证使用独立 SQLite 和模拟接口，没有对业务数据库执行迁移或扣减。

接口：`POST /admin/wallets/{user_id}/deduct`，需要已启用的超级管理员身份。

```json
{ "amount": 25, "credit_type": "PAID", "reason": "撤回重复发放的活动算力" }
```

指定类型余额不足返回 409；其他类型余额不会被挪用。钱包行锁、余额更新和审计流水属于同一事务。金额必须为正整数。

## 验证

前端：`npm run build`、`npx tsc --noEmit`、`node --test components/cms/data-store.test.mjs`。

后端：`.venv/Scripts/python.exe -m unittest discover -s tests -p test_admin_wallet_deduction.py -v`。

浏览器冒烟：先运行前端，使用已安装的 Playwright 执行 `node scripts/cms-smoke.cjs`。可通过 `CMS_PLAYWRIGHT_MODULE` 指定模块路径，`CMS_BASE_URL` 指定本地服务地址，`CMS_BROWSER` 指定浏览器通道（默认 `msedge`）。此测试在独立浏览器上下文拦截所有 `/api/` 请求，不访问实际用户数据。覆盖菜单、缓存、刷新失败、扣减成功 / 失败、手机导航、弹窗和 320 / 375 / 768 / 1440px 布局。截图默认写入临时目录 `cms-ui-review`。

SQLite 测试覆盖事务回滚和余额校验；生产数据库的 `FOR UPDATE` 并发锁行为需要在对应数据库环境验证。

菜单高度回归：`node scripts/cms-navigation-smoke.cjs`，使用相同 Playwright 环境配置。以 20 条数据在桌面 / 手机逐帧检查首次切换、慢请求提示以及快速连续切换，确保过程中不出现缩小的 loading 表格。
