"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { STORES } from "@/lib/catalog";
import { scoreText } from "@/lib/textScore";

type SearchResult = {
  type: "store" | "product";
  id: string;
  name: string;
  description: string;
  href: string;
  extra?: string;
};

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const searchResults: SearchResult[] = [];

    for (const store of STORES) {
      const storeContent = `${store.name} ${store.tagline} ${store.categories.join(" ")}`;
      const storeScore = scoreText(storeContent, query);
      if (storeScore > 0) {
        searchResults.push({
          type: "store",
          id: store.id,
          name: store.name,
          description: store.tagline,
          href: `/store/${store.id}`,
          extra: store.verified ? "Verified" : undefined,
        });
      }

      for (const product of store.products) {
        const productContent = `${product.name} ${product.description} ${product.tags.join(" ")}`;
        const productScore = scoreText(productContent, query);
        if (productScore > 0) {
          searchResults.push({
            type: "product",
            id: product.id,
            name: product.name,
            description: product.description,
            href: `/product/${store.id}/${product.id}`,
            extra: `${product.priceUSDC} USDC`,
          });
        }
      }
    }

    return searchResults.slice(0, 8);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
      window.location.href = results[selectedIndex].href;
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="搜索店铺、商品..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white/90 placeholder-white/40 outline-none transition-colors focus:border-white/20 focus:bg-white/[0.07]"
        />
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0a0c14]/95 backdrop-blur-xl">
          {results.map((result, index) => (
            <Link
              key={`${result.type}-${result.id}`}
              href={result.href}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  result.type === "store"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {result.type === "store" ? "店铺" : "商品"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-white/90">{result.name}</span>
                  {result.extra && (
                    <span className="shrink-0 text-xs text-white/50">{result.extra}</span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-white/50">{result.description}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-xl border border-white/10 bg-[#0a0c14]/95 px-4 py-6 text-center text-sm text-white/50 backdrop-blur-xl">
          未找到相关结果
        </div>
      )}
    </div>
  );
}
