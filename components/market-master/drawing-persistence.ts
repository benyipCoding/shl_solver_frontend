export const DRAWINGS_STORAGE_KEY = "market-master:drawings:v1";

type StoredDrawings = { version: 1; symbols: Record<string, unknown[]> };

const readStore = (): StoredDrawings => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAWINGS_STORAGE_KEY) ?? "null");
    if (parsed?.version === 1 && parsed.symbols && typeof parsed.symbols === "object") {
      return parsed;
    }
  } catch {
    // Corrupt or unavailable storage falls back to an empty store.
  }
  return { version: 1, symbols: {} };
};

/** Drawings are price-based, so each symbol keeps its own set. */
export const loadSymbolDrawings = (symbol: string): unknown[] => {
  const shapes = readStore().symbols[symbol];
  return Array.isArray(shapes) ? shapes : [];
};

/** Returns false when the browser refused the write (e.g. quota exceeded). */
export const saveSymbolDrawings = (symbol: string, shapes: unknown[]) => {
  const store = readStore();
  if (shapes.length) store.symbols[symbol] = shapes;
  else delete store.symbols[symbol];
  try {
    localStorage.setItem(DRAWINGS_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
};
