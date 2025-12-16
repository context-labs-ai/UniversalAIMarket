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
  return unique;
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

function buildBuyerSystemPrompt(goal: string, buyerNote: string) {
  return [
    "你是买家 Agent，要在电商市场中完成一次购买。",
    "你会同时联系多个卖家客服 Agent 获取报价并砍价，然后选择更划算的一家下单。",
    "要求：中文、简洁、自然对话；可以强势但禁止辱骂/脏话/人身攻击。",
    "每次给卖家发消息 1-2 句，必要时包含明确的价格数字（USDC）。",
    "",
    `目标：${goal}`,
    buyerNote.trim() ? `补充：${buyerNote.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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

export async function runMultiAgentFlow({
  market,
  llmCfg,
  configJson,
  mode,
  checkoutMode,
  goal,
  buyerNote,
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
  emitter: FlowEmitter;
  sessionId: string;
  startedAt: number;
  signal: AbortSignal;
  now: () => number;
}) {
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
    const sellerUpstream = sellerUpstreams[threads.length] ?? undefined;
    threads.push({ store, product, transcript: [], sellerUpstream });
  }

  if (threads.length === 0) throw new Error("No product found in picked stores");

  emitter.timelineStep({ id: "browse", status: "done", detail: `找到 ${threads.length} 个卖家候选`, ts: now() });
  emitter.timelineStep({ id: "negotiate", status: "running", detail: "买家 Agent 同时和两个卖家 Agent 砍价", ts: now() });

  const buyerChat = llmCfg.openAIApiKey ? toChat(llmCfg, 0.5) : null;

  for (let round = 1; round <= 2; round++) {
    for (const thread of threads) {
      if (signal.aborted) return;

      const storeName = thread.store.name || thread.store.id;
      const sellerName = thread.store.sellerAgentName || thread.store.sellerAgent?.name || "卖家客服 Agent";
      const sellerAddr = thread.store.sellerAgent?.address ? `（${thread.store.sellerAgent.address.slice(0, 8)}…）` : "";

      const listPrice = parsePriceUSDC(thread.product.priceUSDC) ?? 80;
      const offer = round === 1 ? listPrice * 0.65 : listPrice * 0.78;
      const offerText = priceString(offer);

      const buyerSystem = buildBuyerSystemPrompt(goal, buyerNote);
      const buyerInstruction =
        round === 1
          ? [
              `你正在联系卖家：${sellerName}${sellerAddr}（店铺：${storeName}）`,
              `商品：${thread.product.name}，标价 ${thread.product.priceUSDC} USDC。`,
              "请发起对话并表达你会砍价，询问是否能给优惠。保持 1-2 句。",
            ].join("\n")
          : [
              `继续和卖家：${sellerName}${sellerAddr}（店铺：${storeName}）砍价。`,
              `你的出价是 ${offerText} USDC（必须在消息里出现这个数字）。`,
              "语气要有点拉扯感，但保持理性。1-2 句。",
            ].join("\n");

      const buyerText = buyerChat
        ? await agentReply({ chat: buyerChat, systemPrompt: buyerSystem, transcript: thread.transcript, self: "buyer", instruction: buyerInstruction })
        : fallbackBuyerMessage(goal, round === 1 ? undefined : offerText);

      thread.transcript.push({ speaker: "buyer", content: buyerText });
      emitter.message({
        id: randomUUID(),
        role: "buyer",
        stage: "negotiate",
        speaker: "买家 Agent",
        content: buyerText,
        ts: now(),
      });

      const style = thread.store.sellerStyle || "pro";
      const floor = round2(listPrice * sellerFloorFactor(style));
      const target = round === 1 ? round2(listPrice * (style === "strict" ? 0.98 : style === "pro" ? 0.94 : 0.9)) : floor;
      const sellerPayload = {
        sessionId,
        round,
        buyerMessage: buyerText,
        store: { id: thread.store.id, name: thread.store.name },
        product: {
          id: thread.product.id,
          name: thread.product.name,
          priceUSDC: thread.product.priceUSDC,
          highlights: thread.product.highlights ?? [],
          inventory: thread.product.inventory,
        },
      };
      const sellerRes = thread.sellerUpstream ? await callSellerAgent(thread.sellerUpstream, sellerPayload, signal) : null;
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
      });
    }
  }

  const sorted = [...threads].sort((a, b) => (a.lastQuoteUSDC ?? 999999) - (b.lastQuoteUSDC ?? 999999));
  const winner = sorted[0];
  const winnerPrice = winner.lastQuoteUSDC ?? (parsePriceUSDC(winner.product.priceUSDC) ?? 80);
  const winnerSellerName = winner.store.sellerAgentName || winner.store.sellerAgent?.name || "卖家客服 Agent";

  emitter.timelineStep({
    id: "negotiate",
    status: "done",
    detail: `比价完成：选择 ${winner.store.name}，报价 ${priceString(winnerPrice)} USDC`,
    ts: now(),
  });

  emitter.state({ selectedStoreId: winner.store.id, selectedProductId: winner.product.id });

  emitter.message({
    id: randomUUID(),
    role: "buyer",
    stage: "prepare",
    speaker: "买家 Agent",
    content: `我决定选择「${winner.store.name}」成交，按 ${priceString(winnerPrice)} USDC 下单。请确认并准备进入结算。`,
    ts: now(),
  });
  emitter.message({
    id: randomUUID(),
    role: "seller",
    stage: "prepare",
    speaker: winnerSellerName,
    content: `收到，确认成交。马上生成订单并进入跨链结算流程。报价: ${priceString(winnerPrice)} USDC`,
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
    emitter.timelineStep({ id: "confirm", status: "running", detail: "等待确认", ts: now() });
    emitter.state({ awaitingConfirm: true });
    await waitForConfirm(sessionId, signal);
    if (signal.aborted) return;
    emitter.state({ awaitingConfirm: false });
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
  emitter.state({ settling: false });
  emitter.done({ ok: true });
}
