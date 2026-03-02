import {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

import type { CanvasRenderingTarget2D } from "fancy-canvas";

export interface Point {
  time: Time;
  price: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

// 渲染器：负责具体的 Canvas 绘制指令
export class TrendLineRenderer implements IPrimitivePaneRenderer {
  private _p1: PixelPoint | null;
  private _p2: PixelPoint | null;
  private _hoveredPoint: 1 | 2 | null;

  constructor(
    p1: PixelPoint | null,
    p2: PixelPoint | null,
    hoveredPoint: 1 | 2 | null
  ) {
    this._p1 = p1; // 像素坐标 {x, y}
    this._p2 = p2;
    this._hoveredPoint = hoveredPoint; // 1, 2, 或 null (代表是否悬浮在某个端点上)
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      if (!this._p1 || !this._p2) return;

      // 绘制线条
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2962FF"; // 蓝色
      ctx.beginPath();
      ctx.moveTo(this._p1.x, this._p1.y);
      ctx.lineTo(this._p2.x, this._p2.y);
      ctx.stroke();

      // 绘制端点操作柄 (如果有悬浮或拖拽状态)
      const drawHandle = (point: PixelPoint, isHovered: boolean) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, isHovered ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? "#1E88E5" : "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2962FF";
        ctx.stroke();
      };

      // 只要处于交互模式，就显示两个端点。当前被 hover 的端点会变大
      if (this._hoveredPoint !== null) {
        drawHandle(this._p1, this._hoveredPoint === 1);
        drawHandle(this._p2, this._hoveredPoint === 2);
      }
    });
  }
}

// 视图转换器：将 数据坐标(时间/价格) 转换为 像素坐标(x/y)
export class TrendLinePaneView implements IPrimitivePaneView {
  private _source: TrendLinePrimitive;

  constructor(source: TrendLinePrimitive) {
    this._source = source;
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._source.chart || !this._source.series) return null;

    // 时间转 X 坐标
    const x1 = this._source.chart
      .timeScale()
      .timeToCoordinate(this._source.p1.time);
    const x2 = this._source.chart
      .timeScale()
      .timeToCoordinate(this._source.p2.time);

    // 价格转 Y 坐标
    const y1 = this._source.series.priceToCoordinate(this._source.p1.price);
    const y2 = this._source.series.priceToCoordinate(this._source.p2.price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

    return new TrendLineRenderer(
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      this._source.hoveredPoint
    );
  }
}

// 图元主类：附加到图表的对象，管理数据和状态
export class TrendLinePrimitive implements ISeriesPrimitive {
  public p1: Point;
  public p2: Point;
  public hoveredPoint: 1 | 2 | null = null;
  public chart: IChartApi | null = null;
  public series: ISeriesApi<"Candlestick"> | null = null;
  public requestUpdate: (() => void) | null = null;

  private _paneViews: TrendLinePaneView[];

  constructor(p1: Point, p2: Point) {
    this.p1 = p1; // { time, price }
    this.p2 = p2;
    this.hoveredPoint = null;
    this._paneViews = [new TrendLinePaneView(this)];
  }

  attached({
    chart,
    series,
    requestUpdate,
  }: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chart = chart;
    this.series = series;
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews() {
    return this._paneViews;
  }

  // 更新点位并触发重绘
  updatePoint(index: 1 | 2, newPoint: Point) {
    if (index === 1) this.p1 = newPoint;
    if (index === 2) this.p2 = newPoint;
    if (this.requestUpdate) this.requestUpdate();
  }

  setHoveredPoint(pointIndex: 1 | 2 | null) {
    if (this.hoveredPoint !== pointIndex) {
      this.hoveredPoint = pointIndex;
      if (this.requestUpdate) this.requestUpdate();
    }
  }
}
