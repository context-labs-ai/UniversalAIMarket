import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { initSse, sendSse, sendSseComment } from "./sse.js";
import { invokeToolBridge } from "./tools.js";
import { confirm, waitForConfirm } from "./sessionStore.js";
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

type DemoMode = "testnet" | "simulate";
type CheckoutMode = "auto" | "confirm";

function isPresent(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stageForTool(name: string) {
  if (name === "search_stores" || name === "search_products") return "browse";
  if (name === "prepare_deal") return "prepare";
  return "settle";
}

async function fetchWebConfig(webBaseUrl: string) {
  const res = await fetch(new URL("/api/config", webBaseUrl), { cache: "no-store" as RequestCache });
  if (!res.ok) throw new Error(`Web config error: HTTP ${res.status}`);
  return res.json();
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
    while (true) {
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/agent/action", (req, res) => {
  const sessionId = isPresent(req.body?.sessionId) ? String(req.body.sessionId) : "";
  const action = isPresent(req.body?.action) ? String(req.body.action) : "";
  if (!sessionId) return res.status(400).json({ ok: false, error: "Missing sessionId" });
  if (action !== "confirm_settlement") return res.status(400).json({ ok: false, error: "Unknown action" });
  confirm(sessionId);
  return res.json({ ok: true });
});

app.get("/api/agent/stream", async (req, res) => {
  initSse(res);

  const webBaseUrl = isPresent(process.env.WEB_BASE_URL) ? process.env.WEB_BASE_URL : "http://localhost:3000";
  const mode: DemoMode = req.query.mode === "testnet" ? "testnet" : "simulate";
  const checkoutMode: CheckoutMode = req.query.checkoutMode === "auto" ? "auto" : "confirm";
  const goal = isPresent(req.query.goal) ? String(req.query.goal) : "在市场里找一个合适的店铺并购买一件商品。";
  const buyerNote = isPresent(req.query.buyerNote) ? String(req.query.buyerNote) : "";

  const sessionId = randomUUID();
  const startedAt = Date.now();
  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  const keepAlive = setInterval(() => {
    sendSseComment(res, "keepalive");
  }, 15000);

  const now = () => Date.now();
  const sendState = (state: Record<string, unknown>) => sendSse(res, "state", { ...state, sessionId });

  try {
    const configJson = await fetchWebConfig(webBaseUrl);

    const model = isPresent(process.env.MODEL) ? process.env.MODEL : "qwen-turbo";
    const apiKey = isPresent(process.env.OPENAI_API_KEY) ? process.env.OPENAI_API_KEY : undefined;
    const baseUrl = isPresent(process.env.OPENAI_BASE_URL) ? process.env.OPENAI_BASE_URL : undefined;
    const llmCfg = { model, openAIApiKey: apiKey, openAIBaseUrl: baseUrl };

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

    sendState({ running: true, settling: false, awaitingConfirm: false });
    sendSse(res, "timeline_step", {
      id: "browse",
      status: "running",
      detail: "买家 Agent 浏览店铺",
      ts: now(),
    });

    const buyerOpening = await generateBuyerOpening(llmCfg, goal, buyerNote);
    sendSse(res, "message", {
      id: randomUUID(),
      role: "buyer",
      stage: "browse",
      speaker: "买家 Agent",
      content: buyerOpening,
      ts: now(),
    });

    const emitTool = async <T,>(name: string, args: unknown, runner: () => Promise<T>) => {
      const id = randomUUID();
      sendSse(res, "tool_call", { id, stage: stageForTool(name), name, args, ts: now() });
      try {
        const result = await runner();
        sendSse(res, "tool_result", { id, result, ts: now() });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tool failed";
        sendSse(res, "tool_result", { id, result: { ok: false, error: message }, ts: now() });
        throw err;
      }
    };

    const storesRes = (await emitTool("search_stores", { query: goal, limit: 5 }, () =>
      invokeToolBridge(webBaseUrl, "search_stores", { query: goal, limit: 5 })
    )) as any;
    const store = Array.isArray(storesRes?.stores) ? storesRes.stores[0] : null;
    if (!store?.id) throw new Error("No store found");

    const productsRes = (await emitTool("search_products", { storeId: store.id, query: goal, limit: 10 }, () =>
      invokeToolBridge(webBaseUrl, "search_products", { storeId: store.id, query: goal, limit: 10 })
    )) as any;
    const products: any[] = Array.isArray(productsRes?.products) ? productsRes.products : [];
    if (products.length === 0) throw new Error("No product found");

    const underBudget = products
      .map((p) => ({ p, price: parsePriceUSDC(p?.priceUSDC) }))
      .filter((x) => x.price !== null && x.price <= 100)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    const product = (underBudget[0]?.p ?? products[0]) as any;

    sendState({ selectedStoreId: store.id, selectedProductId: product.id });
    sendSse(res, "timeline_step", {
      id: "browse",
      status: "done",
      detail: "店铺/商品已选择",
      ts: now(),
    });

    sendSse(res, "timeline_step", { id: "negotiate", status: "running", detail: "讨价还价中", ts: now() });

    const sellerMsg = await generateSellerReply(llmCfg, {
      storeName: store.name ?? "卖家店铺",
      productName: product.name ?? "商品",
      priceUSDC: String(product.priceUSDC ?? ""),
      highlights: Array.isArray(product.highlights) ? product.highlights : [],
      inventoryHint: product.inventory ?? undefined,
    });
    sendSse(res, "message", {
      id: randomUUID(),
      role: "seller",
      stage: "negotiate",
      speaker: store.sellerAgentName ?? "卖家 Agent",
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
      productName: product.name ?? "商品",
      listPriceUSDC,
      offerPriceUSDC,
    });
    sendSse(res, "message", {
      id: randomUUID(),
      role: "buyer",
      stage: "negotiate",
      speaker: "买家 Agent",
      content: buyerBargain,
      ts: now(),
    });

    const sellerCounter = await generateSellerCounter(llmCfg, {
      storeName: store.name ?? "卖家店铺",
      productName: product.name ?? "商品",
      listPriceUSDC,
      counterPriceUSDC,
    });
    sendSse(res, "message", {
      id: randomUUID(),
      role: "seller",
      stage: "negotiate",
      speaker: store.sellerAgentName ?? "卖家 Agent",
      content: sellerCounter,
      ts: now(),
    });

    const buyerFinalOffer = await generateBuyerFinalOffer(llmCfg, {
      productName: product.name ?? "商品",
      finalPriceUSDC,
    });
    sendSse(res, "message", {
      id: randomUUID(),
      role: "buyer",
      stage: "negotiate",
      speaker: "买家 Agent",
      content: buyerFinalOffer,
      ts: now(),
    });

    const sellerClose = await generateSellerClose(llmCfg, {
      storeName: store.name ?? "卖家店铺",
      productName: product.name ?? "商品",
      finalPriceUSDC,
    });
    sendSse(res, "message", {
      id: randomUUID(),
      role: "seller",
      stage: "negotiate",
      speaker: store.sellerAgentName ?? "卖家 Agent",
      content: sellerClose,
      ts: now(),
    });

    const buyerAccept = await generateBuyerAcceptance(llmCfg, {
      productName: product.name ?? "商品",
      finalPriceUSDC,
    });
    sendSse(res, "message", {
      id: randomUUID(),
      role: "buyer",
      stage: "negotiate",
      speaker: "买家 Agent",
      content: buyerAccept,
      ts: now(),
    });

    sendSse(res, "timeline_step", { id: "negotiate", status: "done", detail: `成交价 ${finalPriceUSDC} USDC`, ts: now() });
    sendSse(res, "timeline_step", { id: "prepare", status: "running", detail: "生成 Deal", ts: now() });

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
        tokenId: product.tokenId,
        priceUSDC: finalPriceUSDC,
        deadlineSecondsFromNow: 3600,
      },
      () =>
        invokeToolBridge(webBaseUrl, "prepare_deal", {
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
    if (preparedDeal) sendState({ deal: preparedDeal });

    sendSse(res, "timeline_step", { id: "prepare", status: "done", detail: "Deal 已生成", ts: now() });

    sendState({ running: false });

    if (checkoutMode === "confirm") {
      sendSse(res, "timeline_step", { id: "confirm", status: "running", detail: "等待确认", ts: now() });
      sendState({ awaitingConfirm: true });
      sendSse(res, "message", {
        id: randomUUID(),
        role: "buyer",
        stage: "prepare",
        speaker: "买家 Agent",
        content: "订单已生成。请点击“发起结算”继续跨链结算。",
        ts: now(),
      });
      await waitForConfirm(sessionId, abortController.signal);
      sendState({ awaitingConfirm: false });
    } else {
      sendSse(res, "timeline_step", { id: "confirm", status: "done", detail: "全自动", ts: now() });
    }

    sendState({ settling: true });
    sendSse(res, "timeline_step", { id: "settle", status: "running", detail: "开始跨链结算", ts: now() });

    const settleRes = (await emitTool("settle_deal", { mode, deal: preparedDeal }, () =>
      invokeToolBridge(webBaseUrl, "settle_deal", { mode, deal: preparedDeal })
    )) as any;
    const settlementStreamUrl = settleRes?.streamUrl ?? null;
    if (!settlementStreamUrl) throw new Error("Missing settlement streamUrl");

    const settleUrl = new URL(settlementStreamUrl, webBaseUrl);
    const settleStream = await fetch(settleUrl, { signal: abortController.signal });
    if (!settleStream.ok || !settleStream.body) throw new Error(`Settlement stream error: HTTP ${settleStream.status}`);

    await readSseStream(settleStream.body, (evt, raw) => {
      if (abortController.signal.aborted) return;
      if (evt === "step") {
        try {
          const step = JSON.parse(raw);
          sendSse(res, "timeline_step", { ...step, ts: now() });
        } catch {
          // ignore
        }
      }
      if (evt === "log") {
        sendSse(res, "message", {
          id: randomUUID(),
          role: "system",
          stage: "settle",
          speaker: "结算",
          content: raw,
          ts: now(),
        });
      }
    });

    sendSse(res, "timeline_step", { id: "settle", status: "done", detail: `耗时 ${Date.now() - startedAt}ms`, ts: now() });
    sendState({ settling: false });
    sendSse(res, "done", { ok: true, ts: now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendSse(res, "error", { message, ts: Date.now() });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[agent] listening on http://localhost:${port}`);
});
