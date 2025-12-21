import { ethers } from "ethers";
import { encodeBase64Url } from "@/lib/base64url";
import { createDeal, type Deal } from "@/lib/deal";
import { clearSession, waitForConfirm } from "@/lib/agentSessions";
import { getSessionFromRequest, isAuthRequired } from "@/lib/agentAuth";
import { getAllStores, type MergedStore, type MergedProduct } from "@/lib/catalogMerge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoMode = "testnet" | "simulate";
type CheckoutMode = "auto" | "confirm";

type TimelineStatus = "idle" | "running" | "done" | "error";

type AgentMessageRole = "buyer" | "seller" | "system";
type ChatStage = "browse" | "negotiate" | "prepare" | "settle";

type AgentStreamEvent =
  | {
      type: "message";
      message: {
        id: string;
        role: AgentMessageRole;
        stage: ChatStage;
        speaker: string;
        content: string;
        ts: number;
      };
    }
  | {
      type: "tool_call";
      tool: { id: string; stage: ChatStage; name: string; args: unknown; ts: number };
    }
  | {
      type: "tool_result";
      tool: { id: string; result: unknown; ts: number };
    }
  | {
      type: "timeline_step";
      step: { id: string; status?: TimelineStatus; detail?: string; txHash?: string };
    }
  | {
      type: "state";
      state: Partial<{
        selectedStoreId: string;
        selectedProductId: string;
        deal: SerializedDeal | null;
        running: boolean;
        settling: boolean;
        awaitingConfirm: boolean;
        sessionId: string;
      }>;
    }
  | { type: "done" }
  | { type: "error"; error: { message: string } };

type AgentStatePayload = Extract<AgentStreamEvent, { type: "state" }>["state"];
type AgentMessagePayload = Extract<AgentStreamEvent, { type: "message" }>["message"];
type AgentToolCallPayload = Extract<AgentStreamEvent, { type: "tool_call" }>["tool"];
type AgentToolResultPayload = Extract<AgentStreamEvent, { type: "tool_result" }>["tool"];
type AgentTimelineStepPayload = Extract<AgentStreamEvent, { type: "timeline_step" }>["step"];

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

function now() {
  return Date.now();
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function serializeDeal(deal: Deal): SerializedDeal {
  return {
    ...deal,
    tokenId: deal.tokenId.toString(),
    price: deal.price.toString(),
    deadline: deal.deadline.toString(),
  };
}

function isPresent(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function safeAddressFromPrivateKey(privateKey: string | undefined) {
  if (!isPresent(privateKey)) return undefined;
  try {
    return new ethers.Wallet(privateKey!).address;
  } catch {
    return undefined;
  }
}

function pseudoAddress(label: string) {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(`universal-ai-market:${label}`));
  return ethers.getAddress(`0x${hash.slice(-40)}`);
}

function normalizeAddress(value: string | undefined, label: string) {
  if (value && ethers.isAddress(value)) return ethers.getAddress(value);
  return pseudoAddress(label);
}

function kindLabel(kind: "digital" | "physical") {
  return kind === "physical" ? "实物" : "数字商品";
}

function inventoryLabel(status: string) {
  switch (status) {
    case "in_stock":
      return "库存充足";
    case "limited":
      return "限量";
    case "preorder":
      return "预售";
    default:
      return status;
  }
}

function formatUSDC(raw: bigint) {
  return `${ethers.formatUnits(raw, 6)} USDC`;
}

function scoreText(haystack: string, needle: string) {
  const query = needle.toLowerCase();
  const tokens = new Set<string>();

  for (const t of query
    .split(/[\s,，。！？!?.；;]+/g)
    .map((v) => v.trim())
    .filter(Boolean)) {
    tokens.add(t);
  }

  const segments = query.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? [];
  for (const seg of segments) {
    if (/^[\u4e00-\u9fff]+$/.test(seg) && seg.length >= 2) {
      tokens.add(seg);
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.add(seg.slice(i, i + 2));
      }
      continue;
    }
    tokens.add(seg);
  }

  const terms = Array.from(tokens)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 2);
  const content = haystack.toLowerCase();
  return terms.reduce((sum, t) => sum + (content.includes(t) ? 1 : 0), 0);
}

