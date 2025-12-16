import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { initSse, sendSse, sendSseComment } from "./sse.js";
import { confirm, waitForConfirm } from "./sessionStore.js";
import { MarketClient } from "./marketClient.js";
import { runDemoFlow } from "./demoFlow.js";
import { AguiEmitter } from "./aguiEmitter.js";
import { runMultiAgentFlow } from "./multiAgentFlow.js";
import { SseFlowEmitter } from "./sseFlowEmitter.js";
import { attachRunStream, createRunSession } from "./runSessions.js";
import { RunSessionEmitter } from "./runSessionEmitter.js";
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

function extractGoalFromRunInput(input: any): string | undefined {
  const messages = Array.isArray(input?.messages) ? input.messages : [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const c = m?.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
      const parts = c
        .filter((x: any) => x?.type === "text" && typeof x?.text === "string")
        .map((x: any) => x.text);
      if (parts.length) return parts.join("\n");
    }
  }
  return undefined;
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

// ─── LLM 配置 ───
const llmModel = isPresent(process.env.MODEL) ? process.env.MODEL : "qwen-turbo";
const llmApiKey = isPresent(process.env.OPENAI_API_KEY) ? process.env.OPENAI_API_KEY : undefined;
const llmBaseUrl = isPresent(process.env.OPENAI_BASE_URL) ? process.env.OPENAI_BASE_URL : undefined;

// LLM 连接状态
let llmAvailable = false;

function createLLM() {
  return new ChatOpenAI({
    model: llmModel,
    apiKey: llmApiKey,
    configuration: llmBaseUrl ? { baseURL: llmBaseUrl } : undefined,
    temperature: 0.5,
  });
}

