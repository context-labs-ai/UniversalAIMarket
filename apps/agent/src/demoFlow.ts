import { randomUUID } from "crypto";
import {
  BUYER_ACCEPT_SYSTEM_PROMPT,
  BUYER_BARGAIN_SYSTEM_PROMPT,
  BUYER_FINAL_OFFER_SYSTEM_PROMPT,
  BUYER_SYSTEM_PROMPT,
  SELLER_CLOSE_SYSTEM_PROMPT,
  SELLER_COUNTER_SYSTEM_PROMPT,
  SELLER_SYSTEM_PROMPT,
  generateBuyerAcceptance,
  generateBuyerBargain,
  generateBuyerFinalOffer,
  generateBuyerOpening,
  generateSellerClose,
  generateSellerCounter,
  generateSellerReply,
} from "./dualChat.js";
import { waitForConfirm } from "./sessionStore.js";
import type { MarketClient } from "./marketClient.js";
import type { CheckoutMode, DemoMode, FlowEmitter } from "./flowEmitter.js";

type LlmConfig = {
  model: string;
  openAIApiKey?: string;
  openAIBaseUrl?: string;
};

function stageForTool(name: string) {
  if (name === "search_stores" || name === "search_products") return "browse";
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

function roundHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function toPriceString(value: number) {
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, "");
}

