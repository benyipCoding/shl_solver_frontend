import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as XLSX from "xlsx";
import type { SheetSnapshot } from "@/interfaces/excel_workbench";
import {
  COLUMN_WIDTH,
  HEADER_HEIGHT,
  ROW_HEADER_WIDTH,
  ROW_HEIGHT,
  resolveCellStyle,
  virtualRange,
} from "./workbook-model";

const MAX_SCROLL_HEIGHT = 8_000_000;
export function VirtualSheet({
  snapshot,
  sheetName,
}: {
  snapshot: SheetSnapshot;
  sheetName: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [viewport, setViewport] = useState({
    width: 900,
    height: 500,
    top: 0,
    left: 0,
  });
  useEffect(() => {
    const element = container.current!;
    const measure = () =>
      setViewport({
        width: element.clientWidth,
        height: element.clientHeight,
        top: element.scrollTop,
        left: element.scrollLeft,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);
  const totalHeight = HEADER_HEIGHT + snapshot.data.length * ROW_HEIGHT;
  const physicalHeight = Math.min(MAX_SCROLL_HEIGHT, totalHeight);
  const scrollRatio = Math.max(
    1,
    (totalHeight - viewport.height) /
      Math.max(1, physicalHeight - viewport.height),
  );
  const logicalTop = viewport.top * scrollRatio;
  const rows = virtualRange(
    snapshot.data.length,
    logicalTop,
    viewport.height - HEADER_HEIGHT,
    ROW_HEIGHT,
    6,
  );
  const cols = virtualRange(
    snapshot.columns.length,
    viewport.left,
    viewport.width - ROW_HEADER_WIDTH,
    COLUMN_WIDTH,
    2,
  );
  const visibleColumns = snapshot.columns.slice(cols.start, cols.end);
  const width = Math.max(
    viewport.width,
    ROW_HEADER_WIDTH + snapshot.columns.length * COLUMN_WIDTH,
  );

  const cell = (row: number, column: string) => {
    const style = resolveCellStyle(snapshot.styles, row, column);
    const css: CSSProperties = {
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontWeight: style.bold === undefined ? undefined : style.bold ? 700 : 400,
      fontStyle: style.italic ? "italic" : undefined,
      textDecoration: style.underline ? "underline" : undefined,
      // Excel stores points; enforce the preview minimum without changing export formatting.
      fontSize: Math.max(16, ((style.fontSize ?? 12) * 4) / 3),
      textAlign: style.horizontalAlignment,
    };
    const value = row < 0 ? column : snapshot.data[row][column];
    let text = value == null ? "" : String(value);
    if (row >= 0 && typeof value === "number" && style.numberFormat) {
      try {
        text = XLSX.SSF.format(style.numberFormat, value);
      } catch {
        /* Keep the raw value for unsupported formats. */
      }
    }
    return { css, text };
  };

  return (
    <div
      ref={container}
      role="grid"
      aria-label={`${sheetName} 数据表`}
      aria-rowcount={snapshot.data.length + 1}
      aria-colcount={snapshot.columns.length + 1}
      tabIndex={0}
      className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:bg-slate-900"
      onScroll={() => {
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const element = container.current;
          if (element)
            setViewport((previous) => ({
              ...previous,
              top: element.scrollTop,
              left: element.scrollLeft,
            }));
        });
      }}
    >
      <div
        style={{
          height: Math.max(physicalHeight, viewport.height),
          width,
          position: "relative",
        }}
      >
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          style={{ height: HEADER_HEIGHT, width }}
        >
          <div
            role="columnheader"
            className="sticky left-0 z-30 flex h-full items-center justify-center border-r border-slate-200 bg-slate-100 text-base dark:border-slate-700 dark:bg-slate-800"
            style={{ width: ROW_HEADER_WIDTH }}
          >
            #
          </div>
          {visibleColumns.map((column, index) => {
            const { css, text } = cell(-1, column);
            return (
              <div
                role="columnheader"
                aria-colindex={cols.start + index + 2}
                key={column}
                title={text}
                className="absolute top-0 truncate border-r border-slate-200 px-3 py-3 text-base font-semibold dark:border-slate-700"
                style={{
                  ...css,
                  height: HEADER_HEIGHT,
                  left: ROW_HEADER_WIDTH + (cols.start + index) * COLUMN_WIDTH,
                  width: COLUMN_WIDTH,
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
        {snapshot.data.slice(rows.start, rows.end).map((_, index) => {
          const row = rows.start + index;
          return (
            <div
              key={row}
              role="row"
              aria-rowindex={row + 2}
              className="absolute left-0 border-b border-slate-100 text-base text-slate-700 odd:bg-slate-50/60 hover:bg-emerald-50/40 dark:border-slate-800 dark:text-slate-200 dark:odd:bg-slate-800/20 dark:hover:bg-slate-800/60"
              style={{
                top:
                  HEADER_HEIGHT + row * ROW_HEIGHT - logicalTop + viewport.top,
                height: ROW_HEIGHT,
                width,
              }}
            >
              <div
                role="rowheader"
                className="sticky left-0 z-10 flex h-full items-center justify-center border-r border-slate-200 bg-slate-50 text-base tabular-nums text-slate-400 dark:border-slate-700 dark:bg-slate-900"
                style={{ width: ROW_HEADER_WIDTH }}
              >
                {row + 1}
              </div>
              {visibleColumns.map((column, c) => {
                const { css, text } = cell(row, column);
                return (
                  <div
                    key={column}
                    role="gridcell"
                    aria-colindex={cols.start + c + 2}
                    title={text}
                    className="absolute top-0 truncate border-r border-slate-100 px-3 dark:border-slate-800"
                    style={{
                      ...css,
                      height: ROW_HEIGHT,
                      lineHeight: `${ROW_HEIGHT}px`,
                      left: ROW_HEADER_WIDTH + (cols.start + c) * COLUMN_WIDTH,
                      width: COLUMN_WIDTH,
                    }}
                  >
                    {text || (
                      <span className="text-slate-300 dark:text-slate-600">
                        —
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
