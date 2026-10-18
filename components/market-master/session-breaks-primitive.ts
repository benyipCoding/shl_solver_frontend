import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

type SessionCandle = { time?: number | null };

const dayKey = (time: number) => Math.floor(time / 86400);

const collectDailyBreaks = (candles: SessionCandle[]) => {
  const breaks: number[] = [];
  let previousDay: number | null = null;

  for (const candle of candles) {
    if (candle?.time == null) continue;
    const time = Number(candle?.time);
    if (!Number.isFinite(time)) continue;
    const currentDay = dayKey(time);
    if (previousDay !== null && currentDay !== previousDay) {
      breaks.push(time);
    }
    previousDay = currentDay;
  }

  return breaks;
};

/** Draws one dashed vertical marker at the first candle of every new UTC day. */
export class SessionBreaksPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private requestUpdate: (() => void) | null = null;
  private breakTimes: number[] = [];
  private enabled = false;
  private readonly view: IPrimitivePaneView;

  constructor() {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target: CanvasRenderingTarget2D) => {
        if (!this.chart || !this.enabled || !this.breakTimes.length) return;

        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          ctx.save();
          ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();

          for (const time of this.breakTimes) {
            const x = this.chart?.timeScale().timeToCoordinate(time as UTCTimestamp);
            if (x == null || x < -1 || x > mediaSize.width + 1) continue;
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, mediaSize.height);
          }

          ctx.stroke();
          ctx.restore();
        });
      },
    };

    this.view = {
      zOrder: () => "bottom",
      renderer: () => renderer,
    };
  }

  attached({ chart, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.requestUpdate = requestUpdate;
    requestUpdate();
  }

  detached() {
    this.chart = null;
    this.requestUpdate = null;
  }

  paneViews() {
    return [this.view];
  }

  setCandles(candles: SessionCandle[] = [], enabled = false) {
    this.enabled = enabled;
    this.breakTimes = enabled ? collectDailyBreaks(candles) : [];
    this.requestUpdate?.();
  }
}

