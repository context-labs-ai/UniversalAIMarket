"use client";

import Link from "next/link";
import { useCart } from "@/lib/cartStore";

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <header>
          <Link href="/dashboard" className="text-xs text-white/50 hover:text-white/70">
            ← 返回市场
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">购物车</h1>
        </header>

        <div className="mt-10 flex flex-col items-center justify-center py-16">
          <svg className="h-16 w-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="mt-4 text-sm text-white/50">购物车是空的</p>
          <Link
            href="/dashboard"
            className="mt-6 rounded-lg bg-indigo-500/20 px-4 py-2 text-sm text-indigo-200 transition-colors hover:bg-indigo-500/30"
          >
            去逛逛
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-xs text-white/50 hover:text-white/70">
            ← 返回市场
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">购物车</h1>
          <p className="mt-1 text-sm text-white/50">{items.length} 件商品</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-white/40 transition-colors hover:text-red-400"
        >
          清空购物车
        </button>
      </header>

      <section className="mt-6 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.storeId}-${item.productId}`}
            className="glass-panel flex items-center gap-4 rounded-2xl p-4"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
              <span className="text-2xl">{item.kind === "digital" ? "🎮" : "📦"}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/product/${item.storeId}/${item.productId}`}
                    className="text-sm font-medium text-white/90 hover:text-white"
                  >
                    {item.productName}
                  </Link>
                  <div className="mt-0.5 text-xs text-white/50">{item.storeName}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white/90">{item.priceUSDC} USDC</div>
                  <div className="mt-0.5 text-xs text-white/40">
                    小计: {(parseFloat(item.priceUSDC) * item.quantity).toFixed(2)} USDC
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.storeId, item.productId, item.quantity - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm text-white/80">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.storeId, item.productId, item.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.storeId, item.productId)}
                  className="text-xs text-white/40 transition-colors hover:text-red-400"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">总计</span>
          <span className="text-xl font-semibold text-white/90">{totalPrice.toFixed(2)} USDC</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/checkout?mode=simulate"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            <span>🎭</span>
            <span>模拟结算</span>
          </Link>
          <Link
            href="/checkout?mode=testnet"
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500/20 px-4 py-3 text-sm text-indigo-200 transition-colors hover:bg-indigo-500/30"
          >
            <span>⛓️</span>
            <span>测试网结算</span>
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-white/40">
          结算将通过 ZetaChain 跨链协议完成
        </div>
      </section>
    </main>
  );
}
