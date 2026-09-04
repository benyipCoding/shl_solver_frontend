"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Search,
  Star,
  X,
} from "lucide-react";
import { useFetch } from "@/context/FetchContext";

const PANEL_MIN_WIDTH = 200;
const PANEL_MAX_HEIGHT = 320;
const PANEL_GAP = 8;
const VIEWPORT_PADDING = 12;

export const FAVORITES_STORAGE_KEY = "marketMasterFavorites";
export const LAST_SYMBOL_STORAGE_KEY = "marketMasterLastSymbol";
const FAVORITES_CHANGED_EVENT = "marketMasterFavoritesChanged";

/** 初次登录默认喜爱列表：黄金、美元指数、英镑、欧元、布伦特原油、比特币 */
export const INITIAL_FAVORITES = [
  "XAU/USD",
  "USDOLLAR",
  "GBP/USD",
  "EUR/USD",
  "UKOil",
  "BTC/USD",
];

const LEGACY_SYMBOL_MAP: Record<string, string> = {
  "XBR/USD": "UKOil",
  "XTI/USD": "USOil",
  DXY: "USDOLLAR",
  DJI: "US30",
  NDX: "NAS100",
  SPX: "SPX500",
};

const toCanonicalSymbol = (symbol: string) => {
  const trimmedSymbol = symbol.trim();
  if (!trimmedSymbol) {
    return trimmedSymbol;
  }

  return LEGACY_SYMBOL_MAP[trimmedSymbol.toUpperCase()] || trimmedSymbol;
};

const normalizeFavorites = (symbols: string[]) => {
  const nextFavorites: string[] = [];
  const seen = new Set<string>();

  for (const symbol of symbols) {
    const canonicalSymbol = toCanonicalSymbol(symbol);
    if (!canonicalSymbol || seen.has(canonicalSymbol)) {
      continue;
    }

    seen.add(canonicalSymbol);
    nextFavorites.push(canonicalSymbol);
  }

  return nextFavorites;
};

const writeFavorites = (favorites: string[]) => {
  const next = normalizeFavorites(favorites);
  if (typeof window !== "undefined") {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
};

/** 延迟通知，避免在 setState updater / render 期间同步更新其他组件 */
const notifyFavoritesChanged = () => {
  if (typeof window === "undefined") return;
  queueMicrotask(() => {
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  });
};

const commitFavorites = (favorites: string[]) => {
  const next = writeFavorites(favorites);
  notifyFavoritesChanged();
  return next;
};

/** 读取本地喜爱列表；无记录或为空时回退到默认列表 */
export const resolveFavorites = (): string[] => {
  if (typeof window === "undefined") {
    return [...INITIAL_FAVORITES];
  }

  const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (!saved) {
    return [...INITIAL_FAVORITES];
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [...INITIAL_FAVORITES];
    }

    const normalized = normalizeFavorites(
      parsed.filter((item): item is string => typeof item === "string")
    );

    return normalized.length > 0 ? normalized : [...INITIAL_FAVORITES];
  } catch {
    return [...INITIAL_FAVORITES];
  }
};

/** 读取最近一次查看的交易标的 */
export const resolveLastSymbol = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = localStorage.getItem(LAST_SYMBOL_STORAGE_KEY);
  if (!saved) {
    return null;
  }

  const canonical = toCanonicalSymbol(saved.trim());
  return canonical || null;
};

/** 写入最近一次查看的交易标的 */
export const persistLastSymbol = (symbol: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const canonical = toCanonicalSymbol(symbol.trim());
  if (!canonical) {
    return;
  }

  localStorage.setItem(LAST_SYMBOL_STORAGE_KEY, canonical);
};

/** 图表默认品种：最近一次查看的标的，否则喜爱列表第一个 */
export const getDefaultSymbol = () =>
  resolveLastSymbol() || resolveFavorites()[0] || INITIAL_FAVORITES[0];

const toggleFavoriteInList = (favorites: string[], symbol: string) => {
  const canonicalSymbol = toCanonicalSymbol(symbol);
  const normalizedPrev = normalizeFavorites(favorites);
  return normalizedPrev.includes(canonicalSymbol)
    ? normalizedPrev.filter((item) => item !== canonicalSymbol)
    : [...normalizedPrev, canonicalSymbol];
};

