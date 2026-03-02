import {
  ColorType,
  CrosshairMode,
  ChartOptions,
  DeepPartial,
  CandlestickSeriesPartialOptions,
} from "lightweight-charts";

export const DEFAULT_CHART_OPTIONS: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: "#ffffff" },
    textColor: "#333",
  },
  grid: {
    vertLines: { color: "#f0f3fa" },
    horzLines: { color: "#f0f3fa" },
  },
  crosshair: { mode: CrosshairMode.Normal },
  //   height: 600,
};

export const DEFAULT_CANDLESTICK_SERIES_OPTIONS: CandlestickSeriesPartialOptions =
  {
    upColor: "#ef5350",
    downColor: "#26a69a",
    borderVisible: false,
    wickUpColor: "#ef5350",
    wickDownColor: "#26a69a",
  };
