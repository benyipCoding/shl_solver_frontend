// 分笔动能暂时停用，保留原实现供日后恢复；恢复步骤见 components/market-master/pen-momentum.md。
// import type { IChartApi, IPrimitivePaneView, ISeriesPrimitive, SeriesAttachedParameter, Time } from "lightweight-charts";
// import type { AutomaticPenPoint } from "./automatic-pens";
// import type { PenMomentumPair } from "./pen-momentum";

// /** Read-only highlighting; never changes the chart's price scale or user drawings. */
// export class PenMomentumPrimitive implements ISeriesPrimitive<Time> {
//   private chart: IChartApi | null = null;
//   private series: SeriesAttachedParameter<Time>["series"] | null = null;
//   private requestUpdate: (() => void) | null = null;
//   private pair: PenMomentumPair | null = null;
//   private readonly views: IPrimitivePaneView[] = [{
//     zOrder: () => "top",
//     renderer: () => ({
//       draw: (target) => target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
//         if (!this.chart || !this.series || !this.pair) return;
//         const pair = this.pair;
//         const coordinate = (point: AutomaticPenPoint) => {
//           const x = this.chart!.timeScale().timeToCoordinate(point.time);
//           const y = this.series!.priceToCoordinate(point.price);
//           return x === null || y === null ? null : { x, y };
//         };
//         const aStart = coordinate(pair.previous.startPoint);
//         const a = coordinate(pair.previous.endPoint);
//         const bStart = coordinate(pair.current.startPoint);
//         const b = coordinate(pair.current.endPoint);
//         if (!a || !b) return;
//         const color = pair.weak === true ? "#fbbf24" : "#a78bfa";
//         ctx.save();
//         ctx.lineWidth = 3;
//         for (const [start, end, stroke] of [[aStart, a, "#38bdf8"], [bStart, b, color]] as const) {
//           if (!start) continue;
//           ctx.strokeStyle = stroke;
//           ctx.setLineDash(end === b && pair.developing ? [6, 4] : []);
//           ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
//         }
//         ctx.lineWidth = 1.5;
//         ctx.strokeStyle = color;
//         ctx.setLineDash([4, 4]);
//         ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
//         ctx.setLineDash([]);
//         ctx.font = "bold 11px sans-serif";
//         ctx.textAlign = "center";
//         ctx.textBaseline = "middle";
//         for (const [point, text, fill] of [[a, "A", "#38bdf8"], [b, "B", color]] as const) {
//           if (point.x < 0 || point.x > mediaSize.width || point.y < 0 || point.y > mediaSize.height) continue;
//           ctx.fillStyle = fill;
//           ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
//           ctx.fillText(text, point.x, Math.max(10, Math.min(mediaSize.height - 10, point.y + (pair.trend === 1 ? -15 : 15))));
//         }
//         ctx.restore();
//       }),
//     }),
//   }];

//   get isAttached() { return this.series !== null; }
//   attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
//     this.chart = chart; this.series = series; this.requestUpdate = requestUpdate;
//     requestUpdate();
//   }
//   detached() { this.chart = null; this.series = null; this.requestUpdate = null; }
//   paneViews() { return this.views; }
//   setPair(pair: PenMomentumPair | null) { this.pair = pair; this.requestUpdate?.(); }
// }