/** insertIndex 为放置后的目标下标（0..length，表示插到该位置之前） */
const reorderFavorites = (
  symbols: string[],
  fromIndex: number,
  insertIndex: number
) => {
  if (
    fromIndex < 0 ||
    fromIndex >= symbols.length ||
    insertIndex < 0 ||
    insertIndex > symbols.length
  ) {
    return symbols;
  }

  let targetIndex = insertIndex;
  if (fromIndex < targetIndex) {
    targetIndex -= 1;
  }
  if (fromIndex === targetIndex) {
    return symbols;
  }

  const next = [...symbols];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

/** 当前品种一键收藏/取消收藏 */
export const SymbolFavoriteButton = ({ symbol }: { symbol: string }) => {
  const canonicalValue = toCanonicalSymbol(symbol || "");
  const [favorites, setFavorites] = useState<string[]>(INITIAL_FAVORITES);

  useEffect(() => {
    const syncFavorites = () => setFavorites(resolveFavorites());
    syncFavorites();
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    };
  }, []);

  const isCurrentFavorite =
    !!canonicalValue && favorites.includes(canonicalValue);

  return (
    <button
      type="button"
      onClick={() => {
        if (!canonicalValue) return;
        setFavorites((prev) =>
          commitFavorites(toggleFavoriteInList(prev, canonicalValue))
        );
      }}
      disabled={!canonicalValue}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 sm:h-[34px] sm:w-[34px] ${
        isCurrentFavorite
          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
          : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-700 hover:text-yellow-400"
      }`}
      title={isCurrentFavorite ? "取消喜爱当前品种" : "添加到喜爱"}
      aria-label={isCurrentFavorite ? "取消喜爱当前品种" : "添加到喜爱"}
      aria-pressed={isCurrentFavorite}
    >
      <Star
        size={16}
        className={isCurrentFavorite ? "fill-yellow-400 text-yellow-400" : ""}
      />
    </button>
  );
};

const rankSearchItem = (item: any, keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const symbol = item.symbol?.toLowerCase() || "";
  const label = item.label?.toLowerCase() || "";
  const assetType = item.asset_type || "";

  let score = 0;
  if (symbol === normalizedKeyword) score += 100;
  if (label.startsWith(normalizedKeyword)) score += 40;
  if (label.includes(normalizedKeyword)) score += 20;
  if (symbol.includes("/")) score += 10;
  if (assetType === "Physical Currency" || assetType === "Precious Metal") {
    score += 15;
  }

  return score;
};

const sortSearchItems = (items: any[], keyword: string) =>
  [...items].sort(
    (left, right) =>
      rankSearchItem(right, keyword) - rankSearchItem(left, keyword)
  );

export const SymbolSearchSelect = ({ value, onChange }: any) => {
  const { customFetch } = useFetch();
  const containerRef = useRef<any>(null);
  const triggerRef = useRef<any>(null);
  const panelRef = useRef<any>(null);
  const canonicalValue = toCanonicalSymbol(value || "");

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<any>(null);

  const [favorites, setFavorites] = useState<string[]>(INITIAL_FAVORITES);
  const [draggingFavoriteIndex, setDraggingFavoriteIndex] = useState<
    number | null
  >(null);
  const [favoriteInsertIndex, setFavoriteInsertIndex] = useState<number | null>(
    null
  );
  const draggingFavoriteIndexRef = useRef<number | null>(null);
  const favoriteInsertIndexRef = useRef<number | null>(null);

  // Search logic for modal.
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeMarket, setActiveMarket] = useState("");
  const [markets, setMarkets] = useState<
    Array<{ market: string; label: string; symbol_count?: number }>
  >([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [marketsError, setMarketsError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    setFavorites(writeFavorites(resolveFavorites()));

    const syncFavorites = () => setFavorites(resolveFavorites());
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    };
  }, []);

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => commitFavorites(toggleFavoriteInList(prev, symbol)));
  };

  const resetFavoriteDrag = () => {
    draggingFavoriteIndexRef.current = null;
    favoriteInsertIndexRef.current = null;
    setDraggingFavoriteIndex(null);
    setFavoriteInsertIndex(null);
  };

  const handleFavoriteDragStart = (
    index: number,
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", favorites[index] || String(index));
    event.dataTransfer.setDragImage(event.currentTarget, 24, 16);
    draggingFavoriteIndexRef.current = index;
    favoriteInsertIndexRef.current = index;
    setDraggingFavoriteIndex(index);
    setFavoriteInsertIndex(index);
  };

  const handleFavoriteDragOverItem = (
    index: number,
    event: React.DragEvent<HTMLDivElement>
  ) => {
    if (draggingFavoriteIndexRef.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const insertIndex =
      event.clientY > rect.top + rect.height / 2 ? index + 1 : index;
    if (favoriteInsertIndexRef.current === insertIndex) return;
    favoriteInsertIndexRef.current = insertIndex;
    setFavoriteInsertIndex(insertIndex);
  };

  const handleFavoriteListDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    if (draggingFavoriteIndexRef.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (event.target !== event.currentTarget) return;
    if (favoriteInsertIndexRef.current === favorites.length) return;
    favoriteInsertIndexRef.current = favorites.length;
    setFavoriteInsertIndex(favorites.length);
  };

  const handleFavoriteDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const fromIndex = draggingFavoriteIndexRef.current;
    const insertIndex = favoriteInsertIndexRef.current;
    resetFavoriteDrag();
    if (fromIndex === null || insertIndex === null) return;
    setFavorites((prev) =>
      commitFavorites(reorderFavorites(prev, fromIndex, insertIndex))
    );
  };

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, PANEL_MIN_WIDTH);
    const left = Math.min(
      Math.max(rect.left, VIEWPORT_PADDING),
      window.innerWidth - width - VIEWPORT_PADDING
    );
    const openAbove =
      rect.top >= PANEL_MAX_HEIGHT + PANEL_GAP + VIEWPORT_PADDING;

    setPanelStyle({
      left,
      top: openAbove ? rect.top - PANEL_GAP : rect.bottom + PANEL_GAP,
      transform: openAbove ? "translateY(-100%)" : "none",
      width,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    if (!isOpen) return;

    updatePanelPosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition]);

  const runSearch = useCallback(
    async ({
      keyword = "",
      market = "",
    }: {
      keyword?: string;
      market?: string;
    }) => {
      const trimmedKeyword = keyword.trim();
      const trimmedMarket = market.trim();
      if (!trimmedKeyword && !trimmedMarket) {
        setResults([]);
        setSearchError("");
        return;
      }

      setIsSearching(true);
      setSearchError("");

      try {
        const params = new URLSearchParams({
          outputsize: trimmedMarket && !trimmedKeyword ? "30" : "8",
        });
        if (trimmedKeyword) {
          params.set("keyword", trimmedKeyword);
        }
        if (trimmedMarket) {
          params.set("market", trimmedMarket);
        }

        const response = await customFetch(
          `/api/market_master/search/unified?${params.toString()}`
        );
        const payload = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("请求过于频繁（429）。查询受限，请稍后再试。");
          }
          throw new Error(
            payload?.error || payload?.message || "搜索交易标的失败"
          );
        }

        const items = payload?.data?.items || [];
        setResults(
          trimmedKeyword ? sortSearchItems(items, trimmedKeyword) : items
        );
      } catch (error: any) {
        setResults([]);
        setSearchError(error?.message || "搜索交易标的失败");
      } finally {
        setIsSearching(false);
      }
    },
    [customFetch]
  );

  const loadMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    setMarketsError("");

    try {
      const response = await customFetch("/api/market_master/search/markets");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || payload?.message || "获取热门品类失败"
        );
      }

      const items = Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];
      setMarkets(
        items.filter(
          (item: any) => typeof item?.market === "string" && item.market.trim()
        )
      );
    } catch (error: any) {
      setMarkets([]);
      setMarketsError(error?.message || "获取热门品类失败");
    } finally {
      setIsLoadingMarkets(false);
    }
  }, [customFetch]);

  useEffect(() => {
    if (!isModalOpen) return;
    void loadMarkets();
  }, [isModalOpen, loadMarkets]);

  const handleMarketClick = (market: string) => {
    setActiveMarket(market);
    setSearchKeyword("");
    void runSearch({ market });
  };

  const clearSearchState = () => {
    setSearchKeyword("");
    setActiveMarket("");
    setResults([]);
    setSearchError("");
  };

  useEffect(() => {
    if (!isModalOpen) return;
    if (activeMarket) return;

    const keyword = searchKeyword.trim();
    if (!keyword) {
      setResults([]);
      setSearchError("");
      return;
    }

    const timer = window.setTimeout(() => {
      void runSearch({ keyword });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchKeyword, isModalOpen, runSearch, activeMarket]);

  const handleSelect = (nextSymbol: string) => {
    onChange(toCanonicalSymbol(nextSymbol));
    setIsOpen(false);
    setIsModalOpen(false);
    clearSearchState();
  };

  return (
    <>
      <div className="relative w-40 sm:w-48" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-600 focus:border-blue-500 focus:outline-none sm:py-1.5"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="truncate">{canonicalValue}</span>
          <ChevronDown size={14} className="text-gray-500 shrink-0" />
        </button>

        {isOpen &&
          panelStyle &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={panelRef}
              className="fixed overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col"
              style={{
                left: panelStyle.left,
                top: panelStyle.top,
                transform: panelStyle.transform,
                width: panelStyle.width,
                zIndex: 160,
              }}
            >
              <div className="max-h-64 overflow-y-auto py-1">
                {favorites.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleSelect(sym)}
                    className="w-full flex items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gray-800"
                  >
                    <span
                      className={
                        sym === canonicalValue
                          ? "text-blue-400 font-semibold"
                          : "text-gray-200"
                      }
                    >
                      {sym}
                    </span>
                    {sym === canonicalValue && (
                      <Check size={14} className="text-blue-500" />
                    )}
                  </button>
                ))}
                {favorites.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">
                    喜爱列表为空
                  </div>
                )}
              </div>
              <div className="border-t border-gray-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="w-full rounded-md px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  更多...
                </button>
              </div>
            </div>,
            document.body
          )}
      </div>

      {isModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
            <div className="flex h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl sm:h-160">
              <div className="flex items-center justify-between border-b border-gray-800 p-3 sm:p-4">
                <h3 className="text-base font-semibold text-white sm:text-lg">
                  管理喜爱与搜索新标的
                </h3>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    clearSearchState();
                  }}
                  className="text-gray-400 hover:text-white transition-colors focus:outline-none"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
                {/* Left Sidebar: Manage Favorites */}
                <div className="flex max-h-[34%] w-full flex-col border-b border-gray-800 bg-gray-800/30 md:max-h-none md:w-1/3 md:border-b-0 md:border-r">
                  <div className="border-b border-gray-800 p-3 sm:p-4">
                    <h4 className="text-sm font-semibold text-gray-300">
                      已添加到喜爱
                    </h4>
                    {favorites.length > 1 && (
                      <>
                        <p className="mt-1 text-[11px] text-gray-500 md:hidden">
                          使用右侧箭头可调整顺序
                        </p>
                        <p className="mt-1 hidden text-[11px] text-gray-500 md:block">
                          拖动左侧手柄可调整顺序
                        </p>
                      </>
                    )}
                  </div>
                  <div
                    className={`flex-1 overflow-y-auto p-2 ${
                      draggingFavoriteIndex !== null ? "select-none" : ""
                    }`}
                    onDragOver={handleFavoriteListDragOver}
                    onDrop={handleFavoriteDrop}
                  >
                    {favorites.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-gray-500 text-center">
                        暂无喜爱标的
                      </div>
                    ) : (
                      favorites.map((sym, index) => {
                        const isDragging = draggingFavoriteIndex === index;
                        const showInsertBefore =
                          draggingFavoriteIndex !== null &&
                          favoriteInsertIndex === index &&
                          draggingFavoriteIndex !== index &&
                          draggingFavoriteIndex + 1 !== index;
                        const showInsertAfter =
                          index === favorites.length - 1 &&
                          draggingFavoriteIndex !== null &&
                          favoriteInsertIndex === favorites.length &&
                          draggingFavoriteIndex !== favorites.length - 1;

                        return (
                          <div key={sym} className="relative">
                            {showInsertBefore && (
                              <div className="pointer-events-none absolute left-2 right-2 top-0 z-10 h-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
                            )}
                            <div
                              draggable
                              onDragStart={(event) =>
                                handleFavoriteDragStart(index, event)
                              }
                              onDragOver={(event) =>
                                handleFavoriteDragOverItem(index, event)
                              }
                              onDragEnd={resetFavoriteDrag}
                              className={`group flex cursor-grab items-center gap-2 rounded-md px-2 py-2 transition-colors active:cursor-grabbing ${
                                isDragging
                                  ? "bg-gray-800/90 opacity-40"
                                  : "hover:bg-gray-800/80"
                              }`}
                            >
                              <span
                                className="hidden h-5 w-4 shrink-0 items-center justify-center text-gray-600 group-hover:text-gray-400 md:flex"
                                title="拖动排序"
                                aria-hidden
                              >
                                <GripVertical size={14} />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-gray-200">
                                {sym}
                              </span>
                              <div className="flex shrink-0 items-center md:hidden">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setFavorites((prev) =>
                                      commitFavorites(
                                        reorderFavorites(prev, index, index - 1)
                                      )
                                    );
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-25"
                                  aria-label={`上移 ${sym}`}
                                >
                                  <ChevronUp size={15} />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === favorites.length - 1}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setFavorites((prev) =>
                                      commitFavorites(
                                        reorderFavorites(prev, index, index + 2)
                                      )
                                    );
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-25"
                                  aria-label={`下移 ${sym}`}
                                >
                                  <ChevronDown size={15} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(sym)}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                className="shrink-0 cursor-pointer text-gray-500 hover:text-red-400 transition-colors focus:outline-none"
                                title="取消喜爱"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            {showInsertAfter && (
                              <div className="pointer-events-none absolute left-2 right-2 bottom-0 z-10 h-0.5 translate-y-1/2 rounded-full bg-blue-500" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Side: Search */}
                <div className="flex min-h-0 w-full flex-1 flex-col bg-gray-900 md:w-2/3">
                  <div className="space-y-3 border-b border-gray-800 p-3 sm:space-y-4 sm:p-4">
                    <div className="space-y-2">
                      <div className="text-xs text-gray-400">热门品类：</div>
                      {marketsError ? (
                        <div className="text-xs text-red-300">
                          {marketsError}
                        </div>
                      ) : isLoadingMarkets ? (
                        <div className="flex items-center gap-2 text-xs text-blue-200">
                          <Loader2 size={12} className="animate-spin" />
                          正在加载品类...
                        </div>
                      ) : markets.length ? (
                        <div className="flex flex-wrap gap-2">
                          {markets.map((item) => {
                            const isActive = activeMarket === item.market;
                            return (
                              <button
                                key={item.market}
                                type="button"
                                onClick={() => handleMarketClick(item.market)}
                                className={
                                  isActive
                                    ? "rounded-full border border-blue-500 bg-blue-500/15 px-3 py-1 text-xs text-blue-300 transition-colors"
                                    : "rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300 hover:border-blue-500 hover:text-white transition-colors"
                                }
                              >
                                {item.label || item.market}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          暂无可用品类
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 focus-within:border-blue-500 transition-colors">
                      <Search size={18} className="text-gray-400" />
                      <input
                        value={searchKeyword}
                        onChange={(e) => {
                          if (activeMarket) {
                            setActiveMarket("");
                          }
                          setSearchKeyword(e.target.value);
                        }}
                        placeholder="输入代码或名称搜索，例如 USO"
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                        autoFocus
                      />
                      {(searchKeyword || activeMarket) && (
                        <button
                          onClick={clearSearchState}
                          className="text-gray-500 hover:text-gray-300 focus:outline-none"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                    {searchError ? (
                      <div className="rounded-lg px-3 py-4 text-sm text-red-300">
                        {searchError}
                      </div>
                    ) : isSearching ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-blue-200">
                        <Loader2 size={16} className="animate-spin" />
                        正在搜索...
                      </div>
                    ) : results.length ? (
                      results.map((item) => {
                        const isFav = favorites.includes(item.symbol);
                        return (
                          <div
                            key={`${item.symbol}-${item.market || "unknown"}`}
                            className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-800"
                          >
                            <button
                              type="button"
                              onClick={() => handleSelect(item.symbol)}
                              className="flex min-w-0 flex-1 items-start gap-3 text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">
                                  {item.symbol}
                                </div>
                                <div className="truncate text-xs text-gray-400">
                                  {item.label}
                                </div>
                              </div>
                              <div className="shrink-0 text-right text-[11px] text-gray-500 pt-0.5">
                                <div>{item.asset_type || "Unknown"}</div>
                                <div>{item.market || "-"}</div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleFavorite(item.symbol)}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-700 transition-colors focus:outline-none"
                              title={isFav ? "取消喜爱" : "添加到喜爱"}
                            >
                              <Star
                                size={16}
                                className={
                                  isFav
                                    ? "fill-yellow-500 text-yellow-500"
                                    : "group-hover:text-white"
                                }
                              />
                            </button>
                          </div>
                        );
                      })
                    ) : searchKeyword.trim() || activeMarket ? (
                      <div className="rounded-lg px-3 py-4 text-sm text-gray-400">
                        没有找到匹配的交易标的
                      </div>
                    ) : (
                      <div className="rounded-lg px-3 py-4 text-sm text-gray-400">
                        选择上方品类，或输入代码/名称进行搜索
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
