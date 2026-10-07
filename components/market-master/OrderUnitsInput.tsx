import { useEffect, useRef, useState } from "react";
import { Calculator, Minus, Plus, RotateCcw } from "lucide-react";

const PRESETS = [25, 50, 100, 200, 500, 1000];
const buttonClass = "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-600/70 bg-gray-800 text-sm text-gray-200 transition-colors hover:border-blue-400/50 hover:bg-gray-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export function OrderUnitsInput({ value, onChange, valid }: {
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    inputRef.current?.focus();
  };
  const adjust = (delta: number) => {
    const next = Math.max(1, (valid ? Number(value) : 0) + delta);
    if (Number.isSafeInteger(next)) choose(String(next));
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <label htmlFor="order-units" className="mb-1.5 block text-base text-gray-400">
        交易数量 (Units)
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="order-units"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="输入交易数量"
          aria-invalid={!valid}
          aria-describedby={!valid ? "order-units-error" : undefined}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-3 pr-12 font-mono text-lg text-white outline-none transition-colors focus:border-blue-500"
        />
        <button
          ref={toggleRef}
          type="button"
          aria-label="快捷数量面板"
          title="快捷数量"
          aria-expanded={open}
          aria-controls={open ? "order-units-calculator" : undefined}
          onClick={() => setOpen((previous) => !previous)}
          className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${open ? "bg-blue-500/15 text-blue-400" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}
        >
          <Calculator size={20} />
        </button>
        {open && (
          <div
            id="order-units-calculator"
            role="group"
            aria-label="快捷交易数量"
            className="absolute right-0 top-full z-40 mt-2 grid w-48 max-w-full grid-cols-2 gap-1.5 rounded-xl border border-gray-600 bg-gray-900 p-2 shadow-xl shadow-black/40"
          >
            <button type="button" aria-label="数量减 1" title="减 1" onClick={() => adjust(-1)} className={buttonClass}>
              <Minus size={16} />
            </button>
            <button type="button" aria-label="数量加 1" title="加 1" onClick={() => adjust(1)} className={buttonClass}>
              <Plus size={16} />
            </button>
            {PRESETS.map((units) => (
              <button
                key={units}
                type="button"
                aria-label={`设置数量为 ${units}`}
                aria-pressed={valid && Number(value) === units}
                onClick={() => choose(String(units))}
                className={`${buttonClass} font-mono aria-pressed:border-blue-500/60 aria-pressed:bg-blue-500/15 aria-pressed:text-blue-300`}
              >
                {units}
              </button>
            ))}
            <button type="button" onClick={() => choose("")} className={buttonClass}>
              清空
            </button>
            <button type="button" title="重置为 100" aria-label="重置数量为 100" onClick={() => choose("100")} className={buttonClass}>
              <RotateCcw size={13} /> 重置
            </button>
          </div>
        )}
      </div>
      {!valid && (
        <p id="order-units-error" className="mt-1.5 text-xs text-amber-300">
          请输入大于 0 的整数，或选择快捷数量
        </p>
      )}
    </div>
  );
}
