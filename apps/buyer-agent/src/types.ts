/**
 * Buyer Agent API Protocol
 *
 * 这个文件定义了 Buyer Agent 需要实现的 API 接口。
 * 用户可以自己托管 Buyer Agent，只需要实现这些接口即可。
 */

// ============================================
// 1. 砍价请求/响应 (POST /negotiate)
// ============================================

export interface NegotiateRequest {
  sessionId: string;
  round: number;
  stage: "opening" | "bargain" | "counter" | "accept" | "reject";

  // 商品信息
  product: {
    id: string;
    name: string;
    listPriceUSDC: string;
    highlights?: string[];
  };

  // 卖家信息
  seller: {
    id: string;
    name: string;
    storeName: string;
    style?: "friendly" | "strict" | "pro";
  };

  // 当前报价状态
  currentQuote?: {
    sellerPriceUSDC: string;  // 卖家当前报价
    buyerOfferUSDC?: string;  // 买家上次出价
  };

  // 卖家的最新消息（如果有）
  sellerMessage?: string;

  // 要求 Agent 生成的回复类型
  expectedAction: "reply" | "decide";  // reply=生成回复, decide=决定是否接受
}

export interface NegotiateResponse {
  ok: true;

  // 生成的回复消息
  message: string;

  // 如果 expectedAction=decide，返回决策
  decision?: {
    accept: boolean;           // 是否接受当前报价
    acceptedPrice?: string;    // 如果接受，明确指定接受的价格（数字字符串）
    offerPriceUSDC?: string;   // 如果不接受，给出新的出价
    reason?: string;           // 决策原因（用于 debug）
  };
}

// ============================================
// 2. 签名请求/响应 (POST /sign)
// ============================================

export interface SignRequest {
  type: "eip712";
  chainId: number;

  // EIP-712 domain
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };

  // EIP-712 types
  types: {
    [key: string]: Array<{ name: string; type: string }>;
  };

  // 待签名的消息
  message: {
    buyer: string;
    seller: string;
    priceUSDC: string;
    nftContract: string;
    tokenId: string;
    deadline: number;
    [key: string]: unknown;
  };

  // 订单元信息
  dealMeta: {
    orderId: string;
    productName: string;
    storeName: string;
    timestamp: number;
  };
}

export interface SignResponse {
  ok: true;
  signature: string;    // 0x... (65 bytes compact signature)
  signer: string;       // Agent 的地址，用于验证
}

// ============================================
// 3. Agent 配置查询 (GET /config)
// ============================================

export interface AgentConfigResponse {
  ok: true;

  // Agent 基本信息
  name: string;
  version: string;

  // 钱包地址（用于签名验证）
  address: string;

  // 预算设置
  budget: {
    maxPerDealUSDC: string;   // 单笔交易最大金额
    totalBudgetUSDC: string;  // 总预算
    spentUSDC: string;        // 已花费
  };

  // 砍价策略（可选展示）
  strategy?: {
    minDiscountPercent: number;  // 期望最低折扣
    maxRounds: number;           // 最大砍价轮数
    style: "aggressive" | "balanced" | "conservative";
  };

  // 支持的功能
  capabilities: {
    negotiate: boolean;  // 支持砍价
    sign: boolean;       // 支持签名
    autoSettle: boolean; // 支持自动结算
  };
}

// ============================================
// 4. 错误响应
// ============================================

export interface ErrorResponse {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = T | ErrorResponse;
