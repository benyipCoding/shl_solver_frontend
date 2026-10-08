import type { IChartApi, IPrimitivePaneView, ISeriesPrimitive, SeriesAttachedParameter, Time } from "lightweight-charts";
import { AUTOMATIC_PENS_COLOR, type AutomaticPen, type AutomaticPenPoint } from "./automatic-pens";

/** A bounded overlay avoids LineSeries.setData rebuilding the chart time axis. */
export class AutomaticPensPrimitive implements ISeriesPrimitive<Time> {
  constructor(private projectTime?: (time: Time) => number | null) {}
  private chart: IChartApi | null = null;
  private series: SeriesAttachedParameter<Time>["series"] | null = null;
  private requestUpdate: (() => void) | null = null;
  private pens: readonly AutomaticPen[] = [];
  private readonly views: IPrimitivePaneView[] = [{
    zOrder: () => "normal",
    renderer: () => ({
      draw: (target) => target.useMediaCoordinateSpace(({ context }) => {
        if (!this.chart || !this.series || !this.pens.length) return;
        const coordinate = (point: AutomaticPenPoint) => {
          const x = this.projectTime?.(point.time) ?? this.chart!.timeScale().timeToCoordinate(point.time);
          const y = this.series!.priceToCoordinate(point.price);
          return x === null || y === null ? null : { x, y };
        };
        context.save();
        context.lineWidth = 2;
        context.strokeStyle = AUTOMATIC_PENS_COLOR;
        context.lineCap = "butt";
        context.lineJoin = "round";
        context.beginPath();
        for (const pen of this.pens) {
          const start = coordinate(pen.startPoint);
          const end = coordinate(pen.endPoint);
          if (!start || !end) continue;
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
        }
        context.stroke();
        context.restore();
      }),
    }),
  }];

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
    this.pens = [];
  }

  paneViews() { return this.views; }

  setPens(pens: readonly AutomaticPen[]) {
    this.pens = pens;
    this.requestUpdate?.();
  }
}
