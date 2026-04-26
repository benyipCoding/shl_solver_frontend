type TradeRecord = {
  pnl: number;
  reason?: string;
};

type Candle = {
  time: number;
  high: number;
  low: number;
  close: number;
};

type InsightZone = {
  p1: { time: number; price: number };
  p2: { time: number; price: number };
};

type ChartInsightResult =
  | {
      ok: false;
      message: string;
    }
  | {
      ok: true;
      report: string;
      zones: {
        resistance: InsightZone;
        support: InsightZone;
      };
    };

export const MOCK_AI_DELAY_MS = {
  singleTrade: 1800,
  profile: 2500,
  chart: 2500,
};

export const PROFILE_MIN_CLOSED_TRADES = 3;

export const AI_ZONE_STYLES = {
  resistance: {
    fillBaseColor: "#ef5350",
    color: "#ef5350",
    lineWidth: 1,
  },
  support: {
    fillBaseColor: "#26a69a",
    color: "#26a69a",
    lineWidth: 1,
  },
};

export const PROFILE_INSUFFICIENT_TEXT =
  "⚠️ AI 提示：\n由于你需要分析交易习惯，系统需要至少 **3 笔已平仓**的交易记录来提取你的操作特征。\n\n请继续在模拟环境中进行交易，积累足够的数据后再来生成画像报告。";

export const CHART_DATA_INSUFFICIENT_TEXT = "K线数据不足，无法进行AI扫描。";

export function buildSingleTradeDiagnosis(trade: TradeRecord) {
  const isWin = trade.pnl > 0;
  if (isWin) {
    if (trade.reason === "TP Hit") {
      return "🤖 AI 深度诊断：\n这是一笔非常完美的交易！\n\n你不仅准确预判了市场方向，并且严格执行了交易计划（触及止盈离场）。这种“计划你的交易，交易你的计划”的纪律性是长期稳定盈利的核心。建议回顾入场时的 K 线形态和指标状态，将其固化为你的高胜率标准交易模型。\n\n综合评级：⭐⭐⭐⭐⭐ (S级)";
    }
    return "🤖 AI 深度诊断：\n不错的盈利单，但在执行上有一点小瑕疵。\n\n系统检测到你是手动提前平仓的，这意味着你未能让利润奔跑到原定的 TP（止盈）目标。这通常是由于盘中价格波动导致的“落袋为安”的恐慌心理。建议复盘平仓后的图表，看看行情是否最终到达了你的目标位，以此来锻炼自己的持仓心态。\n\n综合评级：⭐⭐⭐⭐ (A级)";
  }

  if (trade.reason === "SL Hit") {
    return "🤖 AI 深度诊断：\n这笔交易触及了止损，但请不要气馁！\n\n严格执行止损是职业交易员和业余玩家的最大区别，你成功保护了本金安全，避免了深套。对于这笔亏损，建议复盘两点：\n1. 入场点是否处于胜率较低的震荡区间中间位置？\n2. 止损距离是否设置过窄，导致被市场正常波动扫掉（俗称洗盘）？\n\n综合评级：⭐⭐⭐ (B+级)";
  }

  return "🤖 AI 深度诊断：\n你选择了手动斩仓，及时截断了亏损。\n\n果断手动平仓说明你在盘中察觉到了原始的入场逻辑已经被破坏。虽然结果是亏损，但这是一种主动的风险控制行为。建议下次在开仓前，更耐心地等待绝佳的技术共振信号（如 EMA 均线支撑与 MACD 金叉的配合），进一步提高开仓胜率。\n\n综合评级：⭐⭐⭐ (B级)";
}

