import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { TradePosition } from "./trade-management";

/** A hover-only overlay: no extra time-scale points, price range or hit targets. */
export class TradeConnectionPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<"Candlestick"> | null = null;
  private requestUpdate: (() => void) | null = null;
  private trade: TradePosition | null = null;
  private view = {
    zOrder: () => "top" as const,
    renderer: () => ({
      draw: (target: CanvasRenderingTarget2D) => this.draw(target),
    }),
  };

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series as ISeriesApi<"Candlestick">;
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
    this.trade = null;
  }

  paneViews() {
    return [this.view];
  }

  setTrade(trade: TradePosition | null) {
    const next = trade?.status === "Closed" ? trade : null;
    if (this.trade === next) return;
    this.trade = next;
    this.requestUpdate?.();
  }

  private draw(target: CanvasRenderingTarget2D) {
    const trade = this.trade;
    if (
      !trade ||
      !this.chart ||
      !this.series ||
      trade.closeTime == null ||
      trade.closePrice == null
    )
      return;
    const x1 = this.chart.timeScale().timeToCoordinate(trade.entryTime as Time);
    const x2 = this.chart.timeScale().timeToCoordinate(trade.closeTime as Time);
    const y1 = this.series.priceToCoordinate(trade.entry);
    const y2 = this.series.priceToCoordinate(trade.closePrice);
    if (x1 == null || x2 == null || y1 == null || y2 == null) return;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }
}
