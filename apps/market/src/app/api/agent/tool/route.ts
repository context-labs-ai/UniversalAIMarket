import { ethers } from "ethers";
import { z } from "zod";
import { encodeBase64Url } from "@/lib/base64url";
import { STORES } from "@/lib/catalog";
import { createDeal, type Deal } from "@/lib/deal";
import { scoreText } from "@/lib/textScore";
import { getSessionFromRequest, isAuthRequired } from "@/lib/agentAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoMode = "testnet" | "simulate";

type SerializedDeal = {
  dealId: string;
  buyer: string;
  sellerBase: string;
  polygonEscrow: string;
  nft: string;
  tokenId: string;
  price: string;
  deadline: string;
};

function serializeDeal(deal: Deal): SerializedDeal {
  return {
    ...deal,
    tokenId: deal.tokenId.toString(),
    price: deal.price.toString(),
    deadline: deal.deadline.toString(),
  };
}

function pseudoAddress(label: string) {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(`universal-ai-market:${label}`));
  return ethers.getAddress(`0x${hash.slice(-40)}`);
}

function sellerAgentAddress(storeId: string) {
  return pseudoAddress(`seller-agent:${storeId}`);
}

function sellerAgentMeta(store: (typeof STORES)[number], origin?: string) {
  const chatEndpoint = origin ? new URL("/api/agent/tool", origin).toString() : "/api/agent/tool";
  return {
    id: store.sellerAgentId,
    name: store.sellerAgentName,
    address: sellerAgentAddress(store.id),
    chatEndpoint,
    chat: { tool: "seller_agent_chat" as const, args: { storeId: store.id } },
  };
}

function requireAuthIfEnabled(req: Request) {
  if (!isAuthRequired()) return { ok: true as const, session: null as ReturnType<typeof getSessionFromRequest> };
  const session = getSessionFromRequest(req);
  if (!session) return { ok: false as const, error: "Unauthorized" };
  return { ok: true as const, session };
}

