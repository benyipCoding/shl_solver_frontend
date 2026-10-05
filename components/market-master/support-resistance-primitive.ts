import type {
  IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive,
  SeriesAttachedParameter, Time, UTCTimestamp,
} from "lightweight-charts";
import type { SupportResistanceZone } from "./support-resistance";

// Reserve green/red for orders; zones use a quieter blue/purple palette.
export const ZONE_COLORS = { support: "#60a5fa", resistance: "#c084fc" };

// Separate, read-only overlay: recalculating zones never modifies manual drawings.
export class SupportResistancePrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: SeriesAttachedParameter<Time>["series"] | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly views: IPrimitivePaneView[];

  constructor(private zones: SupportResistanceZone[]) {
    const renderer = (labelsOnly: boolean): IPrimitivePaneRenderer => ({
      draw: (target) => target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
        if (!this.chart || !this.series) return;
        let lastLabelY = Infinity;
        for (const zone of this.zones) {
          const upperY = this.series.priceToCoordinate(zone.upper);
          const lowerY = this.series.priceToCoordinate(zone.lower);
          if (upperY == null || lowerY == null) continue;
          const top = Math.min(upperY, lowerY);
          const bottom = Math.max(upperY, lowerY);
          if (bottom < 0 || top > mediaSize.height) continue;
          const coordinate = this.chart.timeScale().timeToCoordinate(zone.startTime as UTCTimestamp);
          const left = Math.max(0, coordinate ?? 0);
          const width = mediaSize.width - left;
          if (width <= 0) continue;
          const color = ZONE_COLORS[zone.role];
          const strength = Math.max(0, Math.min(1, (zone.score - 60) / 40));
          ctx.save();
          if (!labelsOnly) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.05 + strength * 0.1;
            ctx.fillRect(left, top, width, Math.max(1, bottom - top));
            ctx.globalAlpha = 0.35 + strength * 0.3;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.setLineDash(zone.status === "piercing" ? [5, 4] : []);
            ctx.strokeRect(left, top, width, Math.max(1, bottom - top));
            ctx.restore();
            continue;
          }
          ctx.globalAlpha = 1;
          ctx.font = "11px sans-serif";
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          const roleLabel = zone.role === "support" ? "支撑" : "阻力";
          const label = `${zone.label} ${roleLabel} · ${zone.score} 分`;
          const textWidth = ctx.measureText(label).width;
          const labelY = Math.max(16, Math.min(mediaSize.height - 4, top - 3, lastLabelY - 18));
          lastLabelY = labelY;
          ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
          ctx.fillRect(mediaSize.width - textWidth - 12, labelY - 14, textWidth + 8, 16);
          ctx.fillStyle = color;
          ctx.fillText(label, mediaSize.width - 8, labelY);
          ctx.restore();
        }
      }),
    });
    const background = renderer(false);
    const labels = renderer(true);
    this.views = [
      { zOrder: () => "bottom", renderer: () => background },
      { zOrder: () => "top", renderer: () => labels },
    ];
  }

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series;
    this.requestUpdate = requestUpdate;
    requestUpdate();
  }

  detached() {
    const repaint = this.requestUpdate;
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
    repaint?.();
  }

  paneViews() { return this.views; }

  setZones(zones: SupportResistanceZone[]) {
    this.zones = zones;
    this.requestUpdate?.();
  }
}
