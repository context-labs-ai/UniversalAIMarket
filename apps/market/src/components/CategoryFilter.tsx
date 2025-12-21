"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Category = {
  name: string;
  count: number;
};

type Props = {
  categories: Category[];
  currentCategory?: string;
};

export function CategoryFilter({ categories, currentCategory }: Props) {
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