const TOOL_DEFINITIONS = [
  {
    name: "search_stores",
    description: "Search stores in the marketplace catalog by keyword. Returns matched stores sorted by relevance.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword (e.g., 'weapon', 'coffee', 'NFT')",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return",
          default: 5,
          minimum: 1,
          maximum: 20,
        },
      },
      required: [],
    },
  },
  {
    name: "search_products",
    description: "Search products within a specific store by keyword.",
    parameters: {
      type: "object",
      properties: {
        storeId: {
          type: "string",
          description: "The store ID to search within (e.g., 'polyguns-armory')",
        },
        query: {
          type: "string",
          description: "Search keyword for products",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return",
          default: 5,
          minimum: 1,
          maximum: 20,
        },
      },
      required: ["storeId"],
    },
  },
  {
    name: "search_all_products",
    description: "Search products across all stores in the marketplace. Useful for finding specific items without knowing which store has them.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword for products",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return",
          default: 10,
          minimum: 1,
          maximum: 50,
        },
        filters: {
          type: "object",
          description: "Optional filters to narrow down results",
          properties: {
            kind: {
              type: "string",
              enum: ["digital", "physical"],
              description: "Filter by product type",
            },
            minPrice: {
              type: "string",
              description: "Minimum price in USDC",
            },
            maxPrice: {
              type: "string",
              description: "Maximum price in USDC",
            },
            demoReady: {
              type: "boolean",
              description: "Only show products ready for testnet demo",
            },
            inventory: {
              type: "string",
              enum: ["in_stock", "limited", "preorder"],
              description: "Filter by inventory status",
            },
          },
        },
      },
      required: [],
    },
  },
  {
    name: "get_store",
    description: "Get detailed information about a specific store by its ID.",
    parameters: {
      type: "object",
      properties: {
        storeId: {
          type: "string",
          description: "The store ID (e.g., 'polyguns-armory', 'crosschain-coffee')",
        },
      },
      required: ["storeId"],
    },
  },
  {
    name: "get_product",
    description: "Get detailed information about a specific product by store ID and product ID.",
    parameters: {
      type: "object",
      properties: {
        storeId: {
          type: "string",
          description: "The store ID containing the product",
        },
        productId: {
          type: "string",
          description: "The product ID (e.g., 'weapon-soulbound-sword')",
        },
      },
      required: ["storeId", "productId"],
    },
  },
  {
    name: "list_categories",
    description: "List all available product categories in the marketplace with store counts.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "seller_agent_chat",
    description:
      "Chat with a store's seller customer-support agent. Use this after you found a store/product and want to negotiate, ask questions, or confirm details.",
    parameters: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Store ID (from search_stores result)" },
        message: { type: "string", description: "Your message to the seller agent" },
        productId: { type: "string", description: "Optional product ID to give context" },
        conversationId: { type: "string", description: "Optional conversation ID to continue a thread" },
      },
      required: ["storeId", "message"],
    },
  },
  {
    name: "prepare_deal",
    description: "Create a cross-chain settlement deal payload. Computes the dealId hash for the given parameters. Use this before calling settle_deal.",
    parameters: {
      type: "object",
      properties: {
        buyer: {
          type: "string",
          description: "Buyer's Ethereum address (will receive NFT on Polygon)",
        },
        sellerBase: {
          type: "string",
          description: "Seller's address on Base chain (will receive USDC payment)",
        },
        polygonEscrow: {
          type: "string",
          description: "Escrow contract address on Polygon holding the NFT",
        },
        nft: {
          type: "string",
          description: "NFT contract address on Polygon",
        },
        tokenId: {
          type: ["integer", "string"],
          description: "Token ID of the NFT to be transferred",
        },
        priceUSDC: {
          type: "string",
          description: "Price in USDC (e.g., '80' for 80 USDC)",
        },
        deadlineSecondsFromNow: {
          type: "integer",
          description: "Deal expiration in seconds from now",
          default: 3600,
          minimum: 60,
        },
      },
      required: ["buyer", "sellerBase", "polygonEscrow", "nft", "tokenId", "priceUSDC"],
    },
  },
  {
    name: "settle_deal",
    description: "Returns a settlement SSE stream URL for executing a prepared deal. Connect to the URL to receive real-time progress updates.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["testnet", "simulate"],
          description: "Settlement mode: 'testnet' for real transactions, 'simulate' for demo",
          default: "simulate",
        },
        deal: {
          type: "object",
          description: "The serialized deal object from prepare_deal result",
          properties: {
            dealId: { type: "string" },
            buyer: { type: "string" },
            sellerBase: { type: "string" },
            polygonEscrow: { type: "string" },
            nft: { type: "string" },
            tokenId: { type: "string" },
            price: { type: "string" },
            deadline: { type: "string" },
          },
          required: ["dealId", "buyer", "sellerBase", "polygonEscrow", "nft", "tokenId", "price", "deadline"],
        },
      },
      required: ["deal"],
    },
  },
];

export async function GET(req: Request) {
  return Response.json({
    ok: true,
    authRequired: isAuthRequired(),
    tools: TOOL_DEFINITIONS,
  });
}

const BodySchema = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.any()).default({}),
});

