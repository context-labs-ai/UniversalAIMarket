"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

interface WalletInfo {
  address: string;
  privateKey: string;
}

interface SellerWalletStore {
  [productId: string]: WalletInfo;
}

const STORAGE_KEY = "seller_wallets";

/**
 * Hook for managing seller wallets in localStorage
 *
 * 私钥只存在用户浏览器本地，不经过后端
 */
export function useSellerWallet() {
  const [wallets, setWallets] = useState<SellerWalletStore>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setWallets(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load seller wallets:", e);
    }
    setIsLoaded(true);
  }, []);

  // 保存到 localStorage
  const saveWallets = useCallback((newWallets: SellerWalletStore) => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWallets));
      setWallets(newWallets);
    } catch (e) {
      console.error("Failed to save seller wallets:", e);
    }
  }, []);

  // 获取商品的钱包
  const getWallet = useCallback(
    (productId: string): WalletInfo | null => {
      return wallets[productId] || null;
    },
    [wallets]
  );

  // 设置商品的钱包
  const setWallet = useCallback(
    (productId: string, wallet: WalletInfo) => {
      const newWallets = { ...wallets, [productId]: wallet };
      saveWallets(newWallets);
    },
    [wallets, saveWallets]
  );

  // 删除商品的钱包
  const removeWallet = useCallback(
    (productId: string) => {
      const newWallets = { ...wallets };
      delete newWallets[productId];
      saveWallets(newWallets);
    },
    [wallets, saveWallets]
  );

  // 生成新钱包
  const generateWallet = useCallback((): WalletInfo => {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }, []);

  // 从私钥导入钱包
  const importWallet = useCallback((privateKey: string): WalletInfo | null => {
    try {
      // 确保私钥格式正确
      const formattedKey = privateKey.startsWith("0x")
        ? privateKey
        : `0x${privateKey}`;
      const wallet = new ethers.Wallet(formattedKey);
      return {
        address: wallet.address,
        privateKey: formattedKey,
      };
    } catch (e) {
      console.error("Invalid private key:", e);
      return null;
    }
  }, []);

  // 获取所有钱包地址
  const getAllAddresses = useCallback((): Record<string, string> => {
    const addresses: Record<string, string> = {};
    for (const [productId, wallet] of Object.entries(wallets)) {
      addresses[productId] = wallet.address;
    }
    return addresses;
  }, [wallets]);

  return {
    isLoaded,
    wallets,
    getWallet,
    setWallet,
    removeWallet,
    generateWallet,
    importWallet,
    getAllAddresses,
  };
}
