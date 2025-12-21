/**
 * Dynamic Product Registry
 *
 * 商品数据分为两部分：
 * 1. products.json (后端) - 商品信息和 seller agent 配置（不含私钥）
 * 2. localStorage (前端) - seller 钱包私钥
 */

export type ProductType = "nft" | "digital" | "physical";
export type ProductStatus = "active" | "inactive";
export type SellerStyle = "aggressive" | "pro" | "friendly";
export type ChainId = "polygon" | "base" | "ethereum" | "zetachain";
export type PaymentMethod = "USDC_BASE" | "USDC_POLYGON" | "ETH_BASE" | "MATIC_POLYGON";

export interface SellerAgentConfig {
  name: string;
  style: SellerStyle;
  walletAddress: string;  // 公钥地址（私钥存前端 localStorage）
  minPriceFactor: number; // 最低价格系数 (0.7 = 最低7折)
  maxDiscountPerRound: number; // 每轮最大降价 (0.05 = 5%)
  prompt?: string; // 可选的自定义 prompt
}

export interface NFTConfig {
  chain: ChainId;
  contractAddress: string;
  tokenId: number;
  escrowAddress?: string; // 可选，用户可能还没部署
}

export interface DynamicProduct {
  id: string;
  name: string;
  type: ProductType;
  description: string;
  priceUSDC: string;
  imageUrl?: string;

  // NFT 相关配置（type === "nft" 时必填）
  nft?: NFTConfig;

  // 接受的支付方式
  acceptedPayments: PaymentMethod[];

  // Seller Agent 配置
  sellerAgent: SellerAgentConfig;

  // 元数据
  storeId: string;
  storeName: string;
  createdAt: string;
  updatedAt: string;
  status: ProductStatus;

  // 兼容旧字段
  highlights?: string[];
  tags?: string[];
}

// 用于前端 localStorage 存储
export interface SellerWalletStore {
  [productId: string]: {
    address: string;
    privateKey: string;
  };
}

// API 请求类型
export interface CreateProductRequest {
  name: string;
  type: ProductType;
  description: string;
  priceUSDC: string;
  imageUrl?: string;

  nft?: NFTConfig;
  acceptedPayments: PaymentMethod[];

  sellerAgent: {
    name: string;
    style: SellerStyle;
    walletAddress: string;
    minPriceFactor: number;
    maxDiscountPerRound: number;
    prompt?: string;
  };

  storeName: string;
  storeTagline?: string;   // 店铺标语（可选）
  storeImageUrl?: string;  // 店铺图片（可选）
  highlights?: string[];
  tags?: string[];
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  status?: ProductStatus;
}

// 生成唯一 ID
export function generateProductId(): string {
  return `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 生成 store ID（基于商品 ID）
export function generateStoreId(productId: string): string {
  return `store-${productId}`;
}
