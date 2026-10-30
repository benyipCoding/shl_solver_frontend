# FFXIV 分析器分享链接

浏览 `/ff14` 时，报告、战斗、玩家详情、时间轴对比对象、缩放、语言和移动端汇总显示模式会同步到地址栏。直接复制当前页面 URL 即可分享，接收方打开或刷新后会自动加载对应视图。

示例：`/ff14?report=QXfxpW6crMaAtm1C&fight=7&player=2`。

| 参数 | 含义 | 默认值 |
| --- | --- | --- |
| `report` | FFLogs 报告 ID | 空 |
| `fight` | 战斗 ID，兼容 `last` | 空 |
| `player` | 报告内玩家 ID；存在时打开技能详情 | 团队汇总 |
| `compare` | 参考报告 ID 与角色 ID，如 `Ref123:10` | 桌面全局时间轴 / 移动端首个样本 |
| `zoom` | 时间轴缩放级别索引 0–8 | 7，即 40px/s |
| `lang` | `zh` 或 `en` | `zh` |
| `values` | `1` 表示移动端显示 rDPS / aDPS | 仅柱状图 |

离散操作写入浏览器历史，支持前进/后退；Ctrl + 滚轮连续缩放替换当前历史项。默认值省略，无关查询参数和锚点保留。输入中的无效片段不写入 URL。切换报告或战斗会清除玩家和对比状态；返回汇总或切换玩家会清除对比和缩放状态。

URL 是浏览状态的来源。使用 Next.js 原生 History API 集成更新查询参数，避免纯视图切换重新请求报告。数据请求仍支持取消，分享参数在加载和错误期间保留；不存在的玩家显示说明及团队汇总，不会误打开其他玩家详情。支持 FFLogs 的 `?fight=7` 和旧版 `#fight=7` 输入。

验证：

```powershell
node --test utils/ff14-navigation.test.mjs
npx eslint app/ff14/page.tsx components/ff14/TopPlayersCard.tsx hooks/useFF14Navigation.ts utils/ff14-navigation.ts utils/ff14.ts
npx tsc --noEmit
```

启动本地前端后运行 `node scripts/ff14-navigation-smoke.cjs`，需要可用的 Playwright 和 Edge；可通过 `FF14_PLAYWRIGHT_MODULE`、`FF14_BROWSER` 和 `FF14_BASE_URL` 配置。测试拦截 API 并提供固定数据，覆盖桌面/移动端跨设备分享、刷新、历史导航、切换战斗、无效玩家、报告失败和过期请求。
