/**
 * Catalog Merge
 *
 * 从 products.json 加载所有商品和店铺数据
 * 不再使用静态 catalog.ts，所有数据都存储在 JSON 中
 */

import { getActiveProducts, getJsonStores, type JsonStore } from "./productService";
import type { DynamicProduct } from "./products";

// 商品类型定义（兼容旧格式）
export type ProductKind = "digital" | "physical";
export type InventoryStatus = "in_stock" | "limited" | "preorder";

export interface MergedStore {
  id: string;
  name: string;
  tagline: string;
  imageUrl?: string;
  sellerAgentId: string;
  sellerAgentName: string;
  sellerStyle: "friendly" | "strict" | "pro" | "aggressive";
  categories: string[];
  location: string;
  verified: boolean;
  rating: number;
  orders: number;
  responseMins: number;
  products: MergedProduct[];
  // 动态商品特有字段
  isDynamic?: boolean;
  sellerConfig?: {
    name: string;
    style: "aggressive" | "pro" | "friendly";
    walletAddress: string;
    minPriceFactor: number;
    maxDiscountPerRound: number;
    prompt?: string;
  };
}

export interface MergedProduct {
  id: string;
  name: string;
  kind: ProductKind;
  description: string;
  priceUSDC: string;
  tokenId: number;
  highlights: string[];
  tags: string[];
  inventory: InventoryStatus;
  leadTime: string;
  demoReady: boolean;
  // 动态商品特有字段
  isDynamic?: boolean;
  sellerConfig?: {
    name: string;
    style: "aggressive" | "pro" | "friendly";
    walletAddress: string;
    minPriceFactor: number;
    maxDiscountPerRound: number;
    prompt?: string;
  };
  nftConfig?: {
    chain: string;
    contractAddress: string;
    tokenId: number;
    escrowAddress?: string;
  };
}

/**
 * 将动态商品转换为 MergedProduct 格式
 */
function dynamicProductToMergedProduct(product: DynamicProduct): MergedProduct {
  return {
    id: product.id,
    name: product.name,
    kind: product.type === "nft" ? "digital" : product.type === "physical" ? "physical" : "digital",
    description: product.description,
    priceUSDC: product.priceUSDC,
    tokenId: product.nft?.tokenId || 0,
    highlights: product.highlights || [],
    tags: product.tags || [],
    inventory: "in_stock",
    leadTime: "秒级交付",
    demoReady: (product as DynamicProduct & { demoReady?: boolean }).demoReady ?? true,
    isDynamic: true,
    sellerConfig: {
      name: product.sellerAgent.name,
      style: product.sellerAgent.style,
      walletAddress: product.sellerAgent.walletAddress,
      minPriceFactor: product.sellerAgent.minPriceFactor,
      maxDiscountPerRound: product.sellerAgent.maxDiscountPerRound,
      prompt: product.sellerAgent.prompt,
    },
    nftConfig: product.nft
      ? {
          chain: product.nft.chain,
          contractAddress: product.nft.contractAddress,
          tokenId: product.nft.tokenId,
          escrowAddress: product.nft.escrowAddress,
        }
      : undefined,
  };
}

/**
 * 将动态商品转换为 Store 格式
 * 用于没有在 stores 数组中预定义的店铺
 */
function dynamicProductToStore(firstProduct: DynamicProduct, allProducts: DynamicProduct[]): MergedStore {
  return {
    id: firstProduct.storeId,
    name: firstProduct.storeName,
    tagline: firstProduct.description.slice(0, 50) + "...",
    sellerAgentId: `seller-${firstProduct.id}`,
    sellerAgentName: firstProduct.sellerAgent.name,
    sellerStyle: firstProduct.sellerAgent.style,
    categories: firstProduct.tags || ["动态商品"],
    location: "在线",
    verified: false,
    rating: 5.0,
    orders: 0,
    responseMins: 1,
    isDynamic: true,
    sellerConfig: {
      name: firstProduct.sellerAgent.name,
      style: firstProduct.sellerAgent.style,
      walletAddress: firstProduct.sellerAgent.walletAddress,
      minPriceFactor: firstProduct.sellerAgent.minPriceFactor,
      maxDiscountPerRound: firstProduct.sellerAgent.maxDiscountPerRound,
    },
    products: allProducts.map(dynamicProductToMergedProduct),
  };
}

/**
 * 获取所有店铺
 * 现在所有数据都来自 products.json
 */
export function getAllStores(): MergedStore[] {
  // 从 JSON 获取所有商品
  const allProducts = getActiveProducts();

  // 从 JSON 获取预定义店铺
  const jsonStores = getJsonStores();

  // 按 storeId 分组商品
  const productsByStore = new Map<string, DynamicProduct[]>();
  for (const product of allProducts) {
    const storeId = product.storeId;
    if (!productsByStore.has(storeId)) {
      productsByStore.set(storeId, []);
    }
    productsByStore.get(storeId)!.push(product);
  }

  // 构建店铺列表
  const stores: MergedStore[] = [];

  // 处理预定义店铺（从 JSON stores 数组）
  for (const jsonStore of jsonStores) {
    const storeProducts = productsByStore.get(jsonStore.id) || [];
    stores.push({
      ...jsonStore,
      products: storeProducts.map(dynamicProductToMergedProduct),
    });
    productsByStore.delete(jsonStore.id);
  }

  // 处理剩余的动态商品（没有在 stores 数组中定义的）
  for (const [, products] of productsByStore) {
    if (products.length > 0) {
      const firstProduct = products[0];
      stores.push(dynamicProductToStore(firstProduct, products));
    }
  }

  return stores;
}

/**
 * 根据 ID 查找店铺
 */
export function findStoreById(storeId: string): MergedStore | null {
  const allStores = getAllStores();
  return allStores.find((s) => s.id === storeId) || null;
}

/**
 * 根据 ID 查找商品
 */
export function findProductById(
  storeId: string,
  productId: string
): { store: MergedStore; product: MergedProduct } | null {
  const store = findStoreById(storeId);
  if (!store) return null;

  const product = store.products.find((p) => p.id === productId);
  if (!product) return null;

  return { store, product };
}

/**
 * 搜索所有商品（跨店铺）
 */
export function searchAllProducts(query: string): Array<{ store: MergedStore; product: MergedProduct }> {
  const allStores = getAllStores();
  const results: Array<{ store: MergedStore; product: MergedProduct }> = [];

  for (const store of allStores) {
    for (const product of store.products) {
      results.push({ store, product });
    }
  }

  // 简单的关键词匹配
  if (query) {
    const lowerQuery = query.toLowerCase();
    return results.filter(
      ({ store, product }) =>
        product.name.toLowerCase().includes(lowerQuery) ||
        product.description.toLowerCase().includes(lowerQuery) ||
        store.name.toLowerCase().includes(lowerQuery) ||
        (product.tags || []).some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  return results;
}