function buildSellerAgentReply({
  store,
  product,
  message,
}: {
  store: (typeof STORES)[number];
  product?: (typeof STORES)[number]["products"][number];
  message: string;
}) {
  const text = message.toLowerCase();
  const wantsDiscount = /便宜|优惠|砍价|降价|太贵|打折|discount|cheaper/.test(text);
  const asksLeadTime = /发货|多久|交付|到货|物流|lead\s*time|shipping/.test(text);
  const asksPrice = /多少钱|价格|price|how much/.test(text);

  const styleFactor = store.sellerStyle === "strict" ? 0.95 : store.sellerStyle === "pro" ? 0.9 : 0.85;

  const basePrice = product ? Number(product.priceUSDC) : null;
  const canPrice = basePrice !== null && Number.isFinite(basePrice);
  const suggestedPrice = canPrice ? Math.max(0.01, Math.round(basePrice * styleFactor * 100) / 100) : null;

  const intro = `我是${store.sellerAgentName}（客服 Agent）。`;
  const productLine = product
    ? `你问的是「${product.name}」。标价 ${product.priceUSDC} USDC。`
    : "你想咨询哪个商品？你可以把 productId 一起发给我，我会给出更准确的报价/交付信息。";

  const leadTimeLine = product && asksLeadTime ? `交付/发货：${product.leadTime}。` : "";

  let priceLine = "";
  if (product && (asksPrice || wantsDiscount)) {
    if (wantsDiscount && suggestedPrice !== null) {
      priceLine = `给你一个限时价：${suggestedPrice.toFixed(2).replace(/\\.00$/, "")} USDC（${store.sellerStyle} 策略）。`;
    } else {
      priceLine = `当前价格：${product.priceUSDC} USDC。`;
    }
  }

  const nextStep = product
    ? "如果你接受报价，我可以进入下单环节：你准备好 buyer 地址后就可以 prepare_deal -> settle_deal。"
    : "";

  const reply = [intro, productLine, priceLine, leadTimeLine, nextStep].filter(Boolean).join("\n");

  return {
    reply,
    suggestedPriceUSDC: suggestedPrice !== null ? suggestedPrice.toFixed(2).replace(/\\.00$/, "") : null,
  };
}

