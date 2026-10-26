import type { MarketDataMode } from "./realtime-data";

// History and realtime serve different purposes, so each keeps its own drawings.
export const drawingsStorageKey = (mode: MarketDataMode) =>
  `market-master:drawings:${mode}:v1`;
// Before the split all drawings shared one store; they now belong to history.
const LEGACY_DRAWINGS_STORAGE_KEY = "market-master:drawings:v1";

type StoredDrawings = { version: 1; symbols: Record<string, unknown[]> };

const parseStore = (raw: string | null): StoredDrawings | null => {
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (parsed?.version === 1 && parsed.symbols && typeof parsed.symbols === "object") {
      return parsed;
    }
  } catch {
    // Corrupt storage falls back to an empty store.
  }
  return null;
};

const readStore = (mode: MarketDataMode): StoredDrawings => {
  try {
    const raw = localStorage.getItem(drawingsStorageKey(mode));
    if (raw == null && mode === "history") {
      const legacy = parseStore(localStorage.getItem(LEGACY_DRAWINGS_STORAGE_KEY));
      if (legacy) return legacy;
    }
    return parseStore(raw) ?? { version: 1, symbols: {} };
  } catch {
    // Unavailable storage falls back to an empty store.
    return { version: 1, symbols: {} };
  }
};

/** Drawings are price-based, so each symbol keeps its own set. */
export const loadSymbolDrawings = (mode: MarketDataMode, symbol: string): unknown[] => {
  const shapes = readStore(mode).symbols[symbol];
  return Array.isArray(shapes) ? shapes : [];
};

/** Returns false when the browser refused the write (e.g. quota exceeded). */
export const saveSymbolDrawings = (
  mode: MarketDataMode,
  symbol: string,
  shapes: unknown[]
) => {
  const store = readStore(mode);
  if (shapes.length) store.symbols[symbol] = shapes;
  else delete store.symbols[symbol];
  try {
    localStorage.setItem(drawingsStorageKey(mode), JSON.stringify(store));
    if (mode === "history") localStorage.removeItem(LEGACY_DRAWINGS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};
