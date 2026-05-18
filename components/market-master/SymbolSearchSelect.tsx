"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Search, X, Star, Check } from "lucide-react";
import { useFetch } from "@/context/FetchContext";

const PANEL_MIN_WIDTH = 200;
const PANEL_MAX_HEIGHT = 320;
const PANEL_GAP = 8;
const VIEWPORT_PADDING = 12;

const INITIAL_FAVORITES = ["XAU/USD", "EUR/USD", "GBP/USD"];

const POPULAR_SYMBOLS = [
  { symbol: "XAU/USD", label: "黄金/美元" },
  { symbol: "XAG/USD", label: "白银/美元" },
  { symbol: "EUR/USD", label: "欧元/美元" },
  { symbol: "GBP/USD", label: "英镑/美元" },
  { symbol: "XTI/USD", label: "美国原油" },
  { symbol: "XBR/USD", label: "布伦特原油" },
  { symbol: "DXY", label: "美元指数" },
  { symbol: "DJI", label: "道琼斯" },
  { symbol: "NDX", label: "纳斯达克" },
  { symbol: "SPX", label: "标普500" },
  { symbol: "BTC/USD", label: "比特币/美元" },
];

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

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<any>(null);

  const [favorites, setFavorites] = useState<string[]>(INITIAL_FAVORITES);

  // Search logic for modal
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("marketMasterFavorites");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      localStorage.setItem("marketMasterFavorites", JSON.stringify(next));
      return next;
    });
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
    async (keyword: string) => {
      const trimmedKeyword = keyword.trim();
      if (!trimmedKeyword) {
        setResults([]);
        setSearchError("");
        return;
      }

      setIsSearching(true);
      setSearchError("");

      try {
        const params = new URLSearchParams({
          keyword: trimmedKeyword,
          outputsize: "8",
        });
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

        setResults(sortSearchItems(payload?.data?.items || [], trimmedKeyword));
      } catch (error: any) {
        setResults([]);
        setSearchError(error?.message || "搜索交易标的失败");
      } finally {
        setIsSearching(false);
      }
    },
    [customFetch]
  );

  useEffect(() => {
    if (!isModalOpen) return;

    const keyword = searchKeyword.trim();
    if (!keyword) {
      setResults([]);
      setSearchError("");
      return;
    }

    const timer = window.setTimeout(() => {
      void runSearch(keyword);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchKeyword, isModalOpen, runSearch]);

  const handleSelect = (nextSymbol: string) => {
    onChange(nextSymbol);
    setIsOpen(false);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="relative w-48" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-600 focus:outline-none focus:border-blue-500"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="truncate">{value}</span>
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
                        sym === value
                          ? "text-blue-400 font-semibold"
                          : "text-gray-200"
                      }
                    >
                      {sym}
                    </span>
                    {sym === value && (
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl h-[40rem]">
              <div className="flex items-center justify-between border-b border-gray-800 p-4">
                <h3 className="text-lg font-semibold text-white">
                  管理喜爱与搜索新标的
                </h3>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSearchKeyword("");
                  }}
                  className="text-gray-400 hover:text-white transition-colors focus:outline-none"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Manage Favorites */}
                <div className="w-1/3 border-r border-gray-800 bg-gray-800/30 flex flex-col">
                  <div className="p-4 border-b border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-300">
                      已添加到喜爱
                    </h4>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {favorites.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-gray-500 text-center">
                        暂无喜爱标的
                      </div>
                    ) : (
                      favorites.map((sym) => (
                        <div
                          key={sym}
                          className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-800/80 transition-colors"
                        >
                          <span className="text-sm text-gray-200">{sym}</span>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(sym)}
                            className="text-gray-500 hover:text-red-400 transition-colors focus:outline-none"
                            title="取消喜爱"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Side: Search */}
                <div className="w-2/3 flex flex-col bg-gray-900">
                  <div className="border-b border-gray-800 p-4 space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs text-gray-400">
                        热门搜索快捷方式：
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {POPULAR_SYMBOLS.map((pop) => (
                          <button
                            key={pop.symbol}
                            type="button"
                            onClick={() => setSearchKeyword(pop.symbol)}
                            className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300 hover:border-blue-500 hover:text-white transition-colors"
                          >
                            {pop.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 focus-within:border-blue-500 transition-colors">
                      <Search size={18} className="text-gray-400" />
                      <input
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="输入代码或名称搜索，例如 USO"
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                        autoFocus
                      />
                      {searchKeyword && (
                        <button
                          onClick={() => setSearchKeyword("")}
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
                    ) : searchKeyword.trim() ? (
                      <div className="rounded-lg px-3 py-4 text-sm text-gray-400">
                        没有找到匹配的交易标的
                      </div>
                    ) : (
                      <div className="rounded-lg px-3 py-4 text-sm text-gray-400">
                        在上方输入代码或名称进行搜索
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
