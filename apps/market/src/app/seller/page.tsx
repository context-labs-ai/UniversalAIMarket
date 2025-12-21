"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ProductForm } from "@/components/seller/ProductForm";
import { useSellerWallet } from "@/hooks/useSellerWallet";
import type { DynamicProduct, CreateProductRequest } from "@/lib/products";
import { hasDynamicEnvironmentId } from "@/lib/auth/dynamic";

type ViewMode = "list" | "add" | "edit";

// Dynamic SDK hook 类型
type DynamicContextHook = () => {
  primaryWallet: { address?: string } | null;
  sdkHasLoaded: boolean;
};

export default function SellerPage() {
  const [dynamicHook, setDynamicHook] = useState<DynamicContextHook | null>(null);

  // 加载 Dynamic SDK
  useEffect(() => {
    if (!hasDynamicEnvironmentId) return;
    import("@dynamic-labs/sdk-react-core")
      .then((mod) => setDynamicHook(() => mod.useDynamicContext))
      .catch(() => setDynamicHook(null));
  }, []);

  if (!hasDynamicEnvironmentId) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="glass-panel rounded-2xl p-10 text-center">
          <div className="text-white/50">未配置 Dynamic 环境</div>
        </div>
      </main>
    );
  }

  if (!dynamicHook) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="text-center py-20 text-white/50">加载中...</div>
      </main>
    );
  }

  return <SellerPageInner useDynamicContext={dynamicHook} />;
}

