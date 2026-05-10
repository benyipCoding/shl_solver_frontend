"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { useFetch } from "@/context/FetchContext";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_HEIGHT = 320;
const PANEL_GAP = 8;
const VIEWPORT_PADDING = 12;

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

  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [panelStyle, setPanelStyle] = useState<any>(null);

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
    if (!isOpen) {
      setInputValue(value);
    }
  }, [isOpen, value]);

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
    if (!isOpen) return;

    const keyword = inputValue.trim();
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
  }, [inputValue, isOpen, runSearch]);

  const handleSelect = (nextSymbol: string) => {
    setInputValue(nextSymbol);
    onChange(nextSymbol);
    setIsOpen(false);
  };

  return (
    <div className="relative w-64" ref={containerRef}>
      <div
        ref={triggerRef}
        className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 transition-colors focus-within:border-blue-500"
        onClick={() => setIsOpen(true)}
      >
        <Search size={14} className="text-gray-400" />
        <input
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              handleSelect(results[0].symbol);
            }

            if (event.key === "Escape") {
              setIsOpen(false);
              setInputValue(value);
            }
          }}
          placeholder="搜索品种，例如 XAU/USD"
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
        />
        {isSearching ? (
          <Loader2 size={14} className="animate-spin text-blue-400" />
        ) : (
          <ChevronDown size={14} className="text-gray-500" />
        )}
      </div>

      {isOpen &&
        panelStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
            style={{
              left: panelStyle.left,
              top: panelStyle.top,
              transform: panelStyle.transform,
              width: panelStyle.width,
              zIndex: 160,
            }}
          >
            <div className="border-b border-gray-800 px-3 py-2 text-xs text-gray-400">
              输入交易代码或名称搜索，回车可直接选择首条结果
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {searchError ? (
                <div className="rounded-lg px-3 py-4 text-sm text-red-300">
                  {searchError}
                </div>
              ) : isSearching ? (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-blue-200">
                  <Loader2 size={16} className="animate-spin" />
                  正在搜索交易标的...
                </div>
              ) : results.length ? (
                results.map((item) => (
                  <button
                    key={`${item.symbol}-${item.market || "unknown"}`}
                    type="button"
                    onClick={() => handleSelect(item.symbol)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      item.symbol === value
                        ? "bg-blue-600/15 text-blue-100"
                        : "text-gray-200 hover:bg-gray-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {item.symbol}
                      </div>
                      <div className="truncate text-xs text-gray-400">
                        {item.label}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-gray-500">
                      <div>{item.asset_type || "Unknown"}</div>
                      <div>{item.market || "-"}</div>
                    </div>
                  </button>
                ))
              ) : inputValue.trim() ? (
                <div className="rounded-lg px-3 py-4 text-sm text-gray-400">
                  没有找到匹配的交易标的
                </div>
              ) : (
                <div className="rounded-lg px-3 py-4 text-sm text-gray-400">
                  输入代码或名称以搜索交易标的
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
