"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { STORES } from "@/lib/catalog";

export function getCategoryList() {
  const categoryMap = new Map<string, number>();
  for (const store of STORES) {
    for (const category of store.categories) {
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }
  }
  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function CategoryFilter({ currentCategory }: { currentCategory?: string }) {
  const categories = getCategoryList();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(category: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={buildHref(null)}
        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
          !currentCategory
            ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-200"
            : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
        }`}
      >
        全部
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.name}
          href={buildHref(cat.name)}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            currentCategory === cat.name
              ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-200"
              : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
          }`}
        >
          {cat.name}
          <span className="ml-1 text-white/40">({cat.count})</span>
        </Link>
      ))}
    </div>
  );
}
