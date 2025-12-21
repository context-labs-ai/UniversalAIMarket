/**
 * Product Service
 *
 * 处理商品的 CRUD 操作，数据存储在 products.json
 * 现在所有商品（包括原来的静态商品）都存储在 products.json 中
 */

import fs from "fs";
import path from "path";
import type {
  DynamicProduct,
  CreateProductRequest,
  UpdateProductRequest,
} from "./products";
import { generateProductId, generateStoreId } from "./products";

const DATA_FILE = path.join(process.cwd(), "src/data/products.json");

// 存储在 JSON 中的店铺类型
export interface JsonStore {
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
}

interface ProductsData {
  products: DynamicProduct[];
  stores?: JsonStore[];
}

function readProductsFile(): ProductsData {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { products: [], stores: [] };
  }
}

// 获取所有店铺（从 JSON）
export function getJsonStores(): JsonStore[] {
  const data = readProductsFile();
  return data.stores || [];
}

function writeProductsFile(data: ProductsData): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// 获取所有商品
export function getAllProducts(): DynamicProduct[] {
  const data = readProductsFile();
  return data.products;
}

// 获取活跃商品
export function getActiveProducts(): DynamicProduct[] {
  return getAllProducts().filter((p) => p.status === "active");
}

// 根据 ID 获取商品
export function getProductById(id: string): DynamicProduct | null {
  const products = getAllProducts();
  return products.find((p) => p.id === id) || null;
}

// 根据 store ID 获取商品
export function getProductsByStoreId(storeId: string): DynamicProduct[] {
  return getAllProducts().filter((p) => p.storeId === storeId);
}

// 根据店铺名称查找已存在的 storeId
function findStoreIdByName(storeName: string): string | null {
  const products = getAllProducts();
  // 先检查预定义店铺
  const stores = getJsonStores();
  const existingStore = stores.find(
    (s) => s.name.toLowerCase() === storeName.toLowerCase()
  );
  if (existingStore) {
    return existingStore.id;
  }
  // 再检查动态商品的店铺
  const existingProduct = products.find(
    (p) => p.storeName.toLowerCase() === storeName.toLowerCase()
  );
  return existingProduct?.storeId || null;
}

// 创建商品
export function createProduct(req: CreateProductRequest): DynamicProduct {
  const data = readProductsFile();
  const now = new Date().toISOString();
  const productId = generateProductId();

  // 如果店铺名称已存在，使用已有的 storeId；否则生成新的
  const existingStoreId = findStoreIdByName(req.storeName);
  const storeId = existingStoreId || generateStoreId(productId);

  // 如果是新店铺，需要创建店铺条目
  if (!existingStoreId) {
    if (!data.stores) {
      data.stores = [];
    }
    const newStore: JsonStore = {
      id: storeId,
      name: req.storeName,
      tagline: req.storeTagline || `${req.storeName} - 欢迎选购`,
      imageUrl: req.storeImageUrl,
      sellerAgentId: req.sellerAgent.name || "seller-agent",
      sellerAgentName: req.sellerAgent.name || "卖家 Agent",
      sellerStyle: req.sellerAgent.style || "pro",
      categories: req.tags?.slice(0, 3) || ["NFT"],
      location: "全球",
      verified: false,
      rating: 5.0,
      orders: 0,
      responseMins: 1,
    };
    data.stores.push(newStore);
  }

  const product: DynamicProduct = {
    id: productId,
    name: req.name,
    type: req.type,
    description: req.description,
    priceUSDC: req.priceUSDC,
    imageUrl: req.imageUrl,
    nft: req.nft,
    acceptedPayments: req.acceptedPayments,
    sellerAgent: req.sellerAgent,
    storeId,
    storeName: req.storeName,
    createdAt: now,
    updatedAt: now,
    status: "active",
    highlights: req.highlights || [],
    tags: req.tags || [],
  };

  data.products.push(product);
  writeProductsFile(data);

  return product;
}

// 更新商品
export function updateProduct(
  id: string,
  updates: UpdateProductRequest
): DynamicProduct | null {
  const data = readProductsFile();
  const index = data.products.findIndex((p) => p.id === id);

  if (index === -1) {
    return null;
  }

  const existing = data.products[index];
  const updated: DynamicProduct = {
    ...existing,
    ...updates,
    // 保持不变的字段
    id: existing.id,
    storeId: existing.storeId,
    createdAt: existing.createdAt,
    // 更新时间
    updatedAt: new Date().toISOString(),
    // 合并嵌套对象
    sellerAgent: updates.sellerAgent
      ? { ...existing.sellerAgent, ...updates.sellerAgent }
      : existing.sellerAgent,
    nft: updates.nft ? { ...existing.nft, ...updates.nft } : existing.nft,
  };

  data.products[index] = updated;
  writeProductsFile(data);

  return updated;
}

// 删除商品（实际上是设为 inactive）
export function deactivateProduct(id: string): boolean {
  const data = readProductsFile();
  const index = data.products.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  data.products[index].status = "inactive";
  data.products[index].updatedAt = new Date().toISOString();
  writeProductsFile(data);

  return true;
}

// 彻底删除商品
export function deleteProduct(id: string): boolean {
  const data = readProductsFile();
  const index = data.products.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  data.products.splice(index, 1);
  writeProductsFile(data);

  return true;
}

// 重新激活商品
export function activateProduct(id: string): boolean {
  const data = readProductsFile();
  const index = data.products.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  data.products[index].status = "active";
  data.products[index].updatedAt = new Date().toISOString();
  writeProductsFile(data);

  return true;
}
