import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsRight, Loader2, LocateFixed } from "lucide-react";

import {
  groupMinutesByHour,
  minutesOfDayOf,
  pad2,
  toUtcDateInput,
  utcDateTimeToUnix,
} from "./chart-locate";

export type ChartLocateOptions = {
  /** Selectable date range (UTC, `YYYY-MM-DD`); undefined = unbounded. */
  minDate?: string;
  maxDate?: string;
  /** Bar times of day in minutes; empty for D1 and longer timeframes. */
  minutesOfDay: number[];
  /** Time at the centre of the chart, used as the initial selection. */
  initialTime: number;
  latestLabel: string;
};

type Props = {
  disabled?: boolean;
  getOptions: () => ChartLocateOptions | null;
  onJumpToLatest: () => Promise<void> | void;
  onJumpToTime: (unix: number) => Promise<void> | void;
};

const selectClass =
  "h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 outline-none focus:border-blue-500 disabled:opacity-40";

export function ChartLocatePopover({ disabled = false, getOptions, onJumpToLatest, onJumpToTime }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [options, setOptions] = useState<ChartLocateOptions | null>(null);
  const [date, setDate] = useState("");
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);

  const byHour = useMemo(() => groupMinutesByHour(options?.minutesOfDay ?? []), [options]);
  const hours = useMemo(() => [...byHour.keys()], [byHour]);
  const minutes = byHour.get(hour) ?? [0];
  const intraday = hours.length > 0;

  const openPanel = () => {
    const next = getOptions();
    if (!next) return;
    setOptions(next);
    setDate(toUtcDateInput(next.initialTime));
    // Start from the bar time closest to the chart centre's time of day.
    const initialMinutes = minutesOfDayOf(next.initialTime);
    const closest = next.minutesOfDay.reduce<number | null>((best, value) =>
      best == null || Math.abs(value - initialMinutes) < Math.abs(best - initialMinutes) ? value : best, null);
    setHour(Math.floor((closest ?? 0) / 60));
    setMinute((closest ?? 0) % 60);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = panelRef.current?.offsetWidth ?? 288;
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = async (action: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await action();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const target = utcDateTimeToUnix(date, intraday ? hour * 60 + minute : 0);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        disabled={disabled}
        aria-label="定位K线"
        aria-expanded={open}
        className={`flex items-center rounded-md p-2.5 transition-colors sm:p-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${
          open ? "bg-gray-700 text-blue-400" : "text-gray-400 hover:bg-gray-700 hover:text-blue-300"
        }`}
        title="定位：跳到最新K线，或跳到指定日期时间"
      >
        <LocateFixed size={20} />
      </button>
      {open && options && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="定位K线"
          style={{ top: position.top, left: position.left }}
          className="fixed z-[60] w-72 rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-sm text-slate-200 shadow-2xl backdrop-blur"
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onJumpToLatest)}
            className="flex w-full items-center justify-between rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 font-semibold text-blue-200 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
          >
            <span>{options.latestLabel}</span>
            <ChevronsRight size={16} />
          </button>

          <div className="my-3 h-px bg-slate-800" />

          <div className="space-y-2">
            <div className="text-xs text-slate-400">跳转到指定时间（UTC，与图表时间轴一致）</div>
            <input
              type="date"
              aria-label="日期"
              value={date}
              min={options.minDate}
              max={options.maxDate}
              // Pick from the calendar only; typed partial dates are ignored.
              onKeyDown={(event) => { if (event.key !== "Tab") event.preventDefault(); }}
              onClick={(event) => { try { event.currentTarget.showPicker(); } catch { /* unsupported */ } }}
              onChange={(event) => { if (event.target.value) setDate(event.target.value); }}
              className={`${selectClass} w-full cursor-pointer [color-scheme:dark]`}
            />
            {intraday && (
              <div className="flex items-center gap-2">
                <select
                  aria-label="小时"
                  value={hour}
                  onChange={(event) => {
                    const nextHour = Number(event.target.value);
                    setHour(nextHour);
                    const available = byHour.get(nextHour) ?? [0];
                    if (!available.includes(minute)) setMinute(available[0]);
                  }}
                  className={`${selectClass} flex-1`}
                >
                  {hours.map((value) => <option key={value} value={value}>{pad2(value)} 时</option>)}
                </select>
                <span className="text-slate-500">:</span>
                <select
                  aria-label="分钟"
                  value={minute}
                  onChange={(event) => setMinute(Number(event.target.value))}
                  disabled={minutes.length <= 1}
                  className={`${selectClass} flex-1`}
                >
                  {minutes.map((value) => <option key={value} value={value}>{pad2(value)} 分</option>)}
                </select>
              </div>
            )}
            <button
              type="button"
              disabled={busy || target == null}
              onClick={() => target != null && run(() => onJumpToTime(target))}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-blue-600 font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              跳转
            </button>
            <p className="text-xs leading-5 text-slate-500">
              没有该时间的K线时（休市、半日市）会跳到最接近的K线。
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