export async function POST(req: Request) {
  const auth = requireAuthIfEnabled(req);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const name = parsed.data.name;
  const args = parsed.data.args ?? {};

  try {
    if (name === "search_stores") {
      const query = typeof args.query === "string" ? args.query : "";
      const limitRaw = typeof args.limit === "number" ? args.limit : 5;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 5;

      const scored = STORES.map((store) => {
        const content = `${store.name} ${store.tagline} ${store.location} ${store.categories.join(" ")} ${store.products
          .map((p) => `${p.name} ${p.description} ${p.tags.join(" ")} ${p.highlights.join(" ")}`)
          .join(" ")}`;
        return { store, score: scoreText(content, query) };
      }).sort((a, b) => b.score - a.score);

      return Response.json({
        ok: true,
        result: {
          stores: scored.slice(0, limit).map(({ store }) => ({
            id: store.id,
            name: store.name,
            tagline: store.tagline,
            location: store.location,
            verified: store.verified,
            rating: store.rating,
            orders: store.orders,
            responseMins: store.responseMins,
            categories: store.categories,
            sellerAgentName: store.sellerAgentName,
            sellerAgentId: store.sellerAgentId,
            sellerAgent: sellerAgentMeta(store, origin),
            hasDemoReady: store.products.some((p) => p.demoReady),
          })),
        },
      });
    }

    if (name === "search_products") {
      const storeId = typeof args.storeId === "string" ? args.storeId : "";
      const query = typeof args.query === "string" ? args.query : "";
      const limitRaw = typeof args.limit === "number" ? args.limit : 5;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 5;

      const store = STORES.find((s) => s.id === storeId);
      if (!store) throw new Error("Unknown storeId");

      const scored = store.products
        .map((product) => {
          const content = `${product.name} ${product.description} ${product.tags.join(" ")} ${product.highlights.join(
            " "
          )}`;
          return { product, score: scoreText(content, query) };
        })
        .sort((a, b) => b.score - a.score);

      return Response.json({
        ok: true,
        result: {
          storeId: store.id,
          store: {
            id: store.id,
            name: store.name,
            sellerAgentName: store.sellerAgentName,
            sellerAgentId: store.sellerAgentId,
            sellerAgent: sellerAgentMeta(store, origin),
          },
          products: scored.slice(0, limit).map(({ product }) => ({
            id: product.id,
            name: product.name,
            kind: product.kind,
            description: product.description,
            priceUSDC: product.priceUSDC,
            tokenId: product.tokenId,
            demoReady: product.demoReady,
            inventory: product.inventory,
            leadTime: product.leadTime,
            highlights: product.highlights,
            tags: product.tags,
          })),
        },
      });
    }

    if (name === "search_all_products") {
      const query = typeof args.query === "string" ? args.query : "";
      const limitRaw = typeof args.limit === "number" ? args.limit : 10;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 10;
      const filters = typeof args.filters === "object" && args.filters !== null ? args.filters : {};

      type ProductWithStore = {
        product: (typeof STORES)[0]["products"][0];
        store: (typeof STORES)[0];
        score: number;
      };

      const allProducts: ProductWithStore[] = [];
      for (const store of STORES) {
        for (const product of store.products) {
          if (filters.kind && product.kind !== filters.kind) continue;
          if (filters.demoReady !== undefined && product.demoReady !== filters.demoReady) continue;
          if (filters.inventory && product.inventory !== filters.inventory) continue;
          if (filters.minPrice && parseFloat(product.priceUSDC) < parseFloat(filters.minPrice)) continue;
          if (filters.maxPrice && parseFloat(product.priceUSDC) > parseFloat(filters.maxPrice)) continue;

          const content = `${product.name} ${product.description} ${product.tags.join(" ")} ${product.highlights.join(" ")}`;
          allProducts.push({ product, store, score: scoreText(content, query) });
        }
      }

      allProducts.sort((a, b) => b.score - a.score);

      return Response.json({
        ok: true,
        result: {
          total: allProducts.length,
          products: allProducts.slice(0, limit).map(({ product, store }) => ({
            id: product.id,
            name: product.name,
            kind: product.kind,
            description: product.description,
            priceUSDC: product.priceUSDC,
            tokenId: product.tokenId,
            demoReady: product.demoReady,
            inventory: product.inventory,
            leadTime: product.leadTime,
            highlights: product.highlights,
            tags: product.tags,
            store: {
              id: store.id,
              name: store.name,
              verified: store.verified,
              sellerAgentName: store.sellerAgentName,
              sellerAgentId: store.sellerAgentId,
              sellerAgent: sellerAgentMeta(store, origin),
            },
          })),
        },
      });
    }

    if (name === "get_store") {
      const storeId = typeof args.storeId === "string" ? args.storeId : "";
      const store = STORES.find((s) => s.id === storeId);
      if (!store) throw new Error("Store not found");

      return Response.json({
        ok: true,
        result: {
          id: store.id,
          name: store.name,
          tagline: store.tagline,
          location: store.location,
          verified: store.verified,
          rating: store.rating,
          orders: store.orders,
          responseMins: store.responseMins,
          categories: store.categories,
          sellerAgentName: store.sellerAgentName,
          sellerAgentId: store.sellerAgentId,
          sellerAgent: sellerAgentMeta(store, origin),
          sellerStyle: store.sellerStyle,
          productCount: store.products.length,
          products: store.products.map((p) => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
            priceUSDC: p.priceUSDC,
            demoReady: p.demoReady,
            inventory: p.inventory,
          })),
        },
      });
    }

    if (name === "get_product") {
      const storeId = typeof args.storeId === "string" ? args.storeId : "";
      const productId = typeof args.productId === "string" ? args.productId : "";

      const store = STORES.find((s) => s.id === storeId);
      if (!store) throw new Error("Store not found");

      const product = store.products.find((p) => p.id === productId);
      if (!product) throw new Error("Product not found");

      return Response.json({
        ok: true,
        result: {
          id: product.id,
          name: product.name,
          kind: product.kind,
          description: product.description,
          priceUSDC: product.priceUSDC,
          tokenId: product.tokenId,
          demoReady: product.demoReady,
          inventory: product.inventory,
          leadTime: product.leadTime,
          highlights: product.highlights,
          tags: product.tags,
          store: {
            id: store.id,
            name: store.name,
            verified: store.verified,
            sellerAgentName: store.sellerAgentName,
            sellerAgentId: store.sellerAgentId,
            sellerAgent: sellerAgentMeta(store, origin),
          },
        },
      });
    }

    if (name === "list_categories") {
      const categoryMap = new Map<string, { count: number; stores: string[] }>();

      for (const store of STORES) {
        for (const category of store.categories) {
          const existing = categoryMap.get(category);
          if (existing) {
            existing.count++;
            if (!existing.stores.includes(store.id)) {
              existing.stores.push(store.id);
            }
          } else {
            categoryMap.set(category, { count: 1, stores: [store.id] });
          }
        }
      }

      const categories = Array.from(categoryMap.entries())
        .map(([name, data]) => ({ name, storeCount: data.stores.length, stores: data.stores }))
        .sort((a, b) => b.storeCount - a.storeCount);

      return Response.json({
        ok: true,
        result: {
          total: categories.length,
          categories,
        },
      });
    }

    if (name === "seller_agent_chat") {
      const storeId = typeof args.storeId === "string" ? args.storeId : "";
      const message = typeof args.message === "string" ? args.message : "";
      const productId = typeof args.productId === "string" ? args.productId : "";
      const conversationId = typeof args.conversationId === "string" ? args.conversationId : crypto.randomUUID();

      if (!storeId) throw new Error("Missing storeId");
      if (!message) throw new Error("Missing message");

      const store = STORES.find((s) => s.id === storeId);
      if (!store) throw new Error("Store not found");

      const product = productId ? store.products.find((p) => p.id === productId) : undefined;
      const built = buildSellerAgentReply({ store, product, message });

      return Response.json({
        ok: true,
        result: {
          conversationId,
          sellerAgent: sellerAgentMeta(store, origin),
          storeId: store.id,
          productId: product?.id ?? null,
          ...built,
        },
      });
    }

    if (name === "prepare_deal") {
      const buyer = typeof args.buyer === "string" ? String(args.buyer) : "";
      const sellerBase = typeof args.sellerBase === "string" ? String(args.sellerBase) : "";
      const polygonEscrow = typeof args.polygonEscrow === "string" ? String(args.polygonEscrow) : "";
      const nft = typeof args.nft === "string" ? String(args.nft) : "";
      const tokenIdRaw = args.tokenId;
      const tokenId =
        typeof tokenIdRaw === "number" || typeof tokenIdRaw === "bigint"
          ? BigInt(tokenIdRaw)
          : typeof tokenIdRaw === "string"
            ? BigInt(tokenIdRaw)
            : undefined;
      const priceUSDC = typeof args.priceUSDC === "string" ? String(args.priceUSDC) : "";
      const deadlineSecondsFromNow = typeof args.deadlineSecondsFromNow === "number" ? args.deadlineSecondsFromNow : 3600;

      if (!ethers.isAddress(buyer)) throw new Error("Invalid buyer address");
      if (!ethers.isAddress(sellerBase)) throw new Error("Invalid sellerBase address");
      if (!ethers.isAddress(polygonEscrow)) throw new Error("Invalid polygonEscrow address");
      if (!ethers.isAddress(nft)) throw new Error("Invalid nft address");
      if (tokenId === undefined) throw new Error("Invalid tokenId");
      if (!priceUSDC) throw new Error("Missing priceUSDC");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, deadlineSecondsFromNow));
      const dealParams = {
        buyer: ethers.getAddress(buyer),
        sellerBase: ethers.getAddress(sellerBase),
        polygonEscrow: ethers.getAddress(polygonEscrow),
        nft: ethers.getAddress(nft),
        tokenId,
        price: ethers.parseUnits(priceUSDC, 6),
        deadline,
      } as const;
      const deal = createDeal(dealParams);
      const serialized = serializeDeal(deal);

      return Response.json({
        ok: true,
        result: {
          deal: serialized,
          dealId: deal.dealId,
          deadlineISO: new Date(Number(deal.deadline) * 1000).toISOString(),
        },
      });
    }

    if (name === "settle_deal") {
      const mode: DemoMode = args.mode === "testnet" ? "testnet" : "simulate";
      const deal = args.deal as SerializedDeal | undefined;
      if (!deal || typeof deal !== "object") throw new Error("Missing deal");
      if (!deal.dealId) throw new Error("Missing deal.dealId");

      const encoded = encodeBase64Url(JSON.stringify(deal));
      const streamUrl = `/api/settle/stream?mode=${mode}&deal=${encoded}`;

      return Response.json({
        ok: true,
        result: {
          streamUrl,
          sseEvents: ["step", "log", "done", "error"],
        },
      });
    }

    return Response.json({ ok: false, error: "Unknown tool name" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
