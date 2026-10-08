export type AutomaticTradingConfig = {
  strategy: "pens";
  firstOrderMode: "units" | "amount" | "balancePercent";
  firstOrderUnits: number;
  firstOrderRiskAmount: number;
  firstOrderRiskPercent: number;
  addRiskPercent: number;
  shortExitEnabled: boolean;
  shortExitPercent: number;
  stopAtrMultiplier: number;
  minStopTicks: number;
  takeProfitR: number;
  stepCandles: number;
};

export const DEFAULT_AUTOMATIC_TRADING_CONFIG: AutomaticTradingConfig = {
  strategy: "pens", firstOrderMode: "units", firstOrderUnits: 100,
  firstOrderRiskAmount: 200, firstOrderRiskPercent: 2, addRiskPercent: 50,
  shortExitEnabled: true, shortExitPercent: 50,
  stopAtrMultiplier: 0.2, minStopTicks: 2, takeProfitR: 10, stepCandles: 1000,
};
export const AUTOMATIC_TRADING_STORAGE_KEY = "marketMasterAutomaticTradingConfig.v1";

export function automaticTradingConfigError(config: AutomaticTradingConfig): string | null {
  if (config.strategy !== "pens" || !["units", "amount", "balancePercent"].includes(config.firstOrderMode)) return "请选择有效的策略和首单仓位模式";
  const finite = (n: number) => typeof n === "number" && Number.isFinite(n);
  if (!Number.isSafeInteger(config.firstOrderUnits) || config.firstOrderUnits < 1) return "首单数量必须为正整数";
  if (!finite(config.firstOrderRiskAmount) || config.firstOrderRiskAmount <= 0) return "首单止损金额必须大于 0";
  if (!finite(config.firstOrderRiskPercent) || config.firstOrderRiskPercent <= 0 || config.firstOrderRiskPercent > 100) return "余额风险比例须大于 0 且不超过 100%";
  if (!finite(config.addRiskPercent) || config.addRiskPercent < 0 || config.addRiskPercent > 100) return "加仓比例须为 0–100%，0 表示不加仓";
  if (typeof config.shortExitEnabled !== "boolean") return "请选择是否启用短线减仓";
  if (!finite(config.shortExitPercent) || config.shortExitPercent <= 0 || config.shortExitPercent > 100) return "短线减仓比例须大于 0 且不超过 100%";
  if (!finite(config.stopAtrMultiplier) || config.stopAtrMultiplier < 0 || config.stopAtrMultiplier > 10) return "ATR 缓冲倍数须为 0–10";
  if (!Number.isSafeInteger(config.minStopTicks) || config.minStopTicks < 1 || config.minStopTicks > 1000) return "最小缓冲须为 1–1000 个报价单位";
  if (!finite(config.takeProfitR) || config.takeProfitR < 1 || config.takeProfitR > 100) return "止盈倍数须为 1–100";
  if (!Number.isSafeInteger(config.stepCandles) || config.stepCandles < 1 || config.stepCandles > 10000) return "单步推进数量须为 1–10000 根";
  return null;
}

export function readAutomaticTradingConfig(raw: string | null): AutomaticTradingConfig {
  try {
    const saved = JSON.parse(raw ?? "null");
    const config = { ...DEFAULT_AUTOMATIC_TRADING_CONFIG, ...saved };
    if (!automaticTradingConfigError(config)) return config;
  } catch { /* Corrupt preferences fall back to defaults. */ }
  return { ...DEFAULT_AUTOMATIC_TRADING_CONFIG };
}