export function buildProfileDiagnosis(closedTrades: TradeRecord[]) {
  const wins = closedTrades.filter((t) => t.pnl > 0);
  const winRate = ((wins.length / closedTrades.length) * 100).toFixed(1);
  const totalPnl = closedTrades.reduce((acc, t) => acc + t.pnl, 0).toFixed(2);
  const manualCloses = closedTrades.filter(
    (t) => t.reason === "Market Close"
  ).length;

  let profileText = `📊 **数据统计**\n• 总交易笔数: ${closedTrades.length} 笔\n• 胜率: ${winRate}%\n• 累计盈亏: $${totalPnl}\n• 手动干预次数: ${manualCloses} 笔\n\n`;
  profileText += "🧠 **AI 行为特征提取**\n";

  if (Number(winRate) > 60 && Number(totalPnl) > 0) {
    profileText +=
      "你展现出了极佳的交易直觉和顺势能力。较高的胜率说明你的入场时机把握得当。\n";
  } else if (Number(winRate) > 50 && Number(totalPnl) < 0) {
    profileText +=
      "【警报】典型的“盈亏比失衡”！你的胜率尚可，但总体亏损，说明你总是“赢点小钱就跑，亏了大钱死扛”。请务必坚持设置止损！\n";
  } else {
    profileText +=
      "当前交易系统尚未稳定。胜率偏低可能意味着你在频繁地逆势抄底摸顶。建议放宽时间周期（如切换到 H4 级别），等待明确的趋势确立后再进场。\n";
  }

  if (manualCloses > closedTrades.length * 0.5) {
    profileText +=
      "\n💡 **心理状态分析**\n你非常频繁地进行手动平仓（未触及 SL/TP），这反映出你可能在盘中容易受到价格波动的惊吓，缺乏持仓耐心。建议：一旦下单设定好止损止盈，就关掉图表，让概率为你工作。";
  }

  return profileText;
}

export function buildChartInsight(
  data: Candle[],
  currentIndex: number,
  priceDecimals: number,
  windowSize: number = 50
): ChartInsightResult {
  const startIndex = Math.max(0, currentIndex - windowSize);
  const recentData = data.slice(startIndex, currentIndex);
  const currentCandle = recentData[recentData.length - 1];

  if (!currentCandle || recentData.length < 10) {
    return {
      ok: false,
      message: CHART_DATA_INSUFFICIENT_TEXT,
    };
  }

  let maxCandle = recentData[0];
  let minCandle = recentData[0];
  recentData.forEach((d: Candle) => {
    if (d.high > maxCandle.high) maxCandle = d;
    if (d.low < minCandle.low) minCandle = d;
  });

  const leftTime = recentData[0].time;
  const rightTime = currentCandle.time;
  const resistanceTolerance = maxCandle.high * 0.001;
  const supportTolerance = minCandle.low * 0.001;

  const trendText =
    currentCandle.close > minCandle.low + (maxCandle.high - minCandle.low) * 0.5
      ? "多头占优（当前价格运行在近期波动区间上半轴）"
      : "空头占优（当前价格运行在近期波动区间下半轴）";

  const report =
    `🤖 **AI 盘面视觉深度扫描完成**\n\n` +
    `📊 **大局观趋势**：${trendText}\n\n` +
    `🎯 **关键博弈区域提取**：\n` +
    `• 上方强阻力区：已在图表自动标记红色矩形区间 (约 ${maxCandle.high.toFixed(priceDecimals)} 附近)\n` +
    `• 下方强支撑区：已在图表自动标记绿色矩形区间 (约 ${minCandle.low.toFixed(priceDecimals)} 附近)\n\n` +
    `💡 **形态识别与策略建议**：\n` +
    `通过扫描近 50 根 K 线的微观结构，AI 察觉到价格波幅正在测试边界。目前价格运行在关键支撑与阻力之间，属于“盈亏比非对称区”。\n\n` +
    `**执行建议**：在价格未有效突破上方红色阻力区，或未跌破下方绿色支撑区前，建议维持“高抛低吸”的震荡区间思维；一旦出现实体 K 线强力突破边界，可切换为“顺势跟进”模型。`;

  return {
    ok: true,
    report,
    zones: {
      resistance: {
        p1: { time: leftTime, price: maxCandle.high + resistanceTolerance },
        p2: { time: rightTime, price: maxCandle.high - resistanceTolerance },
      },
      support: {
        p1: { time: leftTime, price: minCandle.low + supportTolerance },
        p2: { time: rightTime, price: minCandle.low - supportTolerance },
      },
    },
  };
}
