import { CandlestickData, Time } from "lightweight-charts";

// ==========================================
// 模拟 K 线数据生成器
// ==========================================
export function generateMockData(): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  // 对齐到 UTC 零点避免 timescale 警告
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  let time = (Math.floor(d.getTime() / 1000) - 100 * 86400) as Time;
  let close = 100;

  for (let i = 0; i < 100; i++) {
    const open = close + (Math.random() - 0.5) * 5;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    close = open + (Math.random() - 0.5) * 5;
    // @ts-ignore
    data.push({ time: (time + i * 86400) as Time, open, high, low, close });
  }
  return data;
}
