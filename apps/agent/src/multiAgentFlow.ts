import { randomUUID } from "crypto";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { MarketClient } from "./marketClient.js";
import type { CheckoutMode, DemoMode, FlowEmitter } from "./flowEmitter.js";
import { waitForConfirm } from "./sessionStore.js";

type LlmConfig = {
  model: string;
  openAIApiKey?: string;
  openAIBaseUrl?: string;
};

// ============================================
// Buyer Agent API Types
// ============================================

type BuyerAgentNegotiateRequest = {
  sessionId: string;
  round: number;
  stage: "opening" | "bargain" | "counter" | "accept" | "reject";
  product: {
    id: string;
    name: string;
    listPriceUSDC: string;
    highlights?: string[];
  };
  seller: {
    id: string;
    name: string;
    storeName: string;
    style?: "friendly" | "strict" | "pro";
  };
  currentQuote?: {
    sellerPriceUSDC: string;
    buyerOfferUSDC?: string;
  };
  sellerMessage?: string;
  expectedAction: "reply" | "decide";
};

type BuyerAgentNegotiateResponse = {
  ok: true;
  message: string;
  decision?: {
    accept: boolean;
    acceptedPrice?: string;
    offerPriceUSDC?: string;
    reason?: string;
  };
};

type BuyerAgentConfigResponse = {
  ok: true;
  name: string;
  address: string;
  budget: {
    maxPerDealUSDC: string;
    totalBudgetUSDC: string;
    spentUSDC: string;
  };
};

type BuyerAgentSignRequest = {
  type: "eip712";
  chainId: number;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
  dealMeta: {
    orderId: string;
    productName: string;
    storeName: string;
    timestamp: number;
  };
};

type BuyerAgentSignResponse = {
  ok: true;
  signature: string;
  signer: string;
};

type SellerPrepareDealResponse = {
  ok: boolean;
  dealReady?: boolean;
  sellerId?: string;
  sellerName?: string;
  deal?: {
    productId: string;
    productName: string;
    storeId: string;
    storeName: string;
    listPriceUSDC: string;
    finalPriceUSDC: string;
    discount: number;
  };
  error?: string;
};

type CatalogStore = {
  id: string;
  name: string;
  sellerAgentName?: string;
  sellerAgentId?: string;
  sellerStyle?: "friendly" | "strict" | "pro";
  sellerAgent?: { id?: string; name?: string; address?: string };
};

type CatalogProduct = {
  id: string;
  name: string;
  priceUSDC: string;
  tokenId: number;
  highlights?: string[];
  inventory?: string;
  leadTime?: string;
  // 商品的 Seller Agent 配置（Market API 返回 sellerConfig 字段）
  sellerConfig?: {
    name?: string;
    style?: "aggressive" | "pro" | "friendly";
    walletAddress?: string;
    minPriceFactor?: number;
    maxDiscountPerRound?: number;
    prompt?: string;
  };
};

type SellerThread = {
  store: CatalogStore;
  product: CatalogProduct;
  transcript: Array<{ speaker: "buyer" | "seller"; content: string }>;
  lastQuoteUSDC?: number;
  sellerUpstream?: string;
};

