"use client";

import { useState } from "react";
import { useCart } from "@/lib/cartStore";

type Props = {
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  priceUSDC: string;
  tokenId: number;
  kind: "digital" | "physical";
};

export function AddToCartButton({
  storeId,
  storeName,
  productId,
  productName,
  priceUSDC,
  tokenId,
  kind,
}: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    addItem({
      storeId,
      storeName,
      productId,
      productName,
      priceUSDC,
      tokenId,
      kind,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      onClick={handleAddToCart}
      disabled={added}
      className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-all ${
        added
          ? "bg-emerald-500/20 text-emerald-200"
          : "bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30"
      }`}
    >
      {added ? "✓ 已添加到购物车" : "添加到购物车"}
    </button>
  );
}
