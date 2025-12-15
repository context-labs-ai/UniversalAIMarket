"use client";

import { createContext, useContext } from "react";

export type CartItem = {
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  priceUSDC: string;
  tokenId: number;
  kind: "digital" | "physical";
  quantity: number;
};

export type CartState = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (storeId: string, productId: string) => void;
  updateQuantity: (storeId: string, productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
};

export const CartContext = createContext<CartState | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
