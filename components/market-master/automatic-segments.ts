import {
  AutomaticPenTrend,
  type AutomaticPen,
  type AutomaticPenPoint,
} from "./automatic-pens";

export const AUTOMATIC_SEGMENTS_COLOR = "#00ff00";

export type AutomaticSegment = AutomaticPen;

function findSegmentEnd(
  rootPen: AutomaticPen,
  rootIndex: number,
  pens: readonly AutomaticPen[]
): number | undefined {
  let reference = rootPen;
  let endIndex: number | undefined;
  let isFirstTime = true;

  for (let i = rootIndex + 2; i < pens.length; i += 2) {
    const nextSameTrendPen = pens[i];
    const nextStartPrice = nextSameTrendPen.startPoint.price;
    const nextEndPrice = nextSameTrendPen.endPoint.price;

    const cannotGrow =
      rootPen.trend === AutomaticPenTrend.Up
        ? nextStartPrice < rootPen.startPoint.price
        : nextStartPrice > rootPen.startPoint.price;
    if (cannotGrow) return endIndex;

    if (endIndex !== undefined) {
      const reverseEndIndex = findSegmentEnd(pens[i - 1], i - 1, pens);
      if (reverseEndIndex !== undefined) return endIndex;
    }
    if (i - rootIndex < 4) continue;

    const canGrow1 =
      reference.trend === AutomaticPenTrend.Up
        ? (nextStartPrice > reference.startPoint.price ||
            nextStartPrice > rootPen.startPoint.price) &&
          nextEndPrice > reference.endPoint.price
        : (nextStartPrice < reference.startPoint.price ||
            nextStartPrice < rootPen.startPoint.price) &&
          nextEndPrice < reference.endPoint.price;
    if (canGrow1) {
      endIndex = i;
      reference = nextSameTrendPen;
      isFirstTime = false;
      continue;
    }

    const prevPen = pens[rootIndex - 1];
    if (!prevPen || !isFirstTime) continue;
    const canGrow2 =
      reference.trend === AutomaticPenTrend.Up
        ? reference.endPoint.price > prevPen.startPoint.price &&
          nextEndPrice > prevPen.startPoint.price
        : reference.endPoint.price < prevPen.startPoint.price &&
          nextEndPrice < prevPen.startPoint.price;
    if (canGrow2) {
      endIndex = i;
      reference = nextSameTrendPen;
      isFirstTime = false;
    }
  }

  return endIndex;
}

function fixSegmentGaps(segments: readonly AutomaticSegment[]) {
  const connected: AutomaticSegment[] = [];

  for (const segment of segments) {
    if (!connected.length) {
      connected.push({
        ...segment,
        startPoint: { ...segment.startPoint },
        endPoint: { ...segment.endPoint },
      });
      continue;
    }

    const previous = connected[connected.length - 1];
    if (
      previous.endPoint.price === segment.startPoint.price &&
      previous.endPoint.time === segment.startPoint.time
    ) {
      connected.push({
        ...segment,
        startPoint: { ...segment.startPoint },
        endPoint: { ...segment.endPoint },
      });
      continue;
    }

    if (segment.trend === previous.trend) {
      const rightContains =
        segment.trend === AutomaticPenTrend.Up
          ? segment.startPoint.price < previous.startPoint.price &&
            segment.endPoint.price > previous.endPoint.price
          : segment.startPoint.price > previous.startPoint.price &&
            segment.endPoint.price < previous.endPoint.price;
      const leftContains =
        segment.trend === AutomaticPenTrend.Up
          ? previous.startPoint.price < segment.startPoint.price &&
            previous.endPoint.price > segment.endPoint.price
          : previous.startPoint.price > segment.startPoint.price &&
            previous.endPoint.price < segment.endPoint.price;

      if (rightContains) {
        const beforePrevious = connected[connected.length - 2];
        if (beforePrevious) {
          beforePrevious.endPoint = {
            ...beforePrevious.endPoint,
            price: segment.startPoint.price,
            time: segment.startPoint.time,
          };
        }
        connected.pop();
        connected.push({
          ...segment,
          startPoint: { ...segment.startPoint },
          endPoint: { ...segment.endPoint },
        });
        continue;
      }
      if (leftContains) continue;

      const startPoints = [segment.startPoint, previous.startPoint].sort(
        (a, b) => a.price - b.price
      );
      const endPoints = [segment.endPoint, previous.endPoint].sort(
        (a, b) => a.price - b.price
      );
      const startPoint =
        segment.trend === AutomaticPenTrend.Up ? startPoints[0] : startPoints[1];
      const endPoint =
        segment.trend === AutomaticPenTrend.Up ? endPoints[1] : endPoints[0];
      connected.pop();
      connected.push({
        ...segment,
        startPoint: {
          ...segment.startPoint,
          price: startPoint.price,
          time: startPoint.time,
        },
        endPoint: {
          ...segment.endPoint,
          price: endPoint.price,
          time: endPoint.time,
        },
      });
      continue;
    }

    const sorted = [previous.endPoint, segment.startPoint].sort(
      (a, b) => a.price - b.price
    );
    const connection: AutomaticPenPoint =
      segment.trend === AutomaticPenTrend.Up ? sorted[0] : sorted[1];
    previous.endPoint = {
      ...previous.endPoint,
      price: connection.price,
      time: connection.time,
    };
    connected.push({
      ...segment,
      startPoint: {
        ...segment.startPoint,
        price: connection.price,
        time: connection.time,
      },
      endPoint: { ...segment.endPoint },
    });
  }

  return connected;
}

/** Segment confirmation and gap repair follow the legacy drawSegment path. */
export function generateAutomaticSegments(
  pens: readonly AutomaticPen[]
): AutomaticSegment[] {
  const segments: AutomaticSegment[] = [];
  for (let i = 0; i < pens.length; i++) {
    const endIndex = findSegmentEnd(pens[i], i, pens);
    if (endIndex === undefined) continue;
    segments.push({
      startPoint: pens[i].startPoint,
      endPoint: pens[endIndex].endPoint,
      trend: pens[i].trend,
    });
    i = endIndex;
  }
  return fixSegmentGaps(segments);
}