async function testLLMConnection(): Promise<boolean> {
  if (!llmApiKey && !llmBaseUrl) {
    console.log(`[agent] LLM 未配置，使用固定话术模式`);
    return false;
  }

  console.log(`[agent] 测试 LLM 连接... (model: ${llmModel})`);
  try {
    const llm = createLLM();
    const testMessage = new HumanMessage("你好，请回复'OK'");
    const res = await llm.invoke([testMessage]);
    const content = String(res.content ?? "").trim();
    if (content.length > 0) {
      console.log(`[agent] ✅ LLM 连接成功，响应: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`);
      return true;
    }
    console.log(`[agent] ⚠️ LLM 返回空内容，fallback 到固定话术`);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[agent] ❌ LLM 连接失败: ${msg}`);
    console.log(`[agent] fallback 到固定话术模式`);
    return false;
  }
}

// 获取当前 LLM 配置（供各流程使用）
function getLlmConfig() {
  return {
    model: llmModel,
    openAIApiKey: llmAvailable ? llmApiKey : undefined, // 不可用时不传 key，触发 fallback
    openAIBaseUrl: llmAvailable ? llmBaseUrl : undefined,
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, llmAvailable, model: llmModel }));

app.post("/api/agent/run", async (req, res) => {
  const webBaseUrl = isPresent(process.env.WEB_BASE_URL) ? process.env.WEB_BASE_URL : "http://localhost:3001";
  const market = new MarketClient({
    baseUrl: webBaseUrl,
    agentId: isPresent(process.env.AGENT_ID) ? process.env.AGENT_ID : undefined,
    agentPrivateKey: isPresent(process.env.AGENT_PRIVATE_KEY) ? process.env.AGENT_PRIVATE_KEY : undefined,
  });

  const mode: DemoMode = req.body?.mode === "testnet" ? "testnet" : "simulate";
  const checkoutMode: CheckoutMode = req.body?.checkoutMode === "auto" ? "auto" : "confirm";
  const goal = isPresent(req.body?.goal) ? String(req.body.goal) : "在市场里找一个合适的店铺并购买一件商品。";
  const buyerNote = isPresent(req.body?.buyerNote) ? String(req.body.buyerNote) : "";
  const scenario = isPresent(req.body?.scenario) ? String(req.body.scenario) : "multi";

  const session = createRunSession();
  const sessionId = session.id;
  const startedAt = Date.now();
  const now = () => Date.now();
  const emitter = new RunSessionEmitter(sessionId, now);
  const abortController = new AbortController();

  // Start the run asynchronously; web clients can attach via /api/agent/stream?sessionId=...
  (async () => {
    try {
      const configJson = await market.getConfig();
      const llmCfg = getLlmConfig();

      if (scenario === "multi") {
        await runMultiAgentFlow({
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
          signal: abortController.signal,
          now,
        });
      } else {
        await runDemoFlow({
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
          signal: abortController.signal,
          now,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      emitter.error({ message, ts: Date.now() });
    }
  })();

  return res.json({
    ok: true,
    sessionId,
  });
});

app.post("/api/agent/action", (req, res) => {
  const sessionId = isPresent(req.body?.sessionId) ? String(req.body.sessionId) : "";
  const action = isPresent(req.body?.action) ? String(req.body.action) : "";
  if (!sessionId) return res.status(400).json({ ok: false, error: "Missing sessionId" });
  if (action !== "confirm_settlement") return res.status(400).json({ ok: false, error: "Unknown action" });
  confirm(sessionId);
  return res.json({ ok: true });
});

app.get("/api/agent/stream", async (req, res) => {
  const attachId = isPresent(req.query.sessionId) ? String(req.query.sessionId) : "";
  if (attachId) {
    const ok = attachRunStream(attachId, res);
    if (!ok) return res.status(404).json({ ok: false, error: "Unknown sessionId" });
    return;
  }

  initSse(res);

  const webBaseUrl = isPresent(process.env.WEB_BASE_URL) ? process.env.WEB_BASE_URL : "http://localhost:3001";
  const market = new MarketClient({
    baseUrl: webBaseUrl,
    agentId: isPresent(process.env.AGENT_ID) ? process.env.AGENT_ID : undefined,
    agentPrivateKey: isPresent(process.env.AGENT_PRIVATE_KEY) ? process.env.AGENT_PRIVATE_KEY : undefined,
  });
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
    const configJson = await market.getConfig();
    const llmCfg = getLlmConfig();

    const scenario = isPresent(req.query.scenario) ? String(req.query.scenario) : "single";
    if (scenario === "multi") {
      const emitter = new SseFlowEmitter(res, { sessionId, now });
      await runMultiAgentFlow({
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
        signal: abortController.signal,
        now,
      });
      return;
    }

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
      market.invokeTool("settle_deal", { mode, deal: preparedDeal })
    )) as any;
    const settlementStreamUrl = settleRes?.streamUrl ?? null;
    if (!settlementStreamUrl) throw new Error("Missing settlement streamUrl");

    const settleStream = await market.fetchSettlementStream(settlementStreamUrl, abortController.signal);
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

app.post("/api/agui/run", async (req, res) => {
  const webBaseUrl = isPresent(process.env.WEB_BASE_URL) ? process.env.WEB_BASE_URL : "http://localhost:3001";
  const market = new MarketClient({
    baseUrl: webBaseUrl,
    agentId: isPresent(process.env.AGENT_ID) ? process.env.AGENT_ID : undefined,
    agentPrivateKey: isPresent(process.env.AGENT_PRIVATE_KEY) ? process.env.AGENT_PRIVATE_KEY : undefined,
  });

  const input = (req.body ?? {}) as any;
  const forwardedProps = (input?.forwardedProps ?? {}) as any;
  const mode: DemoMode = forwardedProps.mode === "testnet" ? "testnet" : "simulate";
  const checkoutMode: CheckoutMode = forwardedProps.checkoutMode === "auto" ? "auto" : "confirm";
  const goalFromInput = extractGoalFromRunInput(input);
  const goal = isPresent(forwardedProps.goal) ? String(forwardedProps.goal) : goalFromInput ?? "Browse the market and buy a product.";
  const buyerNote = isPresent(forwardedProps.buyerNote) ? String(forwardedProps.buyerNote) : "";
  const scenario = isPresent(forwardedProps.scenario) ? String(forwardedProps.scenario) : "single";

  const sessionId = randomUUID();
  const startedAt = Date.now();
  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  const now = () => Date.now();
  const emitter = new AguiEmitter(res, { sessionId, now });
  emitter.sendRunStarted(input);

  const keepAlive = setInterval(() => {
    emitter.comment("keepalive");
  }, 15000);

  try {
    const configJson = await market.getConfig();
    const llmCfg = getLlmConfig();

    if (scenario === "multi") {
      await runMultiAgentFlow({
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
        signal: abortController.signal,
        now,
      });
    } else {
      await runDemoFlow({
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
        signal: abortController.signal,
        now,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    emitter.error({ message, ts: Date.now() });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

const port = Number(process.env.PORT || 8080);

async function main() {
  // 启动时测试 LLM 连接
  llmAvailable = await testLLMConnection();

  app.listen(port, () => {
    console.log(`[agent] listening on http://localhost:${port}`);
    console.log(`[agent] LLM 模式: ${llmAvailable ? "启用" : "固定话术"}`);
  });
}

main().catch((err) => {
  console.error("[agent] 启动失败:", err);
  process.exit(1);
});