async function readSseStream(body: ReadableStream<Uint8Array>, onEvent: (evt: string, data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
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

export async function runDemoFlow({
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
  // Log prompts on backend for easier iteration during hackathon demos.
  // (Avoid logging secrets; these prompts are static.)
  // eslint-disable-next-line no-console
  console.log("[agent:prompt] buyer_system:", BUYER_SYSTEM_PROMPT);
  // eslint-disable-next-line no-console
  console.log("[agent:prompt] seller_system:", SELLER_SYSTEM_PROMPT);
  // eslint-disable-next-line no-console
  console.log("[agent:prompt] buyer_bargain_system:", BUYER_BARGAIN_SYSTEM_PROMPT);
  // eslint-disable-next-line no-console
  console.log("[agent:prompt] seller_counter_system:", SELLER_COUNTER_SYSTEM_PROMPT);
  // eslint-disable-next-line no-console
  console.log("[agent:prompt] buyer_final_offer_system:", BUYER_FINAL_OFFER_SYSTEM_PROMPT);
  // eslint-disable-next-line no-console
  console.log("[agent:prompt] seller_close_system:", SELLER_CLOSE_SYSTEM_PROMPT);
  // eslint-disable-next-line no-console
  console.log("[agent:prompt] buyer_accept_system:", BUYER_ACCEPT_SYSTEM_PROMPT);

  emitter.state({ running: true, settling: false, awaitingConfirm: false });
  emitter.timelineStep({ id: "browse", status: "running", detail: "buyer agent browsing stores", ts: now() });

  const buyerOpening = await generateBuyerOpening(llmCfg, goal, buyerNote);
  emitter.message({
    id: randomUUID(),
    role: "buyer",
    stage: "browse",
    speaker: "buyer agent",
    content: buyerOpening,
    ts: now(),
  });

  const emitTool = async <T,>(name: string, args: unknown, runner: () => Promise<T>) => {
    const id = randomUUID();
    emitter.toolCall({ id, stage: stageForTool(name), name, args, ts: now() });
    try {
      const result = await runner();
      emitter.toolResult({ id, result, ts: now() });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool failed";
      emitter.toolResult({ id, result: { ok: false, error: message }, ts: now() });
      throw err;
    }
  };

  const storesRes = (await emitTool("search_stores", { query: goal, limit: 5 }, () =>
    market.invokeTool("search_stores", { query: goal, limit: 5 })
  )) as any;
  const store = Array.isArray(storesRes?.stores) ? storesRes.stores[0] : null;
  if (!store?.id) throw new Error("No store found");

  const productsRes = (await emitTool("search_products", { storeId: store.id, query: goal, limit: 10 }, () =>
    market.invokeTool("search_products", { storeId: store.id, query: goal, limit: 10 })
  )) as any;
  const products: any[] = Array.isArray(productsRes?.products) ? productsRes.products : [];
  if (products.length === 0) throw new Error("No product found");

  const underBudget = products
    .map((p) => ({ p, price: parsePriceUSDC(p?.priceUSDC) }))
    .filter((x) => x.price !== null && x.price <= 100)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const product = (underBudget[0]?.p ?? products[0]) as any;

  emitter.state({ selectedStoreId: store.id, selectedProductId: product.id });
  emitter.timelineStep({ id: "browse", status: "done", detail: "store/product selected", ts: now() });

  emitter.timelineStep({ id: "negotiate", status: "running", detail: "negotiating", ts: now() });

  const sellerMsg = await generateSellerReply(llmCfg, {
    storeName: store.name ?? "seller store",
    productName: product.name ?? "product",
    priceUSDC: String(product.priceUSDC ?? ""),
    highlights: Array.isArray(product.highlights) ? product.highlights : [],
    inventoryHint: product.inventory ?? undefined,
  });
  emitter.message({
    id: randomUUID(),
    role: "seller",
    stage: "negotiate",
    speaker: store.sellerAgentName ?? "seller agent",
    content: sellerMsg,
    ts: now(),
  });

  const listPriceNum = parsePriceUSDC(product.priceUSDC) ?? 80;
  const offerPrice = roundHalf(Math.max(1, listPriceNum * 0.6));
  const counterPrice = roundHalf(Math.max(offerPrice, listPriceNum * 0.9));
  const finalPrice = roundHalf(Math.min(listPriceNum, offerPrice + (counterPrice - offerPrice) * 0.75));

  const listPriceUSDC = toPriceString(listPriceNum);
  const offerPriceUSDC = toPriceString(offerPrice);
  const counterPriceUSDC = toPriceString(counterPrice);
  const finalPriceUSDC = toPriceString(finalPrice);

  const buyerBargain = await generateBuyerBargain(llmCfg, {
    productName: product.name ?? "product",
    listPriceUSDC,
    offerPriceUSDC,
  });
  emitter.message({
    id: randomUUID(),
    role: "buyer",
    stage: "negotiate",
    speaker: "buyer agent",
    content: buyerBargain,
    ts: now(),
  });

  const sellerCounter = await generateSellerCounter(llmCfg, {
    storeName: store.name ?? "seller store",
    productName: product.name ?? "product",
    listPriceUSDC,
    counterPriceUSDC,
  });
  emitter.message({
    id: randomUUID(),
    role: "seller",
    stage: "negotiate",
    speaker: store.sellerAgentName ?? "seller agent",
    content: sellerCounter,
    ts: now(),
  });

  const buyerFinalOffer = await generateBuyerFinalOffer(llmCfg, {
    productName: product.name ?? "product",
    finalPriceUSDC,
  });
  emitter.message({
    id: randomUUID(),
    role: "buyer",
    stage: "negotiate",
    speaker: "buyer agent",
    content: buyerFinalOffer,
    ts: now(),
  });

  const sellerClose = await generateSellerClose(llmCfg, {
    storeName: store.name ?? "seller store",
    productName: product.name ?? "product",
    finalPriceUSDC,
  });
  emitter.message({
    id: randomUUID(),
    role: "seller",
    stage: "negotiate",
    speaker: store.sellerAgentName ?? "seller agent",
    content: sellerClose,
    ts: now(),
  });

  const buyerAccept = await generateBuyerAcceptance(llmCfg, {
    productName: product.name ?? "product",
    finalPriceUSDC,
  });
  emitter.message({
    id: randomUUID(),
    role: "buyer",
    stage: "negotiate",
    speaker: "buyer agent",
    content: buyerAccept,
    ts: now(),
  });

  emitter.timelineStep({ id: "negotiate", status: "done", detail: `deal at ${finalPriceUSDC} USDC`, ts: now() });
  emitter.timelineStep({ id: "prepare", status: "running", detail: "prepare deal", ts: now() });

  const buyerAddress = (configJson as any)?.accounts?.buyer;
  const sellerBase = (configJson as any)?.accounts?.seller;
  const polygonEscrow = (configJson as any)?.contracts?.polygonEscrow;
  const nft = (configJson as any)?.contracts?.polygonNFT;
  if (!buyerAddress || !sellerBase || !polygonEscrow || !nft) {
    throw new Error("Missing accounts/contracts in /api/config");
  }

  const prepareRes = (await emitTool(
    "prepare_deal",
    {
      buyer: buyerAddress,
      sellerBase,
      polygonEscrow,
      nft,
      tokenId: product.tokenId,
      priceUSDC: finalPriceUSDC,
      deadlineSecondsFromNow: 3600,
    },
    () =>
      market.invokeTool("prepare_deal", {
        buyer: buyerAddress,
        sellerBase,
        polygonEscrow,
        nft,
        tokenId: product.tokenId,
        priceUSDC: finalPriceUSDC,
        deadlineSecondsFromNow: 3600,
      })
  )) as any;

  const preparedDeal = prepareRes?.deal ?? null;
  if (preparedDeal) emitter.state({ deal: preparedDeal });

  emitter.timelineStep({ id: "prepare", status: "done", detail: "deal created", ts: now() });
  emitter.state({ running: false });

  if (checkoutMode === "confirm") {
    emitter.timelineStep({ id: "confirm", status: "running", detail: "awaiting confirm", ts: now() });
    emitter.state({ awaitingConfirm: true });
    emitter.message({
      id: randomUUID(),
      role: "buyer",
      stage: "prepare",
      speaker: "buyer agent",
      content: "Deal is ready. Please confirm to continue settlement.",
      ts: now(),
    });
    await waitForConfirm(sessionId, signal);
    emitter.state({ awaitingConfirm: false });
  } else {
    emitter.timelineStep({ id: "confirm", status: "done", detail: "auto checkout", ts: now() });
  }

  emitter.state({ settling: true });
  emitter.timelineStep({ id: "settle", status: "running", detail: "cross-chain settlement", ts: now() });

  const settleRes = (await emitTool("settle_deal", { mode, deal: preparedDeal }, () =>
    market.invokeTool("settle_deal", { mode, deal: preparedDeal })
  )) as any;
  const settlementStreamUrl = settleRes?.streamUrl ?? null;
  if (!settlementStreamUrl) throw new Error("Missing settlement streamUrl");

  const settleStream = await market.fetchSettlementStream(settlementStreamUrl, signal);
  if (!settleStream.ok || !settleStream.body) throw new Error(`Settlement stream error: HTTP ${settleStream.status}`);

  await readSseStream(settleStream.body, (evt, raw) => {
    if (signal.aborted) return;
    if (evt === "step") {
      try {
        const step = JSON.parse(raw) as { id?: string; status?: string; detail?: string; txHash?: string };
        if (!step.id || !step.status) return;
        emitter.timelineStep({
          id: String(step.id),
          status: step.status === "running" ? "running" : step.status === "error" ? "error" : "done",
          detail: typeof step.detail === "string" ? step.detail : undefined,
          txHash: typeof step.txHash === "string" ? step.txHash : undefined,
          ts: now(),
        });
      } catch {
        // ignore
      }
    }
    if (evt === "log") {
      emitter.message({
        id: randomUUID(),
        role: "system",
        stage: "settle",
        speaker: "settlement",
        content: raw,
        ts: now(),
      });
    }
  });

  emitter.timelineStep({ id: "settle", status: "done", detail: `elapsed ${Date.now() - startedAt}ms`, ts: now() });
  emitter.state({ settling: false });
  emitter.done({ ok: true, ts: now() });
}

