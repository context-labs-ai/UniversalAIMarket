"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { CartContext, type CartItem } from "@/lib/cartStore";

const CART_STORAGE_KEY = "universal-ai-market-cart";

function getInitialItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(getInitialItems);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.storeId === item.storeId && i.productId === item.productId
      );
      if (existing) {
        return prev.map((i) =>
          i.storeId === item.storeId && i.productId === item.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((storeId: string, productId: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.storeId === storeId && i.productId === productId))
    );
  }, []);

  const updateQuantity = useCallback(
    (storeId: string, productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(storeId, productId);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.storeId === storeId && i.productId === productId ? { ...i, quantity } : i
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + parseFloat(i.priceUSDC) * i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
    }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
