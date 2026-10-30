"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  compact?: boolean;
};

export function TimeframeSelect({ value, onChange, options, compact = false }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const isOpen = panelStyle !== null;

  const positionPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, 120), window.innerWidth - 24);
    const openAbove = rect.top >= 340;
    setPanelStyle({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: openAbove ? rect.top - 8 : rect.bottom + 8,
      transform: openAbove ? "translateY(-100%)" : undefined,
      width,
      maxHeight: Math.min(256, openAbove ? rect.top - 20 : window.innerHeight - rect.bottom - 20),
      zIndex: 160,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const selected = panelRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    (selected ?? panelRef.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node &&
          !triggerRef.current?.contains(event.target) &&
          !panelRef.current?.contains(event.target)) setPanelStyle(null);
    };
    const closeOnFocusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node &&
          !triggerRef.current?.contains(event.target) &&
          !panelRef.current?.contains(event.target)) setPanelStyle(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOnFocusOutside);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOnFocusOutside);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [isOpen]);

  const close = () => {
    setPanelStyle(null);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="K线周期"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        className={`flex min-w-0 items-center justify-between gap-1 border font-semibold text-gray-200 transition-colors hover:border-gray-600 focus:border-blue-500 focus:outline-none ${compact
          ? "h-11 w-full rounded-xl border-slate-700/80 bg-slate-800/80 px-2 text-sm shadow-sm"
          : "h-[50px] rounded-md border-gray-700 bg-gray-800 px-3 text-[15px] sm:h-[42px]"}`}
        onClick={() => isOpen ? setPanelStyle(null) : positionPanel()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            positionPanel();
          } else if (event.key === "Escape") close();
        }}
      >
        <span className="truncate">{options.find((option) => option.value === value)?.label ?? value}</span>
        <ChevronDown size={16} className="shrink-0 text-gray-500" />
      </button>
      {panelStyle && createPortal(
        <div
          ref={panelRef}
          id={id}
          role="listbox"
          aria-label="K线周期"
          className="fixed overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-2xl"
          style={panelStyle}
          onKeyDown={(event) => {
            const buttons = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus();
            } else if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "Tab") {
              close();
            }
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gray-800 focus:bg-gray-800 focus:outline-none"
              onClick={() => { onChange(option.value); close(); }}
            >
              <span className={option.value === value ? "text-blue-400 font-semibold" : "text-gray-200"}>{option.label}</span>
              {option.value === value && <Check size={14} className="text-blue-500" />}
            </button>
          ))}
        </div>, document.body,
      )}
    </>
  );
}
