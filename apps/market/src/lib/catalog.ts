export type ProductKind = "digital" | "physical";

export type InventoryStatus = "in_stock" | "limited" | "preorder";

export interface Product {
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
}

export interface Store {
  id: string;
  name: string;
  tagline: string;
  sellerAgentId: string;
  sellerAgentName: string;
  sellerStyle: "friendly" | "strict" | "pro";
  categories: string[];
  location: string;
  verified: boolean;
  rating: number;
  orders: number;
  responseMins: number;
  products: Product[];
}

export const STORES: Store[] = [
  {
    id: "polyguns-armory",
    sellerAgentId: "seller-polyguns-armory",
    name: "Polyguns 军械库",
    tagline: "游戏级武器，Polygon 托管，付款后自动交付。",
    sellerAgentName: "军械库 Agent",
    sellerStyle: "pro",
    categories: ["数字商品", "NFT", "游戏"],
    location: "深圳",
    verified: true,
    rating: 4.9,
    orders: 12840,
    responseMins: 1,
    products: [
      {
        id: "weapon-soulbound-sword",
        name: "量子之剑（NFT）",
        kind: "digital",
        description: "传奇武器 NFT，托管在 Polygon。只有跨链付款完成后才会自动释放给买家。",
        priceUSDC: "0.5",
        tokenId: 1,
        demoReady: true,
        inventory: "limited",
        leadTime: "秒级交付（跨链完成后释放）",
        tags: ["武器", "游戏", "托管", "跨链", "ZetaChain", "Polygon"],
        highlights: ["Polygon 托管交付", "ZetaChain 原子级结算", "所有权变化可验证"],
      },
      {
        id: "weapon-lance",
        name: "离子长枪（NFT）",
        kind: "digital",
        description: "高精度能量长枪，所有权可证明。适合 PvP Demo 和链上成就展示。",
        priceUSDC: "120",
        tokenId: 2,
        demoReady: false,
        inventory: "preorder",
        leadTime: "预售（演示可用：模拟模式）",
        tags: ["武器", "PvP", "链上成就", "跨链结算"],
        highlights: ["Polygon 交付", "链上凭证", "可扩展为可上架商品"],
      },
      {
        id: "weapon-shield",
        name: "相位护盾（NFT）",
        kind: "digital",
        description: "防御型装备 NFT，适合展示「先托管、后结算、再交付」的跨链电商逻辑。",
        priceUSDC: "45",
        tokenId: 3,
        demoReady: false,
        inventory: "in_stock",
        leadTime: "秒级交付（演示可用：模拟模式）",
        tags: ["防具", "托管", "原子结算", "跨链电商"],
        highlights: ["适合新手体验", "低客单价", "交付路径清晰"],
      },
    ],
  },
  {
    id: "crosschain-coffee",
    sellerAgentId: "seller-crosschain-coffee",
    name: "跨链咖啡馆",
    tagline: "实物链下发货，链上收据可验真。",
    sellerAgentName: "咖啡师 Agent",
    sellerStyle: "friendly",
    categories: ["实物", "周边", "订阅"],
    location: "上海",
    verified: true,
    rating: 4.7,
    orders: 6230,
    responseMins: 3,
    products: [
      {
        id: "coffee-beans",
        name: "埃塞俄比亚咖啡豆（收据 NFT）",
        kind: "physical",
        description:
          "精品咖啡豆链下发货，但交易在 Base 完成结算，并在 Polygon 发放收据 NFT 用于验真/兑换权益。",
        priceUSDC: "0.5",
        tokenId: 7,
        demoReady: true,
        inventory: "in_stock",
        leadTime: "48 小时内发货 + 收据 NFT 秒级交付",
        tags: ["实物", "收据", "验真", "权益", "订阅"],
        highlights: ["收据 NFT 证明购买", "评委友好叙事", "卖家 Agent 可更新发货状态"],
      },
      {
        id: "coffee-monthly",
        name: "每月咖啡订阅（收据 NFT）",
        kind: "physical",
        description: "每月订阅收据 NFT。后续可以基于持有收据做权益门槛，并支持在任意链付款。",
        priceUSDC: "15",
        tokenId: 8,
        demoReady: false,
        inventory: "preorder",
        leadTime: "每月 1 次发货（演示可用：模拟模式）",
        tags: ["订阅", "权益", "会员", "跨链支付"],
        highlights: ["订阅制原语", "持币门槛解锁权益", "跨链支付扩展空间"],
      },
      {
        id: "coffee-cup",
        name: "联名马克杯（收据 NFT）",
        kind: "physical",
        description: "联名周边链下发货，链上收据作为保修/兑换凭证，也可用于后续空投与会员权益。",
        priceUSDC: "12",
        tokenId: 9,
        demoReady: false,
        inventory: "limited",
        leadTime: "3-5 天发货（演示可用：模拟模式）",
        tags: ["周边", "保修", "兑换", "空投", "会员"],
        highlights: ["低门槛下单", "收据可追溯", "可扩展为权益体系"],
      },
    ],
  },
  {
    id: "agent-devtools",
    sellerAgentId: "seller-agent-devtools",
    name: "Agent 开发者商店",
    tagline: "卖的是能力：插件、API 配额、自动化脚本（交付为许可 NFT）。",
    sellerAgentName: "DevTools Agent",
    sellerStyle: "strict",
    categories: ["数字商品", "工具", "开发者"],
    location: "杭州",
    verified: false,
    rating: 4.6,
    orders: 1840,
    responseMins: 5,
    products: [
      {
        id: "api-credits",
        name: "推理 API 额度包（许可 NFT）",
        kind: "digital",
        description: "购买后在 Polygon 发放许可 NFT，可用于兑换 API 调用额度或解锁模型能力。",
        priceUSDC: "30",
        tokenId: 11,
        demoReady: false,
        inventory: "in_stock",
        leadTime: "秒级交付（演示可用：模拟模式）",
        tags: ["API", "额度", "许可", "开发者", "模型"],
        highlights: ["清晰的权益映射", "适合 B2D 场景", "可扩展为订阅"],
      },
      {
        id: "agent-workflow",
        name: "Agent 工作流模板（许可 NFT）",
        kind: "digital",
        description: "一套可复用的买卖家 Agent 工作流模板，附带工具调用示例与提示词结构。",
        priceUSDC: "18",
        tokenId: 12,
        demoReady: false,
        inventory: "in_stock",
        leadTime: "秒级交付（演示可用：模拟模式）",
        tags: ["工作流", "模板", "工具调用", "提示词", "Hackathon"],
        highlights: ["即插即用", "适合 Demo", "可快速二次开发"],
      },
    ],
  },
  {
    id: "ai-gallery",
    sellerAgentId: "seller-ai-gallery",
    name: "AI 艺术画廊",
    tagline: "数字作品上链交付，跨链结算更丝滑。",
    sellerAgentName: "策展人 Agent",
    sellerStyle: "pro",
    categories: ["数字商品", "艺术", "收藏"],
    location: "北京",
    verified: true,
    rating: 4.8,
    orders: 3920,
    responseMins: 2,
    products: [
      {
        id: "poster-1",
        name: "生成艺术海报 #1（NFT）",
        kind: "digital",
        description: "一幅生成艺术海报 NFT。适合展示跨链「支付 + 交付」的完整闭环。",
        priceUSDC: "60",
        tokenId: 21,
        demoReady: false,
        inventory: "limited",
        leadTime: "秒级交付（演示可用：模拟模式）",
        tags: ["艺术", "收藏", "NFT", "海报"],
        highlights: ["高辨识度视觉叙事", "可展示版权/授权", "适合评委展示"],
      },
      {
        id: "poster-2",
        name: "生成艺术海报 #2（NFT）",
        kind: "digital",
        description: "另一幅风格化作品 NFT，可扩展为系列化发售与跨链促销。",
        priceUSDC: "55",
        tokenId: 22,
        demoReady: false,
        inventory: "in_stock",
        leadTime: "秒级交付（演示可用：模拟模式）",
        tags: ["系列", "限量", "跨链促销"],
        highlights: ["系列化叙事", "促销可扩展", "可组合 DeFi 激励"],
      },
    ],
  },
];