function pickStore(goal: string, opts?: { preferDemoReady?: boolean }): MergedStore {
  const allStores = getAllStores();
  const candidateStores = opts?.preferDemoReady ? allStores.filter((store) => store.products.some((p) => p.demoReady)) : allStores;
  const scored = candidateStores
    .map((store) => {
      const content = `${store.name} ${store.tagline} ${store.location} ${store.categories.join(" ")} ${store.products
        .map((p) => `${p.name} ${p.description} ${(p.tags || []).join(" ")} ${(p.highlights || []).join(" ")}`)
        .join(" ")}`;
      return { store, score: scoreText(content, goal) };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.store ?? allStores[0];
}

function pickProduct(store: MergedStore, goal: string, opts?: { preferDemoReady?: boolean }): MergedProduct {
  const products = opts?.preferDemoReady ? store.products.filter((p) => p.demoReady) : store.products;
  const scored = products
    .map((product) => {
      const content = `${product.name} ${product.description} ${(product.tags || []).join(" ")} ${(product.highlights || []).join(" ")}`;
      return { product, score: scoreText(content, goal) };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.product ?? store.products[0];
}

function id() {
  return crypto.randomUUID();
}

function encodeSseEvent(event: AgentStreamEvent) {
  const map = (evt: AgentStreamEvent) => {
    if (evt.type === "message") return { name: "message", data: evt.message };
    if (evt.type === "tool_call") return { name: "tool_call", data: evt.tool };
    if (evt.type === "tool_result") return { name: "tool_result", data: evt.tool };
    if (evt.type === "timeline_step") return { name: "timeline_step", data: evt.step };
    if (evt.type === "state") return { name: "state", data: evt.state };
    if (evt.type === "done") return { name: "done", data: {} };
    return { name: "error", data: evt.error };
  };

  const { name, data } = map(event);
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
  signal: AbortSignal
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
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

async function streamBuiltin(req: Request) {
  const url = new URL(req.url);
  const mode: DemoMode = url.searchParams.get("mode") === "testnet" ? "testnet" : "simulate";
  const checkoutMode: CheckoutMode = url.searchParams.get("checkoutMode") === "auto" ? "auto" : "confirm";
  const goal = url.searchParams.get("goal") || "帮我在这个 AI 电商里找一个 10 USDC 以内的酷炫商品并购买。";
  const buyerNote = url.searchParams.get("buyerNote") || "";

  if (mode === "testnet" && isAuthRequired() && !getSessionFromRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionId = crypto.randomUUID();

  const selectedStore = pickStore(goal, { preferDemoReady: mode === "testnet" });
  const product = pickProduct(selectedStore, goal, { preferDemoReady: mode === "testnet" });

  // 动态商品使用 nftConfig 和 sellerConfig，静态商品使用环境变量
  const isDynamic = product.isDynamic && product.nftConfig && product.sellerConfig;

  const buyerPk = process.env.BUYER_PRIVATE_KEY;
  const sellerPk = process.env.SELLER_PRIVATE_KEY;

  const buyerAddress = normalizeAddress(safeAddressFromPrivateKey(buyerPk), "buyer");

  // 卖家地址：动态商品使用 sellerConfig.walletAddress，静态商品使用环境变量
  const sellerBaseAddress = isDynamic && product.sellerConfig?.walletAddress
    ? normalizeAddress(product.sellerConfig.walletAddress, "seller")
    : normalizeAddress(safeAddressFromPrivateKey(sellerPk), "seller");

  // NFT 配置：动态商品使用 nftConfig，静态商品使用环境变量
  const polygonEscrow = isDynamic && product.nftConfig?.escrowAddress
    ? normalizeAddress(product.nftConfig.escrowAddress, "polygonEscrow")
    : normalizeAddress(process.env.POLYGON_WEAPON_ESCROW, "polygonEscrow");
  const polygonNft = isDynamic && product.nftConfig?.contractAddress
    ? normalizeAddress(product.nftConfig.contractAddress, "polygonNFT")
    : normalizeAddress(process.env.POLYGON_MOCK_WEAPON_NFT, "polygonNFT");
  const productTokenId = isDynamic && product.nftConfig?.tokenId !== undefined
    ? product.nftConfig.tokenId
    : product.tokenId;

  const configReady = isDynamic
    ? Boolean(
        product.nftConfig?.contractAddress &&
        product.nftConfig?.escrowAddress &&
        product.sellerConfig?.walletAddress &&
        isPresent(process.env.BUYER_PRIVATE_KEY)
      )
    : Boolean(
        isPresent(process.env.BASE_GATEWAY_ADDRESS) &&
          isPresent(process.env.BASE_USDC_ADDRESS) &&
          isPresent(process.env.ZETA_UNIVERSAL_MARKET) &&
          isPresent(process.env.POLYGON_WEAPON_ESCROW) &&
          isPresent(process.env.POLYGON_MOCK_WEAPON_NFT) &&
          isPresent(process.env.BUYER_PRIVATE_KEY) &&
          isPresent(process.env.SELLER_PRIVATE_KEY)
      );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const signal = req.signal;

      const send = (evt: AgentStreamEvent) => controller.enqueue(encoder.encode(encodeSseEvent(evt)));
      const sendState = (state: AgentStatePayload) => send({ type: "state", state: { ...state, sessionId } });
      const sendMessage = (message: AgentMessagePayload) => send({ type: "message", message });
      const sendToolCall = (tool: AgentToolCallPayload) => send({ type: "tool_call", tool });
      const sendToolResult = (tool: AgentToolResultPayload) => send({ type: "tool_result", tool });
      const sendStep = (step: AgentTimelineStepPayload) => send({ type: "timeline_step", step });

      (async () => {
        try {
          sendState({ running: true, settling: false, awaitingConfirm: false });
          sendState({ selectedStoreId: selectedStore.id, selectedProductId: product.id });

          sendStep({ id: "browse", status: "running" });
          sendMessage({
            id: id(),
            role: "buyer",
            stage: "browse",
            speaker: "买家 Agent",
            content: buyerNote ? `我的需求：${goal}\n补充：${buyerNote}` : `我的需求：${goal}`,
            ts: now(),
          });
          await sleep(350, signal);

          sendMessage({
            id: id(),
            role: "seller",
            stage: "browse",
            speaker: selectedStore.sellerAgentName,
            content: `欢迎光临「${selectedStore.name}」。我推荐：${product.name}（${kindLabel(product.kind)}），价格 ${product.priceUSDC} USDC。亮点：${(product.highlights || [])
              .slice(0, 3)
              .join(" / ") || "精品好物"}。库存：${inventoryLabel(product.inventory)}。`,
            ts: now(),
          });

          sendStep({ id: "browse", status: "done", detail: `${selectedStore.name} / ${product.name}` });
          sendStep({ id: "negotiate", status: "running" });
          await sleep(450, signal);

          sendMessage({
            id: id(),
            role: "buyer",
            stage: "negotiate",
            speaker: "买家 Agent",
            content: `我预算 100 USDC 内，这个价格还行，但我希望你能再优惠一点，并确认会在 Polygon 交付收据/NFT。`,
            ts: now(),
          });
          await sleep(450, signal);
          sendMessage({
            id: id(),
            role: "seller",
            stage: "negotiate",
            speaker: selectedStore.sellerAgentName,
            content: `没问题。我们按标价成交，并由 Polygon 托管合约在跨链结算完成后自动释放给你。`,
            ts: now(),
          });
          sendStep({ id: "negotiate", status: "done", detail: `成交价 ${product.priceUSDC} USDC` });

          sendStep({ id: "prepare", status: "running" });

          const prepareId = id();
          sendToolCall({
            id: prepareId,
            stage: "prepare",
            name: "prepare_deal",
            args: {
              buyer: buyerAddress,
              sellerBase: sellerBaseAddress,
              polygonEscrow,
              nft: polygonNft,
              tokenId: productTokenId,
              priceUSDC: product.priceUSDC,
              deadlineSecondsFromNow: 3600,
            },
            ts: now(),
          });

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
          const prepared = createDeal({
            buyer: buyerAddress,
            sellerBase: sellerBaseAddress,
            polygonEscrow,
            nft: polygonNft,
            tokenId: BigInt(productTokenId),
            price: ethers.parseUnits(product.priceUSDC, 6),
            deadline,
          });

          sendToolResult({
            id: prepareId,
            result: {
              dealId: prepared.dealId,
              price: formatUSDC(prepared.price),
              tokenId: prepared.tokenId.toString(),
              deadline: new Date(Number(prepared.deadline) * 1000).toISOString(),
            },
            ts: now(),
          });
          sendState({ deal: serializeDeal(prepared) });
          sendStep({ id: "prepare", status: "done", detail: `dealId ${prepared.dealId.slice(0, 10)}...` });
          sendMessage({
            id: id(),
            role: "system",
            stage: "prepare",
            speaker: "系统",
            content: `Deal 已生成：${prepared.dealId.slice(0, 10)}...（Payload 已就绪，可发起跨链结算）。`,
            ts: now(),
          });

          const wantsAuto = checkoutMode === "auto";
          const canAutoSettle = wantsAuto && (mode === "simulate" || (mode === "testnet" && configReady && product.demoReady));

          sendMessage({
            id: id(),
            role: "buyer",
            stage: canAutoSettle ? "settle" : "prepare",
            speaker: "买家 Agent",
            content: canAutoSettle
              ? mode === "testnet"
                ? "订单已生成，已开启全自动结算：我将立即在测试网发起跨链结算。"
                : "订单已生成，已开启全自动结算：我将立即模拟发起跨链结算流程。"
              : wantsAuto
                ? "订单已生成，但当前条件不支持全自动结算；请点击「发起结算」继续。"
                : mode === "testnet"
                  ? "订单已生成。点击「发起结算」即可在测试网执行跨链结算。"
                  : "订单已生成。点击「发起结算」即可模拟跨链结算流程。",
            ts: now(),
          });

          sendStep({
            id: "confirm",
            status: canAutoSettle ? "done" : "running",
            detail: canAutoSettle ? "全自动发起" : wantsAuto ? "自动不可用，需确认" : "等待确认",
          });

          sendState({ running: false });

          if (!canAutoSettle) {
            sendState({ awaitingConfirm: true });
            await waitForConfirm(sessionId);
            clearSession(sessionId);
            if (signal.aborted) return;
          } else {
            await sleep(450, signal);
            if (signal.aborted) return;
          }

          sendState({ awaitingConfirm: false, settling: true });
          sendStep({ id: "confirm", status: "done", detail: "已确认" });

          const settleToolId = id();
          sendToolCall({
            id: settleToolId,
            stage: "settle",
            name: "settle_deal",
            args: { mode, dealId: prepared.dealId },
            ts: now(),
          });

          const qs = new URLSearchParams();
          qs.set("mode", mode);
          qs.set("deal", encodeBase64Url(JSON.stringify(serializeDeal(prepared))));

          const settleUrl = new URL(`/api/settle/stream?${qs.toString()}`, url.origin);
          const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
          const settleRes = await fetch(settleUrl, {
            signal,
            headers: authHeader
              ? { Authorization: authHeader, Accept: "text/event-stream" }
              : { Accept: "text/event-stream" },
          });
          if (!settleRes.ok || !settleRes.body) {
            throw new Error(`结算接口错误：HTTP ${settleRes.status}`);
          }

          await readSseStream(
            settleRes.body,
            (evt, raw) => {
              if (signal.aborted) return;
              if (evt === "step") {
                try {
                  const step = JSON.parse(raw) as {
                    id: string;
                    status?: TimelineStatus;
                    detail?: string;
                    txHash?: string;
                  };
                  send({ type: "timeline_step", step });
                } catch {
                  // ignore
                }
                return;
              }

              if (evt === "log") {
                try {
                  const log = JSON.parse(raw) as { role: AgentMessageRole; content: string };
                  sendMessage({
                    id: id(),
                    role: log.role,
                    stage: "settle",
                    speaker: log.role === "buyer" ? "买家 Agent" : log.role === "seller" ? selectedStore.sellerAgentName : "系统",
                    content: log.content,
                    ts: now(),
                  });
                } catch {
                  // ignore
                }
                return;
              }

              if (evt === "error") {
                send({ type: "error", error: { message: raw } });
              }
            },
            signal
          );

          sendToolResult({ id: settleToolId, result: { ok: true }, ts: now() });
          sendState({ settling: false });
          send({ type: "done" });
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "未知错误";
          send({ type: "error", error: { message } });
          controller.close();
        } finally {
          clearSession(sessionId);
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function streamProxy(req: Request) {
  const url = new URL(req.url);
  const upstream = url.searchParams.get("upstream");
  if (!upstream) return new Response("Missing upstream", { status: 400 });

  const upstreamUrl = new URL(upstream);
  const forwarded = new URLSearchParams(url.searchParams);
  forwarded.delete("engine");
  forwarded.delete("upstream");
  upstreamUrl.search = forwarded.toString();

  const res = await fetch(upstreamUrl, { headers: { Accept: "text/event-stream" }, signal: req.signal });
  return new Response(res.body, { status: res.status, headers: res.headers });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const engine = url.searchParams.get("engine") === "proxy" ? "proxy" : "builtin";
  return engine === "proxy" ? streamProxy(req) : streamBuiltin(req);
}