function isPresent(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSellerUpstreams(): string[] {
  const list = isPresent(process.env.SELLER_AGENT_URLS)
    ? process.env.SELLER_AGENT_URLS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const a = isPresent(process.env.SELLER_AGENT_A_URL) ? process.env.SELLER_AGENT_A_URL.trim() : "";
  const b = isPresent(process.env.SELLER_AGENT_B_URL) ? process.env.SELLER_AGENT_B_URL.trim() : "";
  const combined = [...list, ...[a, b].filter(Boolean)];
  const unique: string[] = [];
  for (const url of combined) {
    if (!unique.includes(url)) unique.push(url);
  }
  console.log(`[multiAgentFlow] Seller upstreams: ${JSON.stringify(unique)}`);
  return unique;
}

function getBuyerAgentUrl(): string | null {
  return isPresent(process.env.BUYER_AGENT_URL) ? process.env.BUYER_AGENT_URL.trim() : null;
}

// ============================================
// Buyer Agent API Client
// ============================================

async function callBuyerAgentConfig(
  upstream: string,
  signal: AbortSignal
): Promise<BuyerAgentConfigResponse | null> {
  try {
    const res = await fetch(`${upstream}/config`, { signal });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as BuyerAgentConfigResponse | null;
    return json?.ok ? json : null;
  } catch {
    return null;
  }
}

async function callBuyerAgentNegotiate(
  upstream: string,
  payload: BuyerAgentNegotiateRequest,
  signal: AbortSignal
): Promise<BuyerAgentNegotiateResponse | null> {
  try {
    const res = await fetch(`${upstream}/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as BuyerAgentNegotiateResponse | null;
    return json?.ok ? json : null;
  } catch {
    return null;
  }
}

async function callBuyerAgentSign(
  upstream: string,
  payload: BuyerAgentSignRequest,
  signal: AbortSignal
): Promise<BuyerAgentSignResponse | null> {
  try {
    const res = await fetch(`${upstream}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as BuyerAgentSignResponse | null;
    return json?.ok ? json : null;
  } catch {
    return null;
  }
}

/**
 * 调用 Seller Agent 的 prepare_deal 接口
 * 从聊天记录中提取最终成交价格
 */
async function callSellerPrepareDeal(
  upstream: string,
  payload: {
    sessionId: string;
    transcript: Array<{ speaker: "buyer" | "seller"; content: string }>;
    product: { id: string; name: string; listPriceUSDC: string };
    store: { id: string; name: string };
    sellerConfig?: {
      name?: string;
      style?: "aggressive" | "pro" | "friendly";
      minPriceFactor?: number;
      maxDiscountPerRound?: number;
      prompt?: string;
    };
  },
  signal: AbortSignal
): Promise<SellerPrepareDealResponse | null> {
  try {
    // upstream 可能是 http://localhost:8081/api/seller/chat 格式
    // 需要提取基础 URL 来调用 prepare_deal
    const baseUrl = upstream.replace(/\/api\/seller\/chat$/, "");
    const url = `${baseUrl}/api/seller/prepare_deal`;
    console.log(`[multiAgentFlow] Calling prepare_deal: ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) {
      console.warn(`[multiAgentFlow] prepare_deal returned ${res.status}`);
      return null;
    }
    const json = (await res.json().catch(() => null)) as SellerPrepareDealResponse | null;
    console.log(`[multiAgentFlow] prepare_deal result:`, JSON.stringify(json));
    return json;
  } catch (err) {
    console.warn(`[multiAgentFlow] callSellerPrepareDeal failed:`, err);
    return null;
  }
}

function stageForTool(name: string) {
  if (name === "search_stores" || name === "search_products" || name === "search_all_products") return "browse";
  if (name === "prepare_deal") return "prepare";
  return "settle";
}

function parsePriceUSDC(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function priceString(value: number) {
  return round2(value).toFixed(2).replace(/\.00$/, "");
}

function extractQuotedUSDC(text: string): number | null {
  const m =
    text.match(/报价[:：]?\s*(\d+(?:\.\d+)?)\s*USDC/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*USDC/i) ??
    text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function sellerFloorFactor(style: CatalogStore["sellerStyle"]) {
  if (style === "strict") return 0.95;
  if (style === "pro") return 0.9;
  return 0.85;
}

function buildBuyerSystemPrompt(goal: string, buyerNote: string, budgetUSDC?: number) {
  const lines = [
    "你是买家 Agent，要在电商市场中完成一次购买。",
    "你会同时联系多个卖家客服 Agent 获取报价并砍价，然后选择更划算的一家下单。",
    "要求：中文、简洁、自然对话；可以强势但禁止辱骂/脏话/人身攻击。",
    "每次给卖家发消息 1-2 句，必要时包含明确的价格数字（USDC）。",
    "",
    `目标：${goal}`,
    buyerNote.trim() ? `补充：${buyerNote.trim()}` : "",
  ];
  if (budgetUSDC !== undefined && budgetUSDC < 9999) {
    lines.push(`【重要】你的预算上限是 ${budgetUSDC} USDC。你的出价必须低于商品标价，且不能超过预算。绝对不要报出比标价更高的价格！`);
  }
  return lines.filter(Boolean).join("\n");
}

function buildSellerSystemPrompt(store: CatalogStore, product: CatalogProduct) {
  const agentName = store.sellerAgentName || store.sellerAgent?.name || "卖家客服 Agent";
  const storeName = store.name || store.id;
  const style = store.sellerStyle || "pro";
  const basePrice = parsePriceUSDC(product.priceUSDC) ?? 80;
  const floor = round2(basePrice * sellerFloorFactor(style));

  return [
    `你是${agentName}，代表店铺「${storeName}」和买家沟通并促成交易。`,
    "你是一个独立的卖家客服 Agent，需要真实对话、解释价值、回应砍价。",
    "要求：中文、专业但有情绪张力（可轻微争辩/拉扯），禁止辱骂/脏话/人身攻击。",
    "每次回复 1-3 句，必须包含一行明确报价，格式：报价: <数字> USDC。",
    `定价策略：你是 ${style} 风格；标价 ${product.priceUSDC} USDC；最低心理价约 ${priceString(floor)} USDC（可略高，不要低于它）。`,
    product.leadTime ? `交付/发货：${product.leadTime}` : "",
    product.inventory ? `库存：${product.inventory}` : "",
    product.highlights?.length ? `亮点：${product.highlights.slice(0, 3).join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callSellerAgent(
  upstream: string,
  payload: {
    sessionId: string;
    round: number;
    buyerMessage: string;
    store: { id: string; name?: string };
    product: { id: string; name?: string; priceUSDC?: string; highlights?: string[]; inventory?: string };
    sellerConfig?: {
      name?: string;
      style?: "aggressive" | "pro" | "friendly";
      minPriceFactor?: number;
      maxDiscountPerRound?: number;
      prompt?: string;
    };
  },
  signal: AbortSignal
): Promise<{ sellerName?: string; reply?: string; quotePriceUSDC?: string } | null> {
  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as any;
    if (!json || json.ok !== true) return null;
    return {
      sellerName: typeof json.sellerName === "string" ? json.sellerName : undefined,
      reply: typeof json.reply === "string" ? json.reply : undefined,
      quotePriceUSDC: typeof json.quotePriceUSDC === "string" ? json.quotePriceUSDC : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 调用 Seller Agent 生成成交确认消息
 * 专门用于成交时，让 seller 用自己的话术风格确认成交
 */
async function callSellerClosingMessage(
  upstream: string,
  payload: {
    sessionId: string;
    finalPrice: number;
    store: { id: string; name?: string };
    product: { id: string; name?: string; priceUSDC?: string };
    sellerConfig?: {
      name?: string;
      style?: "aggressive" | "pro" | "friendly";
      prompt?: string;
    };
  },
  signal: AbortSignal
): Promise<string | null> {
  try {
    // 使用 chat 接口，但发送成交确认消息
    console.log(`[callSellerClosingMessage] Calling ${upstream}`);
    const res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: payload.sessionId,
        round: 99, // 特殊轮次表示成交
        buyerMessage: `成交！我同意 ${payload.finalPrice.toFixed(2)} USDC 的价格，请确认订单。`,
        store: payload.store,
        product: payload.product,
        sellerConfig: payload.sellerConfig,
      }),
      signal,
    });
    console.log(`[callSellerClosingMessage] Response status: ${res.status}`);
    if (!res.ok) {
      console.log(`[callSellerClosingMessage] Response not ok`);
      return null;
    }
    const json = (await res.json().catch((e) => {
      console.log(`[callSellerClosingMessage] JSON parse error: ${e}`);
      return null;
    })) as any;
    console.log(`[callSellerClosingMessage] Response JSON: ${JSON.stringify(json).slice(0, 200)}`);
    if (!json || json.ok !== true || !json.reply) {
      console.log(`[callSellerClosingMessage] Invalid response: ok=${json?.ok}, reply=${!!json?.reply}`);
      return null;
    }
    return json.reply;
  } catch (err) {
    console.log(`[callSellerClosingMessage] Error: ${err}`);
    return null;
  }
}

function toChat(llmCfg: LlmConfig, temperature: number) {
  return new ChatOpenAI({
    model: llmCfg.model,
    apiKey: llmCfg.openAIApiKey,
    configuration: llmCfg.openAIBaseUrl ? { baseURL: llmCfg.openAIBaseUrl } : undefined,
    temperature,
  });
}

async function agentReply({
  chat,
  systemPrompt,
  transcript,
  self,
  instruction,
}: {
  chat: ChatOpenAI;
  systemPrompt: string;
  transcript: SellerThread["transcript"];
  self: "buyer" | "seller";
  instruction: string;
}) {
  const messages = [new SystemMessage(systemPrompt)];
  for (const turn of transcript) {
    messages.push(turn.speaker === self ? new AIMessage(turn.content) : new HumanMessage(turn.content));
  }
  messages.push(new HumanMessage(instruction));
  const res = await chat.invoke(messages);
  return res.content.toString().trim();
}

function fallbackBuyerMessage(goal: string, offer?: string) {
  return offer ? `我对这个很感兴趣，但预算有限。我出 ${offer} USDC，行不行？` : `你好，我想买：${goal}。能给个报价吗？`;
}

function fallbackSellerMessage(store: CatalogStore, product: CatalogProduct, quote: string) {
  const agentName = store.sellerAgentName || store.sellerAgent?.name || "卖家客服 Agent";
  return `我是${agentName}。${product.name} 这款很适合你。\n报价: ${quote} USDC`;
}

async function readSseStream(body: ReadableStream<Uint8Array>, onEvent: (evt: string, data: string) => void, signal: AbortSignal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    if (signal.aborted) return;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) break;
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = chunk.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      onEvent(event, data);
    }
  }
}

// Extract budget from goal text (e.g., "10 USDC 以内" -> 10)
function extractBudgetFromGoal(goal: string): number | null {
  const match = goal.match(/(\d+(?:\.\d+)?)\s*USDC\s*(?:以内|内|以下)/i);
  if (match) {
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function runMultiAgentFlow({
  market,
  llmCfg,
  configJson,
  mode,
  checkoutMode,
  goal,
  buyerNote,
  budgetUSDC,
  buyerAgentUrl: buyerAgentUrlParam,
  emitter,
  sessionId,
  startedAt,
  signal,
  now,
}: {
  market: MarketClient;
  llmCfg: LlmConfig;
  configJson: unknown;
  mode: DemoMode;
  checkoutMode: CheckoutMode;
  goal: string;
  buyerNote: string;
  budgetUSDC?: number; // Optional explicit budget; if not provided, extracted from goal
  buyerAgentUrl?: string; // Optional external Buyer Agent URL
  emitter: FlowEmitter;
  sessionId: string;
  startedAt: number;
  signal: AbortSignal;
  now: () => number;
}) {
  // Check for external Buyer Agent
  const buyerAgentUrl = buyerAgentUrlParam || getBuyerAgentUrl();
  let buyerAgentConfig: BuyerAgentConfigResponse | null = null;

  if (buyerAgentUrl) {
    console.log(`[multiAgentFlow] Using external Buyer Agent: ${buyerAgentUrl}`);
    buyerAgentConfig = await callBuyerAgentConfig(buyerAgentUrl, signal);
    if (buyerAgentConfig) {
      console.log(`[multiAgentFlow] Buyer Agent: ${buyerAgentConfig.name}, address: ${buyerAgentConfig.address}`);
      console.log(`[multiAgentFlow] Budget: max ${buyerAgentConfig.budget.maxPerDealUSDC} USDC per deal (total: ${buyerAgentConfig.budget.totalBudgetUSDC} USDC)`);
    } else {
      console.warn(`[multiAgentFlow] Failed to connect to Buyer Agent at ${buyerAgentUrl}, falling back to internal LLM`);
    }
  }

  // Determine buyer's budget
  // Priority: explicit budgetUSDC param > goal text extraction > buyerAgentConfig > default
  const goalBudget = extractBudgetFromGoal(goal);
  const agentBudget = buyerAgentConfig ? parseFloat(buyerAgentConfig.budget.maxPerDealUSDC) : null;
  const budget = budgetUSDC ?? goalBudget ?? agentBudget ?? 999999;
  console.log(`[multiAgentFlow] Budget: ${budget} USDC (from: ${budgetUSDC ? 'param' : goalBudget ? 'goal' : agentBudget ? 'agent' : 'default'})`);

  const emitTool = async <T,>(name: string, args: unknown, runner: () => Promise<T>) => {
    const id = randomUUID();
    emitter.toolCall({ id, stage: stageForTool(name), name, args, ts: now() } as any);
    try {
      const result = await runner();
      emitter.toolResult({ id, result, ts: now() } as any);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool failed";
      emitter.toolResult({ id, result: { ok: false, error: message }, ts: now() } as any);
      throw err;
    }
  };

  emitter.state({ running: true, settling: false, awaitingConfirm: false, sessionId });
  emitter.timelineStep({ id: "browse", status: "running", detail: "搜索店铺/商品（多卖家比价）", ts: now() });

  const storesRes = (await emitTool("search_stores", { query: goal, limit: 5 }, () =>
    market.invokeTool("search_stores", { query: goal, limit: 5 })
  )) as any;
  const stores: CatalogStore[] = Array.isArray(storesRes?.stores) ? storesRes.stores : [];
  if (stores.length === 0) throw new Error("No store found");

  const pickedStores = stores.slice(0, 2);
  const sellerUpstreams = getSellerUpstreams();

  const threads: SellerThread[] = [];
  for (const store of pickedStores) {
    const productsRes = (await emitTool("search_products", { storeId: store.id, query: goal, limit: 10 }, () =>
      market.invokeTool("search_products", { storeId: store.id, query: goal, limit: 10 })
    )) as any;

    const products: CatalogProduct[] = Array.isArray(productsRes?.products) ? productsRes.products : [];
    if (products.length === 0) continue;

    const product = products
      .map((p) => ({ p, price: parsePriceUSDC(p?.priceUSDC) }))
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0]?.p;
    if (!product) continue;
    // 如果只有一个 seller upstream，所有线程都用它；否则按索引分配
    const sellerUpstream = sellerUpstreams.length === 1
      ? sellerUpstreams[0]
      : (sellerUpstreams[threads.length] ?? sellerUpstreams[0] ?? undefined);
    console.log(`[multiAgentFlow] Thread ${threads.length}: store=${store.id}, sellerUpstream=${sellerUpstream || 'NONE'}`);
    threads.push({ store, product, transcript: [], sellerUpstream });
  }

  if (threads.length === 0) throw new Error("No product found in picked stores");

  emitter.timelineStep({ id: "browse", status: "done", detail: `找到 ${threads.length} 个卖家候选`, ts: now() });

  const buyerAgentName = buyerAgentConfig?.name || "买家 Agent";
  const negotiateDetail = buyerAgentUrl && buyerAgentConfig
    ? `外部 Buyer Agent (${buyerAgentName}) 同时和 ${threads.length} 个卖家砍价`
    : `买家 Agent 同时和 ${threads.length} 个卖家 Agent 砍价（最多5轮）`;
  emitter.timelineStep({ id: "negotiate", status: "running", detail: negotiateDetail, ts: now() });

  const buyerChat = llmCfg.openAIApiKey ? toChat(llmCfg, 0.5) : null;
  const MAX_ROUNDS = 5;
  let dealAccepted = false;
  let acceptedThread: SellerThread | null = null;
  let acceptedPrice: number | null = null;

  // Helper: check if buyer should accept this quote (internal logic, used when no external agent)
  const shouldAcceptQuoteInternal = (listPrice: number, quote: number, round: number): boolean => {
    // MUST be within budget first!
    if (quote > budget) return false;

    const discountPercent = (listPrice - quote) / listPrice;
    // Accept if: discount >= 15%, or round >= 3 and discount >= 10%, or round >= 4 and discount >= 5%
    if (discountPercent >= 0.15) return true;
    if (round >= 3 && discountPercent >= 0.10) return true;
    if (round >= 4 && discountPercent >= 0.05) return true;
    // Also accept if within budget and seller won't go lower (round 5)
    if (round >= 5 && quote <= budget) return true;
    return false;
  };

  // Helper: get buyer's offer based on round (internal logic)
  const getBuyerOffer = (listPrice: number, round: number): number => {
    const offerFactors = [0.65, 0.72, 0.78, 0.82, 0.85];
    const factor = offerFactors[Math.min(round - 1, offerFactors.length - 1)];
    return round2(listPrice * factor);
  };

  // Helper: call external buyer agent or use internal logic
  const callBuyerAgent = async (
    thread: SellerThread,
    round: number,
    stage: "opening" | "bargain" | "counter",
    sellerMessage?: string
  ): Promise<{ message: string; decision?: { accept: boolean; acceptedPrice?: string; offerPriceUSDC?: string } }> => {
    const listPrice = parsePriceUSDC(thread.product.priceUSDC) ?? 80;
    const sellerName = thread.store.sellerAgentName || thread.store.sellerAgent?.name || "卖家客服 Agent";
    const storeName = thread.store.name || thread.store.id;

    // If external buyer agent is available, use it
    if (buyerAgentUrl && buyerAgentConfig) {
      const payload: BuyerAgentNegotiateRequest = {
        sessionId,
        round,
        stage,
        product: {
          id: thread.product.id,
          name: thread.product.name,
          listPriceUSDC: thread.product.priceUSDC,
          highlights: thread.product.highlights,
        },
        seller: {
          id: thread.store.sellerAgentId || thread.store.id,
          name: sellerName,
          storeName,
          style: thread.store.sellerStyle,
        },
        currentQuote: thread.lastQuoteUSDC
          ? { sellerPriceUSDC: priceString(thread.lastQuoteUSDC) }
          : undefined,
        sellerMessage,
        expectedAction: stage === "counter" ? "decide" : "reply",
      };

      const res = await callBuyerAgentNegotiate(buyerAgentUrl, payload, signal);
      if (res) {
        return { message: res.message, decision: res.decision };
      }
      // Fallback to internal if external agent fails
      console.warn(`[multiAgentFlow] External buyer agent failed, falling back to internal`);
    }

    // Internal logic
    const offer = getBuyerOffer(listPrice, round);
    const offerText = priceString(offer);
    const sellerAddr = thread.store.sellerAgent?.address ? `（${thread.store.sellerAgent.address.slice(0, 8)}…）` : "";

    if (stage === "counter" && thread.lastQuoteUSDC) {
      // Decide whether to accept
      const shouldAccept = shouldAcceptQuoteInternal(listPrice, thread.lastQuoteUSDC, round);
      if (shouldAccept) {
        const acceptedPrice = thread.lastQuoteUSDC;
        const acceptText = buyerChat
          ? await agentReply({
              chat: buyerChat,
              systemPrompt: buildBuyerSystemPrompt(goal, buyerNote, budget),
              transcript: thread.transcript,
              self: "buyer",
              instruction: `卖家报价 ${priceString(acceptedPrice)} USDC，你决定接受这个价格成交。请用1-2句话表达同意并确认购买，明确提到接受 ${priceString(acceptedPrice)} USDC 的价格。`,
            })
          : `好，${priceString(acceptedPrice)} USDC 成交！请帮我安排发货。`;
        return { message: acceptText, decision: { accept: true, acceptedPrice: priceString(acceptedPrice) } };
      }
    }

    // Generate bargaining message
    const buyerSystem = buildBuyerSystemPrompt(goal, buyerNote, budget);
    const buyerInstruction =
      stage === "opening"
        ? [
            `你正在联系卖家：${sellerName}${sellerAddr}（店铺：${storeName}）`,
            `商品：${thread.product.name}，标价 ${thread.product.priceUSDC} USDC。`,
            "请发起对话并表达你会砍价，询问是否能给优惠。保持 1-2 句。",
          ].join("\n")
        : [
            `继续和卖家：${sellerName}${sellerAddr}（店铺：${storeName}）砍价。`,
            `商品：${thread.product.name}，标价 ${thread.product.priceUSDC} USDC。`,
            `卖家上轮报价是 ${thread.lastQuoteUSDC ? priceString(thread.lastQuoteUSDC) : "未知"} USDC。`,
            `你这轮的出价是 ${offerText} USDC（必须在消息里出现这个数字）。`,
            "语气要有点拉扯感，但保持理性。1-2 句。",
          ].join("\n");

    const message = buyerChat
      ? await agentReply({ chat: buyerChat, systemPrompt: buyerSystem, transcript: thread.transcript, self: "buyer", instruction: buyerInstruction })
      : fallbackBuyerMessage(goal, stage === "opening" ? undefined : offerText);

    return { message, decision: { accept: false, offerPriceUSDC: offerText } };
  };

  negotiationLoop: for (let round = 1; round <= MAX_ROUNDS; round++) {
    for (const thread of threads) {
      if (signal.aborted) return;
      if (dealAccepted) break negotiationLoop;

      const storeName = thread.store.name || thread.store.id;
      const sellerName = thread.store.sellerAgentName || thread.store.sellerAgent?.name || "卖家客服 Agent";
      const sellerAddr = thread.store.sellerAgent?.address ? `（${thread.store.sellerAgent.address.slice(0, 8)}…）` : "";
      const listPrice = parsePriceUSDC(thread.product.priceUSDC) ?? 80;

      // Determine stage
      const stage = round === 1 ? "opening" : "counter";

      // Get the last seller message for context
      const lastSellerMsg = thread.transcript.filter(t => t.speaker === "seller").pop()?.content;

      // Call buyer agent (external or internal)
      const buyerResponse = await callBuyerAgent(thread, round, stage, lastSellerMsg);

      // Check if buyer decided to accept
      if (buyerResponse.decision?.accept && thread.lastQuoteUSDC) {
        dealAccepted = true;
        acceptedThread = thread;
        // Use acceptedPrice from decision if available, otherwise fall back to seller's last quote
        const agreedPrice = buyerResponse.decision.acceptedPrice
          ? parsePriceUSDC(buyerResponse.decision.acceptedPrice) ?? thread.lastQuoteUSDC
          : thread.lastQuoteUSDC;
        acceptedPrice = agreedPrice;

        // Emit buyer acceptance message (price will be confirmed by prepare_deal later)
        thread.transcript.push({ speaker: "buyer", content: buyerResponse.message });
        emitter.message({
          id: randomUUID(),
          role: "buyer",
          stage: "negotiate",
          speaker: buyerAgentName,
          content: buyerResponse.message,
          ts: now(),
          sellerId: thread.store.sellerAgentId || thread.store.id,
          storeId: thread.store.id,
          storeName: thread.store.name || thread.store.id,
          productId: thread.product.id,
          productName: thread.product.name,
          priceUSDC: priceString(agreedPrice),
        });

        // Note: Seller confirmation will be emitted AFTER prepare_deal confirms the final price
        break negotiationLoop;
      }

      // Buyer is bargaining, emit the message
      thread.transcript.push({ speaker: "buyer", content: buyerResponse.message });
      emitter.message({
        id: randomUUID(),
        role: "buyer",
        stage: "negotiate",
        speaker: buyerAgentName,
        content: buyerResponse.message,
        ts: now(),
        sellerId: thread.store.sellerAgentId || thread.store.id,
        storeId: thread.store.id,
        storeName: thread.store.name || thread.store.id,
        productId: thread.product.id,
        productName: thread.product.name,
        priceUSDC: thread.product.priceUSDC,
      });

      // Now get seller's response
      const style = thread.store.sellerStyle || "pro";
      const floor = round2(listPrice * sellerFloorFactor(style));
      const discountFactor = style === "strict" ? 0.02 : style === "pro" ? 0.03 : 0.04;
      const target = round2(Math.max(floor, listPrice * (1 - discountFactor * round)));

      const sellerPayload = {
        sessionId,
        round,
        buyerMessage: buyerResponse.message,
        store: { id: thread.store.id, name: thread.store.name },
        product: {
          id: thread.product.id,
          name: thread.product.name,
          priceUSDC: thread.product.priceUSDC,
          highlights: thread.product.highlights ?? [],
          inventory: thread.product.inventory,
        },
        // 传递商品的 sellerConfig 配置给 seller-agent 服务
        sellerConfig: thread.product.sellerConfig,
      };
      console.log(`[multiAgentFlow] Calling seller: upstream=${thread.sellerUpstream || 'NONE'}, sellerConfig=${JSON.stringify(thread.product.sellerConfig)}`);
      const sellerRes = thread.sellerUpstream ? await callSellerAgent(thread.sellerUpstream, sellerPayload, signal) : null;
      console.log(`[multiAgentFlow] Seller response: ${sellerRes ? JSON.stringify(sellerRes).slice(0, 200) : 'NULL (using fallback)'}`);
      const sellerText = sellerRes?.reply ?? fallbackSellerMessage(thread.store, thread.product, priceString(target));
      const sellerSpeakerName = sellerRes?.sellerName ?? sellerName;

      thread.transcript.push({ speaker: "seller", content: sellerText });
      const quoted = parsePriceUSDC(sellerRes?.quotePriceUSDC) ?? extractQuotedUSDC(sellerText) ?? target;
      thread.lastQuoteUSDC = round2(Math.max(quoted, floor));

      emitter.message({
        id: randomUUID(),
        role: "seller",
        stage: "negotiate",
        speaker: `${sellerSpeakerName}${sellerAddr}`,
        content: sellerText,
        ts: now(),
        sellerId: thread.store.sellerAgentId || thread.store.id,
        storeId: thread.store.id,
        storeName: thread.store.name || thread.store.id,
        productId: thread.product.id,
        productName: thread.product.name,
        priceUSDC: priceString(thread.lastQuoteUSDC),
      });
    }
  }

  // Determine winner
  let winner: SellerThread | null = null;
  let winnerPrice: number = 0;
  let forcedLowestPrice = false;
  let allOverBudget = false;

  if (dealAccepted && acceptedThread && acceptedPrice !== null) {
    winner = acceptedThread;
    winnerPrice = acceptedPrice;
  } else {
    // No deal explicitly accepted - check if any quote is within budget
    const sorted = [...threads].sort((a, b) => (a.lastQuoteUSDC ?? 999999) - (b.lastQuoteUSDC ?? 999999));
    const lowestThread = sorted[0];
    const lowestPrice = lowestThread.lastQuoteUSDC ?? (parsePriceUSDC(lowestThread.product.priceUSDC) ?? 80);

    if (lowestPrice <= budget) {
      // Lowest quote is within budget - accept it reluctantly
      forcedLowestPrice = true;
      winner = lowestThread;
      winnerPrice = lowestPrice;
    } else {
      // ALL quotes are over budget - no deal possible
      allOverBudget = true;
    }
  }

  // 调用 Seller Agent 的 prepare_deal 获取最终确认价格（从聊天记录分析）
  if (winner && winner.sellerUpstream) {
    const prepareDealResult = await callSellerPrepareDeal(
      winner.sellerUpstream,
      {
        sessionId,
        transcript: winner.transcript,
        product: {
          id: winner.product.id,
          name: winner.product.name,
          listPriceUSDC: winner.product.priceUSDC,
        },
        store: {
          id: winner.store.id,
          name: winner.store.name || winner.store.id,
        },
        // 传递商品的 sellerConfig 配置
        sellerConfig: winner.product.sellerConfig,
      },
      signal
    );

    if (prepareDealResult?.ok && prepareDealResult.dealReady && prepareDealResult.deal) {
      const confirmedPrice = parsePriceUSDC(prepareDealResult.deal.finalPriceUSDC);
      if (confirmedPrice !== null) {
        console.log(`[multiAgentFlow] prepare_deal 确认价格: ${confirmedPrice} (原 winnerPrice: ${winnerPrice})`);
        winnerPrice = confirmedPrice;
      }
    }
  }

  // Handle the case where all quotes are over budget
  if (allOverBudget) {
    emitter.message({
      id: randomUUID(),
      role: "system",
      stage: "negotiate",
      speaker: "系统",
      content: `砍价结束。所有卖家报价均超出预算（${priceString(budget)} USDC），无法达成交易。`,
      ts: now(),
    });

    // Emit cancelled deal_proposal for each seller so frontend can show "交易取消"
    for (const thread of threads) {
      const lastPrice = thread.lastQuoteUSDC ?? (parsePriceUSDC(thread.product.priceUSDC) ?? 0);
      emitter.dealProposal({
        id: `${thread.store.id}-${thread.product.id}`,
        storeId: thread.store.id,
        storeName: thread.store.name || thread.store.id,
        productId: thread.product.id,
        productName: thread.product.name,
        priceUSDC: priceString(lastPrice),
        status: "cancelled",
        reason: "over_budget",
      });
    }

    emitter.timelineStep({
      id: "negotiate",
      status: "done",
      detail: `未成交：所有报价超出预算（${priceString(budget)} USDC）`,
      ts: now(),
    });

    // No deals generated when all quotes are over budget
    emitter.state({ running: false });
    emitter.done({ ok: false, reason: "over_budget" });
    return;
  }

  // At this point, winner is guaranteed to be non-null
  if (!winner) {
    throw new Error("Unexpected: no winner selected");
  }

  const winnerSellerName = winner.store.sellerAgentName || winner.store.sellerAgent?.name || "卖家客服 Agent";
  const winnerSellerAddr = winner.store.sellerAgent?.address ? `（${winner.store.sellerAgent.address.slice(0, 8)}…）` : "";

  if (forcedLowestPrice) {
    // Emit system message explaining the situation
    emitter.message({
      id: randomUUID(),
      role: "system",
      stage: "negotiate",
      speaker: "系统",
      content: `砍价已达${MAX_ROUNDS}轮上限，双方未能达成一致。系统自动选择最低报价：${winner.store.name} 的 ${priceString(winnerPrice)} USDC。`,
      ts: now(),
      storeId: winner.store.id,
      storeName: winner.store.name || winner.store.id,
      productId: winner.product.id,
      productName: winner.product.name,
      priceUSDC: priceString(winnerPrice),
    });

    // Buyer reluctantly accepts
    const reluctantAccept = buyerChat
      ? await agentReply({
          chat: buyerChat,
          systemPrompt: buildBuyerSystemPrompt(goal, buyerNote, budget),
          transcript: winner.transcript,
          self: "buyer",
          instruction: `砍价${MAX_ROUNDS}轮后，卖家最低报价是 ${priceString(winnerPrice)} USDC。你虽然觉得还是有点贵，但决定接受。用1-2句话勉强同意成交。`,
        })
      : `算了，${priceString(winnerPrice)} USDC 就这样吧，成交。`;

    emitter.message({
      id: randomUUID(),
      role: "buyer",
      stage: "negotiate",
      speaker: "买家 Agent",
      content: reluctantAccept,
      ts: now(),
      sellerId: winner.store.sellerAgentId || winner.store.id,
      storeId: winner.store.id,
      storeName: winner.store.name || winner.store.id,
      productId: winner.product.id,
      productName: winner.product.name,
      priceUSDC: priceString(winnerPrice),
    });

    // Seller confirms - 调用 seller-agent 生成成交确认消息
    let closingText1 = `好的，${priceString(winnerPrice)} USDC 成交！感谢您的耐心，马上为您安排。\n报价: ${priceString(winnerPrice)} USDC`;
    if (winner.sellerUpstream) {
      const customClosing = await callSellerClosingMessage(
        winner.sellerUpstream,
        {
          sessionId,
          finalPrice: winnerPrice,
          store: { id: winner.store.id, name: winner.store.name },
          product: { id: winner.product.id, name: winner.product.name, priceUSDC: winner.product.priceUSDC },
          sellerConfig: winner.product.sellerConfig,
        },
        signal
      );
      if (customClosing) closingText1 = customClosing;
    }
    emitter.message({
      id: randomUUID(),
      role: "seller",
      stage: "negotiate",
      speaker: `${winnerSellerName}${winnerSellerAddr}`,
      content: closingText1,
      ts: now(),
      sellerId: winner.store.sellerAgentId || winner.store.id,
      storeId: winner.store.id,
      storeName: winner.store.name || winner.store.id,
      productId: winner.product.id,
      productName: winner.product.name,
      priceUSDC: priceString(winnerPrice),
    });
  } else if (dealAccepted) {
    // Buyer explicitly accepted - 调用 seller-agent 生成成交确认消息
    console.log(`[multiAgentFlow] dealAccepted branch: winner.sellerUpstream=${winner.sellerUpstream || 'NONE'}`);
    let confirmText = `太好了，感谢您的信任！${priceString(winnerPrice)} USDC 成交确认，马上为您处理订单。\n报价: ${priceString(winnerPrice)} USDC`;
    if (winner.sellerUpstream) {
      console.log(`[multiAgentFlow] Calling closing message with sellerConfig=${JSON.stringify(winner.product.sellerConfig)}`);
      const customClosing = await callSellerClosingMessage(
        winner.sellerUpstream,
        {
          sessionId,
          finalPrice: winnerPrice,
          store: { id: winner.store.id, name: winner.store.name },
          product: { id: winner.product.id, name: winner.product.name, priceUSDC: winner.product.priceUSDC },
          sellerConfig: winner.product.sellerConfig,
        },
        signal
      );
      console.log(`[multiAgentFlow] Closing message result: ${customClosing ? customClosing.slice(0, 100) : 'NULL'}`);
      if (customClosing) confirmText = customClosing;
    }
    winner.transcript.push({ speaker: "seller", content: confirmText });
    emitter.message({
      id: randomUUID(),
      role: "seller",
      stage: "negotiate",
      speaker: `${winnerSellerName}${winnerSellerAddr}`,
      content: confirmText,
      ts: now(),
      sellerId: winner.store.sellerAgentId || winner.store.id,
      storeId: winner.store.id,
      storeName: winner.store.name || winner.store.id,
      productId: winner.product.id,
      productName: winner.product.name,
      priceUSDC: priceString(winnerPrice),
    });
  }

  emitter.timelineStep({
    id: "negotiate",
    status: "done",
    detail: dealAccepted
      ? `达成交易：${winner.store.name}，${priceString(winnerPrice)} USDC`
      : `${MAX_ROUNDS}轮后选择最低价：${winner.store.name}，${priceString(winnerPrice)} USDC`,
    ts: now(),
  });

  // Emit deal_proposal only for the winner (successful deal)
  emitter.dealProposal({
    id: `${winner.store.id}-${winner.product.id}`,
    storeId: winner.store.id,
    storeName: winner.store.name || winner.store.id,
    productId: winner.product.id,
    productName: winner.product.name,
    priceUSDC: priceString(winnerPrice),
    status: "pending",
  });

  // Emit cancelled status for all non-winning threads (including over-budget ones)
  for (const thread of threads) {
    if (thread === winner) continue; // Skip the winner
    const lastPrice = thread.lastQuoteUSDC ?? (parsePriceUSDC(thread.product.priceUSDC) ?? 0);
    const isOverBudget = lastPrice > budget;
    emitter.dealProposal({
      id: `${thread.store.id}-${thread.product.id}`,
      storeId: thread.store.id,
      storeName: thread.store.name || thread.store.id,
      productId: thread.product.id,
      productName: thread.product.name,
      priceUSDC: priceString(lastPrice),
      status: "cancelled",
      reason: isOverBudget ? "over_budget" : "not_selected",
    });
  }

  emitter.state({ selectedStoreId: winner.store.id, selectedProductId: winner.product.id });

  emitter.message({
    id: randomUUID(),
    role: "buyer",
    stage: "prepare",
    speaker: "买家 Agent",
    content: `确认：选择「${winner.store.name}」，以 ${priceString(winnerPrice)} USDC 成交。准备进入跨链结算流程。`,
    ts: now(),
  });
  emitter.message({
    id: randomUUID(),
    role: "seller",
    stage: "prepare",
    speaker: winnerSellerName,
    content: `收到，订单确认！${priceString(winnerPrice)} USDC，马上生成跨链结算订单。\n报价: ${priceString(winnerPrice)} USDC`,
    ts: now(),
  });

  emitter.timelineStep({ id: "prepare", status: "running", detail: "生成 Deal", ts: now() });

  const buyerAddress = (configJson as any)?.accounts?.buyer;
  const sellerBase = (configJson as any)?.accounts?.seller;
  const polygonEscrow = (configJson as any)?.contracts?.polygonEscrow;
  const nft = (configJson as any)?.contracts?.polygonNFT;
  if (!buyerAddress || !sellerBase || !polygonEscrow || !nft) {
    throw new Error("Missing accounts/contracts in /api/config (need BUYER/SELLER_PRIVATE_KEY and contract addresses)");
  }

  const prepareRes = (await emitTool(
    "prepare_deal",
    {
      buyer: buyerAddress,
      sellerBase,
      polygonEscrow,
      nft,
      tokenId: winner.product.tokenId,
      priceUSDC: priceString(winnerPrice),
      deadlineSecondsFromNow: 3600,
    },
    () =>
      market.invokeTool("prepare_deal", {
        buyer: buyerAddress,
        sellerBase,
        polygonEscrow,
        nft,
        tokenId: winner.product.tokenId,
        priceUSDC: priceString(winnerPrice),
        deadlineSecondsFromNow: 3600,
      })
  )) as any;

  const preparedDeal = prepareRes?.deal ?? null;
  if (preparedDeal) emitter.state({ deal: preparedDeal });

  emitter.timelineStep({ id: "prepare", status: "done", detail: "Deal 已生成", ts: now() });
  emitter.state({ running: false });

  if (checkoutMode === "confirm") {
    const confirmDetail = forcedLowestPrice
      ? `等待确认（${MAX_ROUNDS}轮砍价后的最低价 ${priceString(winnerPrice)} USDC）`
      : `等待确认（${priceString(winnerPrice)} USDC）`;
    emitter.timelineStep({ id: "confirm", status: "running", detail: confirmDetail, ts: now() });

    // Show hint message for manual confirmation
    if (forcedLowestPrice) {
      emitter.message({
        id: randomUUID(),
        role: "system",
        stage: "prepare",
        speaker: "系统提示",
        content: `这是${MAX_ROUNDS}轮砍价后卖家的最低报价（${priceString(winnerPrice)} USDC）。点击「发起结算」继续，或点击「重置」重新开始。`,
        ts: now(),
      });
    }

    emitter.state({ awaitingConfirm: true });
    await waitForConfirm(sessionId, signal);
    if (signal.aborted) return;
    emitter.state({ awaitingConfirm: false });
    emitter.timelineStep({ id: "confirm", status: "done", detail: "用户已确认", ts: now() });
  } else {
    emitter.timelineStep({ id: "confirm", status: "done", detail: "全自动", ts: now() });
  }

  emitter.state({ settling: true });
  emitter.timelineStep({ id: "settle", status: "running", detail: "开始跨链结算", ts: now() });

  const settleRes = (await emitTool("settle_deal", { mode, deal: preparedDeal }, () =>
    market.invokeTool("settle_deal", { mode, deal: preparedDeal })
  )) as any;
  const settlementStreamUrl = settleRes?.streamUrl ?? null;
  if (!settlementStreamUrl) throw new Error("Missing settlement streamUrl");

  const settleStream = await market.fetchSettlementStream(settlementStreamUrl, signal);
  if (!settleStream.ok || !settleStream.body) throw new Error(`Settlement stream error: HTTP ${settleStream.status}`);

  await readSseStream(
    settleStream.body,
    (evt, raw) => {
      if (signal.aborted) return;
      if (evt === "step") {
        try {
          const step = JSON.parse(raw);
          emitter.timelineStep({ ...step, ts: now() });
        } catch {
          // ignore
        }
      } else if (evt === "log") {
        emitter.message({
          id: randomUUID(),
          role: "system",
          stage: "settle",
          speaker: "结算",
          content: raw,
          ts: now(),
        });
      } else if (evt === "error") {
        emitter.error(raw);
      }
    },
    signal
  );

  emitter.timelineStep({ id: "settle", status: "done", detail: `耗时 ${Date.now() - startedAt}ms`, ts: now() });

  // Emit settlement complete to update UI status from "待结算" to "已成交"
  emitter.settlementComplete({
    storeId: winner.store.id,
    productId: winner.product.id,
    dealId: `${winner.store.id}-${winner.product.id}`,
  });

  emitter.state({ settling: false });
  emitter.done({ ok: true });
}