function SellerPageInner({
  useDynamicContext,
}: {
  useDynamicContext: DynamicContextHook;
}) {
  const { setWallet, removeWallet } = useSellerWallet();

  // 获取当前钱包地址
  const dynamicContext = useDynamicContext();
  const currentWalletAddress = dynamicContext.primaryWallet?.address || null;
  const sdkReady = dynamicContext.sdkHasLoaded;

  const [products, setProducts] = useState<DynamicProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingProduct, setEditingProduct] = useState<DynamicProduct | null>(
    null
  );
  const [showInactive, setShowInactive] = useState(false);

  // 加载商品列表
  const loadProducts = useCallback(async (walletAddr: string | null) => {
    try {
      const res = await fetch(
        `/api/products${showInactive ? "?includeInactive=true" : ""}`
      );
      const data = await res.json();
      if (data.ok) {
        // 只显示当前钱包地址的商品
        const filteredProducts = walletAddr
          ? data.products.filter(
              (p: DynamicProduct) =>
                p.sellerAgent.walletAddress.toLowerCase() === walletAddr.toLowerCase()
            )
          : [];
        setProducts(filteredProducts);
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    // 等待 SDK 加载完成后再加载商品
    if (sdkReady) {
      loadProducts(currentWalletAddress);
    }
  }, [loadProducts, currentWalletAddress, sdkReady]);

  // 创建商品
  const handleCreate = async (data: CreateProductRequest, privateKey: string) => {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!result.ok) {
      throw new Error(result.error || "创建失败");
    }

    // 保存私钥到 localStorage
    setWallet(result.product.id, {
      address: data.sellerAgent.walletAddress,
      privateKey,
    });

    setViewMode("list");
    loadProducts(currentWalletAddress);
  };

  // 更新商品
  const handleUpdate = async (data: CreateProductRequest, privateKey: string) => {
    if (!editingProduct) return;

    const res = await fetch(`/api/products/${editingProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!result.ok) {
      throw new Error(result.error || "更新失败");
    }

    // 更新私钥
    setWallet(editingProduct.id, {
      address: data.sellerAgent.walletAddress,
      privateKey,
    });

    setViewMode("list");
    setEditingProduct(null);
    loadProducts(currentWalletAddress);
  };

  // 下架商品
  const handleDeactivate = async (productId: string) => {
    if (!confirm("确定要下架此商品吗？")) return;

    const res = await fetch(`/api/products/${productId}`, {
      method: "DELETE",
    });

    const result = await res.json();
    if (!result.ok) {
      alert(result.error || "下架失败");
      return;
    }

    loadProducts(currentWalletAddress);
  };

  // 重新上架
  const handleReactivate = async (productId: string) => {
    const res = await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });

    const result = await res.json();
    if (!result.ok) {
      alert(result.error || "上架失败");
      return;
    }

    loadProducts(currentWalletAddress);
  };

  // 彻底删除
  const handleDelete = async (productId: string) => {
    if (!confirm("确定要彻底删除此商品吗？此操作不可恢复。")) return;

    const res = await fetch(`/api/products/${productId}?permanent=true`, {
      method: "DELETE",
    });

    const result = await res.json();
    if (!result.ok) {
      alert(result.error || "删除失败");
      return;
    }

    // 删除本地钱包
    removeWallet(productId);
    loadProducts(currentWalletAddress);
  };

  // 编辑商品
  const handleEdit = (product: DynamicProduct) => {
    setEditingProduct(product);
    setViewMode("edit");
  };

  // 未登录提示
  if (!currentWalletAddress) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="glass-panel rounded-2xl p-10 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <div className="text-lg text-white/70 mb-2">请先连接钱包</div>
          <div className="text-sm text-white/50 mb-6">
            连接钱包后才能管理您的商品
          </div>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600"
          >
            返回首页
          </Link>
        </div>
      </main>
    );
  }

  if (viewMode === "add") {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-2xl font-semibold mb-6">添加商品</h1>
        <div className="glass-panel rounded-2xl p-6">
          <ProductForm
            onSubmit={handleCreate}
            onCancel={() => setViewMode("list")}
          />
        </div>
      </main>
    );
  }

  if (viewMode === "edit" && editingProduct) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-2xl font-semibold mb-6">编辑商品</h1>
        <div className="glass-panel rounded-2xl p-6">
          <ProductForm
            product={editingProduct}
            onSubmit={handleUpdate}
            onCancel={() => {
              setViewMode("list");
              setEditingProduct(null);
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold">我的商品</h1>
          <p className="text-sm text-white/50 mt-1">管理您的商品和 Seller Agent 配置</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white"
          >
            返回市场
          </Link>
          <button
            onClick={() => setViewMode("add")}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600"
          >
            + 添加商品
          </button>
        </div>
      </header>

      {/* 筛选 */}
      <div className="flex items-center gap-4 mb-6">
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-white/20"
          />
          显示已下架商品
        </label>
        <span className="text-sm text-white/50">
          共 {products.length} 件商品
        </span>
      </div>

      {/* 商品列表 */}
      {isLoading ? (
        <div className="text-center py-20 text-white/50">加载中...</div>
      ) : products.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <div className="text-4xl mb-4">📦</div>
          <div className="text-lg text-white/70 mb-2">还没有商品</div>
          <div className="text-sm text-white/50 mb-6">
            点击「添加商品」开始上架您的第一件商品
          </div>
          <button
            onClick={() => setViewMode("add")}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600"
          >
            + 添加商品
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <div
              key={product.id}
              className={`glass-panel rounded-2xl p-5 ${
                product.status === "inactive" ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium text-white/90">
                      {product.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        product.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {product.status === "active" ? "已上架" : "已下架"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">
                      {product.type.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-sm text-white/50 mt-1 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-white/60">
                    <div>
                      价格: <span className="text-white/90">{product.priceUSDC} USDC</span>
                    </div>
                    <div>
                      店铺: <span className="text-white/90">{product.storeName}</span>
                    </div>
                    <div>
                      Agent: <span className="text-white/90">{product.sellerAgent.name}</span>
                      <span className="text-white/40 ml-1">({product.sellerAgent.style})</span>
                    </div>
                    {product.nft && (
                      <div>
                        Token ID: <span className="text-white/90">#{product.nft.tokenId}</span>
                      </div>
                    )}
                  </div>

                  {product.nft && (
                    <div className="mt-2 text-xs text-white/40 font-mono truncate">
                      NFT: {product.nft.contractAddress}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleEdit(product)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white"
                  >
                    编辑
                  </button>
                  {product.status === "active" ? (
                    <button
                      onClick={() => handleDeactivate(product.id)}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-300 hover:text-yellow-200"
                    >
                      下架
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleReactivate(product.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 hover:text-emerald-200"
                      >
                        重新上架
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 hover:text-red-200"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
