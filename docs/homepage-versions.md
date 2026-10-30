# 首页版本

首页 `/` 根据后端保存的全站配置渲染。第一版在 `components/home/HomeV1.tsx` 原样保留，第二版为 `HomeV2.tsx`。默认继续使用第一版；配置读取失败或超时也回退第一版，保证门户可用。

## 管理方式

使用超级管理员账号登录，进入 `/cms` → **首页版本管理**（`/cms/homepage`）。

1. 点击“预览此版本”在新标签页检查完整页面，预览不修改发布状态。
2. 点击“设为线上版本”，在确认框中启用。
3. 新访问或刷新首页即可看到所选版本。已经打开的首页不会强制刷新。
4. 使用相同操作可随时切回第一版。

预览地址为 `/cms/homepage/preview/1` 和 `/cms/homepage/preview/2`，沿用 CMS 管理员鉴权。普通用户和未登录用户不可通过后端发布接口更改配置。

第二版支持五个现有模块、分类筛选、`Ctrl/⌘ + K` 搜索、方向键与 Enter 启动、Esc 关闭，以及暂停动效。系统的减少动态效果偏好也会被遵守；粒子动画在离开视口或标签页隐藏时暂停。

## 部署

前后端需要一起更新。在 `shl-solver-backend` 使用该环境的 Python 执行：

```sh
python -m alembic upgrade head
```

新增迁移为 `b1c8d4e6f209`，在 `a7d3e5c1b902` 后增加 `homepage_config` 表，并初始化为第一版。不会修改已有用户、交易或其他业务数据。本次开发已在 localhost 的开发数据库执行该迁移；其他部署环境仍需执行。

前端通过既有 `API_BASE_URL`（或 `NEXT_PUBLIC_BASE_URL`）访问后端，无需增加环境变量。

## API 与一致性

- `GET /api_v1/site/homepage`：公开读取当前版本，不返回管理员信息。
- `GET /api_v1/admin/homepage`：超级管理员读取配置及修订号。
- `PATCH /api_v1/admin/homepage`：超级管理员提交 `active_version`（整数 1 或 2）和 `expected_revision`。
- Next.js 的 `/api/admin/homepage` 沿用既有代理和认证 Cookie。

发布原子更新修订号、操作人和更新时间。过期修订号返回 409，防止多个管理员相互覆盖。读取不缓存；发布失败后管理页面重新读取真实配置。

后端回归测试：`python -m unittest tests.test_homepage_versions -v`。测试在隔离 SQLite 数据库验证权限、持久化、回切、并发冲突、非法参数和迁移回退，不写业务数据库。
