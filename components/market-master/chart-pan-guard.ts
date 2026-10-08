/** Keep a chart's logical-index origin fixed for the entire pointer gesture. */
export function bindChartPanGuard(
  isChartTarget: (target: EventTarget | null) => boolean,
  onIdle: () => void,
) {
  const pointers = new Set<number>();
  const waiters = new Set<() => void>();
  let active = false;
  let frame: number | null = null;

  const releaseWaiters = () => {
    waiters.forEach((resolve) => resolve());
    waiters.clear();
  };
  const finish = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    // pointerup precedes the library's mouseup/touchend. Wait until its drag
    // snapshot has been released before replacing data or changing index origin.
    frame = requestAnimationFrame(() => {
      frame = null;
      if (pointers.size) return;
      active = false;
      releaseWaiters();
      onIdle();
    });
  };
  const down = (event: PointerEvent) => {
    if (!isChartTarget(event.target) || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pointers.add(event.pointerId);
    active = true;
  };
  const up = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId) || pointers.size) return;
    finish();
  };
  const blur = () => {
    if (!active) return;
    pointers.clear();
    finish();
  };
  const capture = { capture: true };
  document.addEventListener("pointerdown", down, capture);
  window.addEventListener("pointerup", up, capture);
  window.addEventListener("pointercancel", up, capture);
  window.addEventListener("blur", blur);
  return {
    isActive: () => active,
    whenIdle: () => active ? new Promise<void>((resolve) => waiters.add(resolve)) : Promise.resolve(),
    dispose: () => {
      document.removeEventListener("pointerdown", down, capture);
      window.removeEventListener("pointerup", up, capture);
      window.removeEventListener("pointercancel", up, capture);
      window.removeEventListener("blur", blur);
      if (frame !== null) cancelAnimationFrame(frame);
      pointers.clear();
      active = false;
      releaseWaiters();
    },
  };
}
