// 分笔动能暂时停用，保留原实现供日后恢复；恢复步骤见 components/market-master/pen-momentum.md。
// import { useEffect, useRef, useState, type RefObject } from "react";
// import type { CandlestickData, ISeriesApi, Time } from "lightweight-charts";
// import { calculatePenMomentum, type PenMomentumConfig, type PenMomentumSnapshot } from "@/components/market-master/pen-momentum";
// import { PenMomentumPrimitive } from "@/components/market-master/pen-momentum-primitive";

// export function usePenMomentum({ seriesRef, config, ready, marketKey }: {
//   seriesRef: RefObject<ISeriesApi<"Candlestick", Time> | null>;
//   config: PenMomentumConfig;
//   ready: boolean;
//   marketKey: string;
// }) {
//   const primitiveRef = useRef<PenMomentumPrimitive | null>(null);
//   const [result, setResult] = useState<{ key: string; snapshot: PenMomentumSnapshot } | null>(null);
//   const [direction, setDirection] = useState<"up" | "down">("up");
//   const key = `${marketKey}:${ready}:${JSON.stringify(config)}`;
//   const snapshot = ready && config.enabled && result?.key === key ? result.snapshot : null;
//   const selectedPair = snapshot?.[direction] ?? snapshot?.up ?? snapshot?.down ?? null;

//   // This hook must be called after the page's chart-creation effect. Read only
//   // series.data(): fullDataRef can contain candles not yet revealed in replay.
//   useEffect(() => {
//     const series = seriesRef.current;
//     if (!ready || !config.enabled || !series) return;
//     const primitive = new PenMomentumPrimitive();
//     primitiveRef.current = primitive;
//     series.attachPrimitive(primitive);
//     let frame: number | null = null;
//     const refresh = () => {
//       if (frame !== null) cancelAnimationFrame(frame);
//       frame = requestAnimationFrame(() => {
//         frame = null;
//         const candles = series.data().filter((bar): bar is CandlestickData<Time> => "open" in bar);
//         setResult({ key, snapshot: calculatePenMomentum(candles, config) });
//       });
//     };
//     series.subscribeDataChanged(refresh);
//     refresh();
//     return () => {
//       if (frame !== null) cancelAnimationFrame(frame);
//       if (primitive.isAttached) {
//         series.unsubscribeDataChanged(refresh);
//         series.detachPrimitive(primitive);
//       }
//       if (primitiveRef.current === primitive) primitiveRef.current = null;
//     };
//   }, [seriesRef, config, ready, key]);

//   useEffect(() => { primitiveRef.current?.setPair(selectedPair); }, [selectedPair]);
//   return { snapshot, selectedPair, selectDirection: setDirection };
// }
