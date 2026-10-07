# 自动画笔规则

已恢复原始 Pens 算法，成笔不使用 ATR 幅度过滤，也不设 15 根例外条件。

1. 只看 K 线实体：最高价取 `max(open, close)`，最低价取 `min(open, close)`，不使用影线。
2. 实体严格创新高时尝试形成向上 pen，严格创新低时尝试形成向下 pen；价格相等不触发。
3. 两端极值所在位置的距离 `|索引差| + 1 >= 5` 才建立或更新 pen。向上连接低点到高点，向下连接高点到低点；不要求连续 5 根阳线或阴线。
4. 同方向创新极值且跨度满足条件时延长当前 pen；反方向满足跨度条件时保存上一条，再开始反向 pen。
5. 最后一条也会画出，即使尚未反向确认，终点仍可能继续变化。

保留旧版处理顺序：同一根 K 线先检查实体新高，再检查实体新低；趋势建立或延伸后更新反向极值。纯横盘等待不会移动旧极值的位置。

点击工具栏按钮时分析当前可视范围的 K 线。后续逐 K 更新沿用最初的绘制起点，并保留空结果后能继续成笔、同根价格更新及多条新笔同步的修复。

默认最小跨度由 `AUTOMATIC_PENS_MIN_CANDLE_COUNT = 5` 控制。自动 segments 和分笔动能共用此生成器，因此同步使用旧规则生成的 pens。分笔动能本身的 ATR 比较规则保持不变。

测试：`node --test components/market-master/automatic-pens.test.mjs components/market-master/automatic-segments.test.mjs components/market-master/pen-momentum.test.mjs`。
