import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import type { LiquidityZone } from "./liquidity-zones";

export class LiquidityZonesPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: SeriesAttachedParameter<Time>["series"] | null = null;
  private requestUpdate: (() => void) | null = null;
  private zones: LiquidityZone[];
  private readonly views: IPrimitivePaneView[];

  constructor(zones: LiquidityZone[] = []) {
    this.zones = zones;
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) => target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
        if (!this.chart || !this.series) return;
        for (const zone of this.zones) {
          const y = this.series.priceToCoordinate(zone.price);
          if (y == null || y < -20 || y > mediaSize.height + 20) continue;
          const x = this.chart.timeScale().timeToCoordinate(zone.time as UTCTimestamp) ?? 0;
          const color = zone.side === "above" ? "#f59e0b" : "#38bdf8";
          const alpha = Math.min(0.75, 0.3 + zone.score / 220);
          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(Math.max(0, x), y);
          ctx.lineTo(mediaSize.width, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.font = "11px sans-serif";
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          const label = `${zone.side === "above" ? "上方" : "下方"}流动性 ${Math.round(zone.score)} · ${zone.touches}次`;
          const width = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
          ctx.fillRect(mediaSize.width - width - 12, y - 16, width + 8, 16);
          ctx.fillStyle = color;
          ctx.fillText(label, mediaSize.width - 8, y - 3);
          if (x >= 0 && x <= mediaSize.width) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 5, zone.side === "above" ? y - 9 : y + 9);
            ctx.lineTo(x + 5, zone.side === "above" ? y - 9 : y + 9);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
          }
          ctx.restore();
        }
      }),
    };
    this.views = [{ zOrder: () => "top", renderer: () => renderer }];
  }

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series;
    this.requestUpdate = requestUpdate;
    requestUpdate();
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews() { return this.views; }

  setZones(zones: LiquidityZone[]) {
    this.zones = zones;
    this.requestUpdate?.();
  }
}
