"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cartStore";

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function CartButton() {
  const { totalItems } = useCart();
  const mounted = useHydrated();

  return (
    <Link
      href="/cart"
      className="glass-panel relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white/80 transition-colors hover:text-white"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <span className="hidden sm:inline">购物车</span>
      {mounted && totalItems > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-medium text-white">
          {totalItems > 9 ? "9+" : totalItems}
        </span>
      )}
    </Link>
  );
}
