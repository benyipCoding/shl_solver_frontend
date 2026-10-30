"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Sparkles, Zap } from "lucide-react";
import type { Model } from "@/interfaces/shl_solver";

type Props = {
  models: Model[];
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
};

const providers = [
  { key: "gemini", label: "Gemini", Icon: Sparkles },
  { key: "openai", label: "OpenAI", Icon: Bot },
] as const;

export default function ModelSelector({ models, value, onChange, disabled = false }: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selected = models.find((model) => model.id === value);
  const unavailable = disabled || models.length === 0;

  // An analysis starting while the menu is open should also close the menu.
  if (unavailable && isOpen) setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;

    const selectedOption = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    const firstOption = listRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
    (selectedOption ?? firstOption)?.focus({ preventScroll: true });

    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isOpen]);

  const closeAndFocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative min-w-0 flex-1 md:w-60 md:flex-none lg:w-64"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`分析 AI 模型：${selected?.name ?? "加载中"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-list` : undefined}
        disabled={unavailable}
        title={selected ? `${selected.name} · ${selected.cost_credits} 算力点/次` : "加载模型中"}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={`group flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 ${
          isOpen
            ? "border-indigo-300 bg-indigo-50/70 dark:border-indigo-500/60 dark:bg-indigo-500/10"
            : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800"
        }`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20">
          {selected?.provider === "openai" ? <Bot className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-5 text-slate-800 md:text-sm dark:text-slate-100">
          {selected?.name ?? "加载模型中…"}
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180 text-indigo-500 dark:text-indigo-300" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 ring-1 ring-black/5 md:left-auto md:right-0 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/5">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span id={`${id}-label`} className="text-sm font-semibold text-slate-800 dark:text-slate-100">选择分析模型</span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"><Zap className="h-3 w-3" aria-hidden="true" />算力 / 次</span>
          </div>
          <div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="custom-scrollbar max-h-[min(28rem,calc(100dvh-12rem))] space-y-2 overflow-y-auto overscroll-contain p-2"
            onKeyDown={(event) => {
              const options = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
              const index = options.indexOf(document.activeElement as HTMLButtonElement);
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
                  : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
                options[next]?.focus({ preventScroll: true });
                options[next]?.scrollIntoView({ block: "nearest" });
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeAndFocus();
              } else if (event.key === "Tab") {
                closeAndFocus();
              }
            }}
          >
            {providers.map(({ key, label, Icon }) => {
              const options = models.filter((model) => model.provider === key);
              if (!options.length) return null;
              return (
                <div key={key} role="group" aria-labelledby={`${id}-${key}`}>
                  <div id={`${id}-${key}`} className="flex items-center gap-2 px-2.5 pb-1.5 pt-2 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                    <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${key === "openai" ? "text-emerald-500 dark:text-emerald-400" : "text-indigo-500 dark:text-indigo-400"}`} />
                    {label}
                  </div>
                  <div className="space-y-1">
                    {options.map((model) => {
                      const isSelected = model.id === value;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={-1}
                          onClick={() => { onChange(model.id); closeAndFocus(); }}
                          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 dark:focus-visible:ring-indigo-400 ${
                            isSelected
                              ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/35 dark:bg-indigo-500/15 dark:text-indigo-200"
                              : "border-transparent text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-950" : "border-slate-300 dark:border-slate-600"}`}>
                            {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{model.name}</span>
                          {model.is_default && <span className="shrink-0 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300">默认</span>}
                          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${isSelected ? "bg-white/80 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                            {model.cost_credits}<span className="ml-0.5 text-[10px] font-normal">点</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
