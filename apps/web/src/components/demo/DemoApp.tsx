"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Cable,
  CircleCheck,
  CircleDashed,
  CircleX,
  Copy,
  Coins,
  Command,
  Layers,
  Maximize2,
  MessageSquareText,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  X,
  Zap as ZapIcon,
  RotateCcw,
} from "lucide-react";
import Button from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STORES, type InventoryStatus, type ProductKind } from "@/lib/catalog";
import { type Deal } from "@/lib/deal";
import { cn } from "@/lib/cn";

type DemoMode = "testnet" | "simulate";
type CheckoutMode = "auto" | "confirm";
type AgentEngine = "builtin" | "proxy";

type TimelineStatus = "idle" | "running" | "done" | "error";

type TimelineChain = "offchain" | "baseSepolia" | "zetaAthens" | "polygonAmoy";

interface TimelineItem {
  id: string;
  title: string;
  chain: TimelineChain;
  status: TimelineStatus;
  detail?: string;
  txHash?: string;
  ts: number;
}

type ChatRole = "buyer" | "seller" | "tool" | "system";

type ChatStage = "browse" | "negotiate" | "prepare" | "settle";

interface ToolCall {
  name: string;
  args: unknown;
  result?: unknown;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  stage?: ChatStage;
  speaker: string;
  content: string;
  ts: number;
  tool?: ToolCall;
}

interface PublicConfig {
  modeHint: DemoMode;
  accounts?: {
    buyer: string;
    seller: string;
  };
  contracts?: {
    baseGateway?: string;
    baseUSDC?: string;
    universalMarket?: string;
    polygonEscrow?: string;
    polygonNFT?: string;
  };
  missing: string[];
}

function now() {
  return Date.now();
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
}

function stringifyForDisplay(value: unknown, pretty: boolean) {
  try {
    return JSON.stringify(
      value,
      (_key, v) => (typeof v === "bigint" ? v.toString() : v),
      pretty ? 2 : 0
    );
  } catch {
    return String(value);
  }
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function formatAddress(address?: string) {
  if (!address) return "-";
  if (!address.startsWith("0x") || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseSerializedDeal(raw: unknown): Deal | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const dealId = typeof obj.dealId === "string" ? obj.dealId : undefined;
  const buyer = typeof obj.buyer === "string" ? obj.buyer : undefined;
  const sellerBase = typeof obj.sellerBase === "string" ? obj.sellerBase : undefined;
  const polygonEscrow = typeof obj.polygonEscrow === "string" ? obj.polygonEscrow : undefined;
  const nft = typeof obj.nft === "string" ? obj.nft : undefined;
  const tokenIdRaw = obj.tokenId;
  const priceRaw = obj.price;
  const deadlineRaw = obj.deadline;

  if (!dealId || !buyer || !sellerBase || !polygonEscrow || !nft) return null;

  try {
    const tokenId =
      typeof tokenIdRaw === "bigint"
        ? tokenIdRaw
        : typeof tokenIdRaw === "number"
          ? BigInt(tokenIdRaw)
          : typeof tokenIdRaw === "string"
            ? BigInt(tokenIdRaw)
            : null;
    const price =
      typeof priceRaw === "bigint"
        ? priceRaw
        : typeof priceRaw === "number"
          ? BigInt(priceRaw)
          : typeof priceRaw === "string"
            ? BigInt(priceRaw)
            : null;
    const deadline =
      typeof deadlineRaw === "bigint"
        ? deadlineRaw
        : typeof deadlineRaw === "number"
          ? BigInt(deadlineRaw)
          : typeof deadlineRaw === "string"
            ? BigInt(deadlineRaw)
            : null;

    if (tokenId === null || price === null || deadline === null) return null;

    return {
      dealId,
      buyer,
      sellerBase,
      polygonEscrow,
      nft,
      tokenId,
      price,
      deadline,
    };
  } catch {
    return null;
  }
}

function formatOrders(orders: number) {
  if (orders >= 10000) return `${(orders / 10000).toFixed(1)}万`;
  if (orders >= 1000) return `${(orders / 1000).toFixed(1)}k`;
  return `${orders}`;
}

function kindLabel(kind: ProductKind) {
  return kind === "physical" ? "实物" : "数字商品";
}

function inventoryLabel(status: InventoryStatus) {
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

type NormalizedChatStage = ChatStage | "other";

function normalizeChatStage(stage: ChatStage | undefined): NormalizedChatStage {
  return stage ?? "other";
}

function chatStageLabel(stage: NormalizedChatStage) {
  switch (stage) {
    case "browse":
      return "逛市场";
    case "negotiate":
      return "协商条款";
    case "prepare":
      return "生成 Deal";
    case "settle":
      return "跨链结算";
    default:
      return "对话";
  }
}

function chatStageBadgeClass(stage: NormalizedChatStage) {
  switch (stage) {
    case "browse":
      return "border-indigo-300/20 bg-indigo-500/10 text-indigo-100";
    case "negotiate":
      return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
    case "prepare":
      return "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100";
    case "settle":
      return "border-amber-300/20 bg-amber-500/10 text-amber-100";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function chatStageIcon(stage: NormalizedChatStage) {
  switch (stage) {
    case "browse":
      return <Search className="h-3.5 w-3.5" />;
    case "negotiate":
      return <MessageSquareText className="h-3.5 w-3.5" />;
    case "prepare":
      return <Layers className="h-3.5 w-3.5" />;
    case "settle":
      return <Cable className="h-3.5 w-3.5" />;
    default:
      return <Sparkles className="h-3.5 w-3.5" />;
  }
}

function scoreText(haystack: string, needle: string) {
  const query = needle.toLowerCase();
  const tokens = new Set<string>();

  for (const t of query.split(/[\s,，。！？!?.；;]+/g).map((v) => v.trim()).filter(Boolean)) {
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

function chainIcon(chain: TimelineChain) {
  switch (chain) {
    case "baseSepolia":
      return <Coins className="h-4 w-4" />;
    case "zetaAthens":
      return <Cable className="h-4 w-4" />;
    case "polygonAmoy":
      return <Layers className="h-4 w-4" />;
    default:
      return <Command className="h-4 w-4" />;
  }
}

function chainLabel(chain: TimelineChain) {
  switch (chain) {
    case "baseSepolia":
      return "Base Sepolia";
    case "zetaAthens":
      return "Zeta Athens";
    case "polygonAmoy":
      return "Polygon Amoy";
    default:
      return "链下";
  }
}

function statusIcon(status: TimelineStatus) {
  switch (status) {
    case "done":
      return <CircleCheck className="h-4 w-4 text-emerald-300" />;
    case "error":
      return <CircleX className="h-4 w-4 text-rose-300" />;
    case "running":
      return <CircleDashed className="h-4 w-4 text-indigo-300 animate-spin" />;
    default:
      return <CircleDashed className="h-4 w-4 text-white/30" />;
  }
}

function startOfDemoTimeline() {
  const t = now();
  return [
    {
      id: "browse",
      title: "买家 Agent 浏览店铺",
      chain: "offchain",
      status: "idle",
      ts: t,
    },
    {
      id: "negotiate",
      title: "买家 Agent 与卖家 Agent 协商",
      chain: "offchain",
      status: "idle",
      ts: t,
    },
    {
      id: "prepare",
      title: "生成 Deal 并编码 Payload",
      chain: "offchain",
      status: "idle",
      ts: t,
    },
    {
      id: "confirm",
      title: "确认并发起结算",
      chain: "offchain",
      status: "idle",
      ts: t,
    },
    {
      id: "approve",
      title: "授权 USDC 支付",
      chain: "baseSepolia",
      status: "idle",
      ts: t,
    },
    {
      id: "deposit",
      title: "Base 发起 depositAndCall（付款）",
      chain: "baseSepolia",
      status: "idle",
      ts: t,
    },
    {
      id: "orchestrate",
      title: "ZetaChain 编排（支付 + 交付）",
      chain: "zetaAthens",
      status: "idle",
      ts: t,
    },
    {
      id: "deliver",
      title: "Polygon 托管合约释放 NFT / 收据",
      chain: "polygonAmoy",
      status: "idle",
      ts: t,
    },
  ] satisfies TimelineItem[];
}

export default function DemoApp() {
  const [mode, setMode] = React.useState<DemoMode>("testnet");
  const [config, setConfig] = React.useState<PublicConfig>({
    modeHint: "testnet",
    missing: [],
  });

  const [marketModalOpen, setMarketModalOpen] = React.useState(false);
  const [chatModalOpen, setChatModalOpen] = React.useState(false);
  const [toolModal, setToolModal] = React.useState<{
    name: string;
    ts: number;
    stage?: ChatStage;
    args: unknown;
    result?: unknown;
  } | null>(null);
  const [toolModalMaximized, setToolModalMaximized] = React.useState(false);
  const chatScrollEmbeddedRef = React.useRef<HTMLDivElement | null>(null);

  const [chatView, setChatView] = React.useState<"process" | "dialogue">("process");
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "ok" | "err">("idle");

  const [goal, setGoal] = React.useState(
    "帮我在这个 AI 电商里找一个 100 USDC 以内的酷炫商品并购买。要求：卖家在 Base 收到 USDC，我在 Polygon 收到 NFT（或收据）。"
  );
  const [buyerNote, setBuyerNote] = React.useState("");
  const [checkoutMode, setCheckoutMode] = React.useState<CheckoutMode>("confirm");
  const [agentEngine, setAgentEngine] = React.useState<AgentEngine>("builtin");
  const [agentUpstream, setAgentUpstream] = React.useState("http://localhost:8080/api/agent/stream");
  const [agentHealth, setAgentHealth] = React.useState<
    { status: "idle" | "checking" | "ok" | "error"; message?: string }
  >({ status: "idle" });
  const [agentSessionId, setAgentSessionId] = React.useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = React.useState(false);
  const agentSourceRef = React.useRef<EventSource | null>(null);

  const [marketQuery, setMarketQuery] = React.useState("");
  const [marketKind, setMarketKind] = React.useState<"all" | ProductKind>("all");

  const [selectedStoreId, setSelectedStoreId] = React.useState<string>(STORES[0].id);
  const [selectedProductId, setSelectedProductId] = React.useState<string>(STORES[0].products[0].id);

  const selectedStore = React.useMemo(
    () => STORES.find((s) => s.id === selectedStoreId) ?? STORES[0],
    [selectedStoreId]
  );
  const selectedProduct = React.useMemo(
    () =>
      selectedStore.products.find((p) => p.id === selectedProductId) ??
      selectedStore.products[0],
    [selectedStore, selectedProductId]
  );

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>(startOfDemoTimeline());
  const [running, setRunning] = React.useState(false);
  const [deal, setDeal] = React.useState<Deal | null>(null);
  const [settling, setSettling] = React.useState(false);

  const visibleChatMessages = React.useMemo(() => {
    if (chatView === "dialogue") {
      return messages.filter((m) => m.role === "buyer" || m.role === "seller");
    }
    return messages;
  }, [messages, chatView]);

  const chatRows = React.useMemo(() => {
    const rows: Array<
      | { kind: "stage"; id: string; stage: NormalizedChatStage }
      | { kind: "message"; id: string; message: ChatMessage }
    > = [];

    let lastStage: NormalizedChatStage | null = null;
    for (const message of visibleChatMessages) {
      const stage = normalizeChatStage(message.stage);
      if (stage !== lastStage) {
        rows.push({ kind: "stage", id: `stage:${stage}:${message.id}`, stage });
        lastStage = stage;
      }
      rows.push({ kind: "message", id: message.id, message });
    }
    return rows;
  }, [visibleChatMessages]);

  const configReady = config.missing.length === 0;
  const liveOnchain = mode === "testnet" && configReady;

  React.useEffect(() => {
    const overlayOpen = marketModalOpen || chatModalOpen || toolModal !== null;
    if (!overlayOpen) return;

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") {
        setMarketModalOpen(false);
        setChatModalOpen(false);
        setToolModal(null);
        setToolModalMaximized(false);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [marketModalOpen, chatModalOpen, toolModal]);

  React.useEffect(() => {
    if (!autoScroll) return;
    const el = chatScrollEmbeddedRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom && messages.length > 1) return;
    el.scrollTo({ top: el.scrollHeight, behavior: messages.length > 2 ? "smooth" : "auto" });
  }, [messages, chatView, autoScroll, chatModalOpen]);

  React.useEffect(() => {
    if (copyStatus === "idle") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  React.useEffect(() => {
    if (!chatModalOpen) return;
    setChatView("process");
  }, [chatModalOpen]);

  React.useEffect(() => {
    return () => {
      agentSourceRef.current?.close();
      agentSourceRef.current = null;
    };
  }, []);

  const visibleStores = React.useMemo(() => {
    const query = marketQuery.trim();
    return STORES.filter((store) => {
      const kindOk =
        marketKind === "all" || store.products.some((p) => p.kind === marketKind);
      if (!kindOk) return false;
      if (!query) return true;

      const haystack = `${store.name} ${store.tagline} ${store.location} ${store.categories.join(" ")} ${store.products
        .map((p) => `${p.name} ${p.description} ${p.tags.join(" ")} ${p.highlights.join(" ")}`)
        .join(" ")}`;
      return scoreText(haystack, query) > 0;
    });
  }, [marketQuery, marketKind]);

  React.useEffect(() => {
    if (visibleStores.length === 0) return;
    if (!visibleStores.some((s) => s.id === selectedStoreId)) {
      setSelectedStoreId(visibleStores[0].id);
      setSelectedProductId(visibleStores[0].products[0].id);
    }
  }, [visibleStores, selectedStoreId]);

  const visibleProducts = React.useMemo(() => {
    const query = marketQuery.trim();
    let products = selectedStore.products;
    if (marketKind !== "all") products = products.filter((p) => p.kind === marketKind);
    if (!query) return products;
    return products.filter((p) => {
      const haystack = `${p.name} ${p.description} ${p.tags.join(" ")} ${p.highlights.join(" ")}`;
      return scoreText(haystack, query) > 0;
    });
  }, [marketQuery, marketKind, selectedStore.products]);

  React.useEffect(() => {
    if (visibleProducts.length === 0) return;
    if (!visibleProducts.some((p) => p.id === selectedProductId)) {
      setSelectedProductId(visibleProducts[0].id);
    }
  }, [visibleProducts, selectedProductId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PublicConfig;
        if (cancelled) return;
        setConfig(json);
        setMode(json.modeHint);
      } catch {
        if (cancelled) return;
        setConfig({ modeHint: "simulate", missing: ["API_CONFIG_UNAVAILABLE"] });
        setMode("simulate");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pushMessage(next: Omit<ChatMessage, "id" | "ts"> & Partial<Pick<ChatMessage, "id" | "ts">>) {
    const msg: ChatMessage = {
      ...next,
      id: next.id ?? crypto.randomUUID(),
      ts: next.ts ?? now(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  }

  function setToolResult(messageId: string, result: unknown) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, tool: { ...m.tool!, result } } : m))
    );
  }

  function updateTimeline(id: string, patch: Partial<TimelineItem>) {
    setTimeline((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
            ...t,
            ...patch,
            ts: now(),
          }
          : t
      )
    );
  }

  function resetDemo() {
    agentSourceRef.current?.close();
    agentSourceRef.current = null;
    setRunning(false);
    setSettling(false);
    setAwaitingConfirm(false);
    setAgentSessionId(null);
    setMessages([]);
    setTimeline(startOfDemoTimeline());
    setDeal(null);
    setToolModal(null);
    setToolModalMaximized(false);
    setChatModalOpen(false);
    setCopyStatus("idle");
    setAgentHealth({ status: "idle" });
  }

  async function checkAgentHealth() {
    if (agentEngine !== "proxy") return;
    setAgentHealth({ status: "checking" });
    try {
      let healthUrl: string;
      try {
        const url = new URL(agentUpstream);
        url.search = "";
        url.pathname = "/health";
        healthUrl = url.toString();
      } catch {
        throw new Error("无效的 Agent API Endpoint。");
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4500);
      const res = await fetch(healthUrl, { signal: controller.signal });
      window.clearTimeout(timeout);

      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) throw new Error(`Health check failed (HTTP ${res.status})`);
      setAgentHealth({ status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Health check failed";
      setAgentHealth({ status: "error", message });
    }
  }

  function buildTranscript(items: ChatMessage[]) {
    const lines: string[] = [];

    lines.push("通用 AI 市场 Demo 记录");
    lines.push(`模式：${mode === "testnet" ? "测试网" : "模拟"} | 视图：${chatView === "process" ? "流程" : "对话"}`);
    lines.push(`店铺：${selectedStore.name} | 商品：${selectedProduct.name} | 价格：${selectedProduct.priceUSDC} USDC`);
    if (deal) lines.push(`dealId：${deal.dealId}`);
    lines.push("");

    let lastStage: NormalizedChatStage | null = null;
    for (const m of items) {
      const stage = normalizeChatStage(m.stage);
      if (stage !== lastStage) {
        lines.push(`\n== ${chatStageLabel(stage)} ==`);
        lastStage = stage;
      }

      const stamp = formatTime(m.ts);
      if (m.role === "tool" && m.tool) {
        lines.push(`[${stamp}] [tool] ${m.tool.name}`);
        lines.push(`args: ${stringifyForDisplay(m.tool.args, true)}`);
        lines.push(`result: ${stringifyForDisplay(m.tool.result ?? null, true)}`);
        continue;
      }

      lines.push(`[${stamp}] ${m.speaker}: ${m.content}`);
    }

    return lines.join("\n");
  }

  async function copyTranscript() {
    try {
      const text = buildTranscript(visibleChatMessages);
      await navigator.clipboard.writeText(text);
      setCopyStatus("ok");
    } catch {
      setCopyStatus("err");
    }
  }

  function renderMarketplacePanel(variant: "embedded" | "modal") {
    const isModal = variant === "modal";
    const maxHeightClass = isModal ? "max-h-[72vh]" : "max-h-[640px]";

    const storePanel = (
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-white/70">店铺</div>
          <Badge className="bg-white/5 text-white/70">{visibleStores.length}</Badge>
        </div>
        {visibleStores.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            没有匹配的店铺，试试换个关键词或切换筛选。
          </div>
        ) : (
          <div className="grid gap-2">
            {visibleStores.map((store) => (
              <button
                key={store.id}
                onClick={() => {
                  setSelectedStoreId(store.id);
                  setSelectedProductId(store.products[0].id);
                }}
                className={cn(
                  "group w-full rounded-2xl border px-3 py-3 text-left transition",
                  store.id === selectedStoreId
                    ? "border-indigo-400/30 bg-indigo-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/8"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{store.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-white/70">{store.tagline}</div>
                  </div>
                  <Badge className="bg-white/5 text-white/70">{store.sellerAgentName}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {store.verified ? (
                    <Badge className="border-emerald-300/20 bg-emerald-500/15 text-emerald-100">
                      已认证
                    </Badge>
                  ) : (
                    <Badge className="border-white/10 bg-black/15 text-white/70">未认证</Badge>
                  )}
                  <Badge className="border-white/10 bg-black/15 text-white/70">
                    评分 {store.rating.toFixed(1)}
                  </Badge>
                  <Badge className="border-white/10 bg-black/15 text-white/70">
                    订单 {formatOrders(store.orders)}
                  </Badge>
                  <Badge className="border-white/10 bg-black/15 text-white/70">
                    响应 {store.responseMins} 分钟
                  </Badge>
                  <Badge className="border-white/10 bg-black/15 text-white/70">{store.location}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {store.categories.slice(0, 4).map((c) => (
                    <Badge key={c} className="border-white/10 bg-black/15 text-white/70">
                      {c}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );

    const productPanel = (
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-white/70">商品</div>
          <Badge className="bg-white/5 text-white/70">{visibleProducts.length}</Badge>
        </div>
        {visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            这个店铺没有匹配的商品，试试换个关键词或切换筛选。
          </div>
        ) : (
          <div className="grid gap-2">
            {visibleProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={cn(
                  "w-full rounded-2xl border px-3 py-3 text-left transition",
                  p.id === selectedProductId
                    ? "border-emerald-400/25 bg-emerald-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/8"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <Badge className="bg-white/5 text-white/75">{p.priceUSDC} USDC</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70">
                  <span>
                    {kindLabel(p.kind)} | Token #{p.tokenId}
                  </span>
                  <Badge className="border-white/10 bg-black/15 text-white/70">
                    {inventoryLabel(p.inventory)}
                  </Badge>
                  <Badge className="border-white/10 bg-black/15 text-white/70">{p.leadTime}</Badge>
                  {p.demoReady ? (
                    <Badge className="border-emerald-300/20 bg-emerald-500/15 text-emerald-100">
                      可上链
                    </Badge>
                  ) : (
                    <Badge className="border-white/10 bg-black/15 text-white/70">模拟</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );

    const selectedProductPanel = (
      <Card className="border-white/10 bg-black/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-white/75" />
            当前商品
          </CardTitle>
          <CardDescription>{selectedProduct.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-indigo-500/12 text-indigo-100 border-indigo-300/20">
              {selectedProduct.kind === "physical" ? "收据 NFT" : "NFT 交付"}
            </Badge>
            <Badge className="bg-white/5 text-white/75">Token #{selectedProduct.tokenId}</Badge>
            <Badge className="bg-white/5 text-white/75">{selectedProduct.priceUSDC} USDC</Badge>
            <Badge className="bg-white/5 text-white/75">{inventoryLabel(selectedProduct.inventory)}</Badge>
            {selectedProduct.demoReady ? (
              <Badge className="border-emerald-300/20 bg-emerald-500/15 text-emerald-100">可上链</Badge>
            ) : (
              <Badge className="bg-white/5 text-white/75">模拟</Badge>
            )}
          </div>
          <div className="text-xs text-white/70">{selectedProduct.leadTime}</div>
          <div className="flex flex-wrap gap-1.5">
            {selectedProduct.tags.slice(0, 8).map((tag) => (
              <Badge key={tag} className="border-white/10 bg-black/15 text-white/70">
                {tag}
              </Badge>
            ))}
          </div>
          {liveOnchain && !selectedProduct.demoReady ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100">
              提示：测试网实盘建议选择标记为「可上链」的商品（否则请切换到「模拟」模式）。
            </div>
          ) : null}
          <ul className="space-y-1 text-sm text-white/75">
            {selectedProduct.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-300/70" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );

    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <StoreIcon className="h-4 w-4 text-white/80" />
                电商市场
              </CardTitle>
              <CardDescription>店铺、商品与交付方式。</CardDescription>
            </div>
            {!isModal ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMarketModalOpen(true)}
                title="弹出查看市场"
              >
                <Maximize2 className="h-4 w-4" />
                弹出
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-4 overflow-auto", maxHeightClass)}>
          <div className="grid gap-2">
            <Input
              value={marketQuery}
              onChange={(e) => setMarketQuery(e.target.value)}
              placeholder="搜索店铺 / 商品 / 标签..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={marketKind === "all" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setMarketKind("all")}
              >
                全部
              </Button>
              <Button
                variant={marketKind === "digital" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setMarketKind("digital")}
              >
                数字商品
              </Button>
              <Button
                variant={marketKind === "physical" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setMarketKind("physical")}
              >
                实物
              </Button>
              <Badge className="bg-white/5 text-white/70">匹配店铺 {visibleStores.length}</Badge>
            </div>
          </div>

          {isModal ? (
            <div className="grid gap-4 md:grid-cols-[320px_1fr]">
              <div className="space-y-4">{storePanel}</div>
              <div className="space-y-4">
                {productPanel}
                {selectedProductPanel}
              </div>
            </div>
          ) : (
            <>
              {storePanel}
              {productPanel}
              {selectedProductPanel}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  async function runBuyerAgent() {
    if (running || settling) return;

    agentSourceRef.current?.close();
    agentSourceRef.current = null;

    setAgentSessionId(null);
    setAwaitingConfirm(false);
    setRunning(true);
    setSettling(false);
    setDeal(null);
    setTimeline(startOfDemoTimeline());
    setMessages([]);
    setCopyStatus("idle");

    const qs = new URLSearchParams();
    qs.set("engine", agentEngine);
    qs.set("mode", mode);
    qs.set("checkoutMode", checkoutMode);
    qs.set("goal", goal);
    if (buyerNote.trim()) qs.set("buyerNote", buyerNote.trim());
    if (agentEngine === "proxy" && agentUpstream.trim()) qs.set("upstream", agentUpstream.trim());

    const source = new EventSource(`/api/agent/stream?${qs.toString()}`);
    agentSourceRef.current = source;

    const close = () => {
      source.close();
      if (agentSourceRef.current === source) agentSourceRef.current = null;
    };

    const fail = (message?: string) => {
      if (message) {
        pushMessage({
          role: "system",
          stage: "settle",
          speaker: "系统",
          content: message,
        });
      }
      setRunning(false);
      setSettling(false);
      setAwaitingConfirm(false);
      close();
    };

    source.addEventListener("state", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as Partial<{
          selectedStoreId: string;
          selectedProductId: string;
          deal: unknown;
          running: boolean;
          settling: boolean;
          awaitingConfirm: boolean;
          sessionId: string;
        }>;

        if (typeof data.sessionId === "string" && data.sessionId) setAgentSessionId(data.sessionId);
        if (typeof data.selectedStoreId === "string") setSelectedStoreId(data.selectedStoreId);
        if (typeof data.selectedProductId === "string") setSelectedProductId(data.selectedProductId);
        if ("deal" in data) {
          const parsed = data.deal === null ? null : parseSerializedDeal(data.deal);
          setDeal(parsed);
        }
        if (typeof data.running === "boolean") setRunning(data.running);
        if (typeof data.settling === "boolean") setSettling(data.settling);
        if (typeof data.awaitingConfirm === "boolean") setAwaitingConfirm(data.awaitingConfirm);
      } catch {
        // ignore
      }
    });

    source.addEventListener("timeline_step", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as Partial<TimelineItem> & { id: string };
        updateTimeline(data.id, data);
      } catch {
        // ignore
      }
    });

    source.addEventListener("message", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          id: string;
          role: "buyer" | "seller" | "system";
          stage: ChatStage;
          speaker: string;
          content: string;
          ts: number;
        };
        pushMessage({
          id: data.id,
          ts: data.ts,
          role: data.role,
          stage: data.stage,
          speaker: data.speaker,
          content: data.content,
        });
      } catch {
        // ignore
      }
    });

    source.addEventListener("tool_call", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          id: string;
          stage: ChatStage;
          name: string;
          args: unknown;
          ts: number;
        };
        setMessages((prev) => [
          ...prev,
          {
            id: data.id,
            role: "tool",
            stage: data.stage,
            speaker: "tool",
            content: "",
            ts: data.ts,
            tool: { name: data.name, args: data.args },
          },
        ]);
      } catch {
        // ignore
      }
    });

    source.addEventListener("tool_result", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as { id: string; result: unknown };
        setToolResult(data.id, data.result);
      } catch {
        // ignore
      }
    });

    source.addEventListener("done", () => {
      close();
      setRunning(false);
      setSettling(false);
      setAwaitingConfirm(false);
    });

    source.addEventListener("error", (evt) => {
      const raw = (evt as MessageEvent).data;
      if (!raw) {
        fail("Agent 事件流连接中断。");
        return;
      }
      try {
        const data = JSON.parse(raw) as { message?: string };
        fail(data.message || "Agent 执行失败。");
      } catch {
        fail(typeof raw === "string" ? raw : "Agent 执行失败。");
      }
    });
  }

  async function confirmSettlement() {
    if (!agentSessionId || !awaitingConfirm || settling || running) return;
    try {
      const actionUrl =
        agentEngine === "proxy"
          ? (() => {
            try {
              const url = new URL(agentUpstream);
              url.search = "";
              url.pathname = "/api/agent/action";
              return url.toString();
            } catch {
              return null;
            }
          })()
          : "/api/agent/action";

      if (!actionUrl) throw new Error("无效的 Agent API Endpoint，请检查控制台配置。");

      const res = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: agentSessionId, action: "confirm_settlement" }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) throw new Error("确认失败，请重试。");
      setAwaitingConfirm(false);
      setSettling(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "确认失败，请重试。";
      pushMessage({ role: "system", stage: "settle", speaker: "系统", content: message });
      setAwaitingConfirm(true);
    }
  }

  function confirmStart() {
    setAwaitingConfirm(false);
    runBuyerAgent();
  }

  const headerBadges = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className="bg-indigo-500/15 text-indigo-100 border-indigo-300/20">
        Base Sepolia（付款）
      </Badge>
      <Badge className="bg-fuchsia-500/15 text-fuchsia-100 border-fuchsia-300/20">
        Zeta Athens（编排）
      </Badge>
      <Badge className="bg-emerald-500/15 text-emerald-100 border-emerald-300/20">
        Polygon Amoy（交付）
      </Badge>
    </div>
  );

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500/30 text-foreground pb-12">
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <StoreIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white/90">
                Universal AI Market
              </h1>
              <div className="text-xs font-medium text-white/50">
                Agent-to-Agent Commerce Protocol
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMarketModalOpen(true)}
              className="glass-panel hover:bg-white/10"
            >
              <StoreIcon className="mr-2 h-4 w-4" />
              浏览市场
            </Button>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2 rounded-lg glass-panel px-3 py-1.5 text-xs text-white/60">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  liveOnchain ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-amber-400"
                )}
              />
              {liveOnchain ? "Testnet Connected" : "Simulation Mode"}
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* LEFT COLUMN: Config & Control (3 cols) */}
          <div className="space-y-6 lg:col-span-3">
            <Card className="glass-panel border-white/5 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-indigo-100/90 flex items-center gap-2">
                  <Command className="h-4 w-4" />
                  控制台
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    演示模式
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMode("testnet")}
                      disabled={!configReady}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                        mode === "testnet"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "border-white/5 bg-white/5 text-white/50 hover:bg-white/10",
                        !configReady && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <ZapIcon className="h-3.5 w-3.5" />
                      测试网
                    </button>
                    <button
                      onClick={() => setMode("simulate")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                        mode === "simulate"
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                          : "border-white/5 bg-white/5 text-white/50 hover:bg-white/10"
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      模拟
                    </button>
                  </div>
                  {!configReady && (
                    <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] text-amber-200/80 border border-amber-500/20">
                      缺少环境变量配置，仅支持模拟模式。
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    Agent 引擎
                  </label>
                  <div className="flex rounded-lg bg-black/20 p-1">
                    {(["builtin", "proxy"] as const).map((e) => (
                      <button
                        key={e}
                        onClick={() => setAgentEngine(e)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                          agentEngine === e
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-white/40 hover:text-white/60"
                        )}
                      >
                        {e === "builtin" ? "内置逻辑" : "API 代理"}
                      </button>
                    ))}
                  </div>
                </div>

                {agentEngine === "proxy" && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/50">API Endpoint</label>
                    <div className="flex gap-2">
                      <Input
                        value={agentUpstream}
                        onChange={(e) => setAgentUpstream(e.target.value)}
                        className="h-8 text-xs font-mono bg-black/20 border-white/5"
                      />
                      <Button
                        variant="secondary"
                        className="h-8 px-3 glass-panel text-white/70 shrink-0 whitespace-nowrap min-w-14"
                        onClick={checkAgentHealth}
                        disabled={agentHealth.status === "checking"}
                        title="请求 Agent 服务的 /health"
                      >
                        {agentHealth.status === "checking" ? "检测中" : "检测"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/45">
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          agentHealth.status === "ok"
                            ? "bg-emerald-400"
                            : agentHealth.status === "error"
                              ? "bg-rose-400"
                              : agentHealth.status === "checking"
                                ? "bg-amber-400 animate-pulse"
                                : "bg-white/20"
                        )}
                      />
                      {agentHealth.status === "ok"
                        ? "Agent 服务可用"
                        : agentHealth.status === "error"
                          ? `不可用：${agentHealth.message ?? "未知错误"}`
                          : agentHealth.status === "checking"
                            ? "正在检查..."
                            : "未检查"}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    结算模式
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCheckoutMode("auto")}
                      disabled={running || settling}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                        checkoutMode === "auto"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "border-white/5 bg-white/5 text-white/50 hover:bg-white/10",
                        (running || settling) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Coins className="h-3.5 w-3.5" />
                      全自动
                    </button>
                    <button
                      onClick={() => setCheckoutMode("confirm")}
                      disabled={running || settling}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                        checkoutMode === "confirm"
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                          : "border-white/5 bg-white/5 text-white/50 hover:bg-white/10",
                        (running || settling) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Bot className="h-3.5 w-3.5" />
                      手动确认
                    </button>
                  </div>
                  <div className="text-[10px] leading-relaxed text-white/45">
                    全自动：Agent 自动发起跨链结算。手动确认：生成 Deal 后需要你点击“发起结算”继续。
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <Button
                    variant="danger"
                    className="w-full h-8 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/20"
                    onClick={resetDemo}
                  >
                    <RotateCcw className="mr-2 h-3 w-3" />
                    重置所有状态
                  </Button>
                </div>
              </CardContent>
            </Card>

              <Card className="glass-panel border-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-indigo-100/90 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    当前目标
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-white/60">
                      <Bot className="h-3.5 w-3.5 text-indigo-300" />
                      买家 Agent 任务
                    </div>
                    <Textarea
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      className="min-h-[80px] border-0 bg-transparent p-0 text-sm leading-relaxed text-white/90 focus-visible:ring-0 resize-none"
                    />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-white/60">
                      <MessageSquareText className="h-3.5 w-3.5 text-white/60" />
                      补充说明（可选）
                    </div>
                    <Textarea
                      value={buyerNote}
                      onChange={(e) => setBuyerNote(e.target.value)}
                      placeholder="例如：更偏好可立即交付/需要发票/希望卖家承诺 24h 内发货…"
                      className="min-h-[64px] border-0 bg-transparent p-0 text-sm leading-relaxed text-white/80 placeholder:text-white/30 focus-visible:ring-0 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <div className={cn("h-1.5 w-1.5 rounded-full", running ? "bg-emerald-400 animate-pulse" : "bg-white/20")} />
                    Status: {running ? "Running" : "Idle"}
                  </div>
                </CardContent>
              </Card>
          </div>

          {/* MIDDLE COLUMN: Main Interaction (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-6 h-[calc(100vh-8rem)] min-h-[600px]">
            <Card className="flex-1 flex flex-col glass-panel overflow-hidden border-indigo-500/10 shadow-[0_0_50px_-10px_rgba(99,102,241,0.05)]">
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200">
                    {chatStageLabel(normalizeChatStage(messages[messages.length - 1]?.stage))}
                  </Badge>
                  <div className="text-sm text-white/60">
                    {messages.length} 消息
                  </div>
                  <div className="hidden xl:flex items-center gap-2 text-[11px] text-white/55">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-black/20 px-2 py-1 border border-white/5">
                      <Bot className="h-3.5 w-3.5 text-indigo-200/80" />
                      买家：
                      {config.accounts?.buyer ? formatAddress(config.accounts.buyer) : "买家 Agent"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-black/20 px-2 py-1 border border-white/5">
                      <StoreIcon className="h-3.5 w-3.5 text-emerald-200/80" />
                      卖家：{selectedStore.name}
                      {config.accounts?.seller ? ` (${formatAddress(config.accounts.seller)})` : " 卖家 Agent"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-black/20 p-0.5">
                  <button
                    onClick={() => setChatView("process")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                      chatView === "process" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    过程
                  </button>
                  <button
                    onClick={() => setChatView("dialogue")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                      chatView === "dialogue" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    对话
                  </button>
                </div>
              </div>

              {/* Chat Content */}
              <div className="relative flex-1 overflow-hidden bg-black/10">
                <div
                  ref={chatScrollEmbeddedRef}
                  className="absolute inset-0 overflow-y-auto p-4 space-y-6 scroll-smooth"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {visibleChatMessages.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex h-full flex-col items-center justify-center text-center p-8"
                      >
                        <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10 mb-6">
                          <Sparkles className="h-10 w-10 text-indigo-300/80" />
                        </div>
                        <h3 className="text-lg font-medium text-white/90">准备就绪</h3>
                        <p className="mt-2 text-sm text-white/50 max-w-xs">
                          点击下方按钮启动买家 Agent，它将自主浏览市场并完成交易。
                        </p>
                      </motion.div>
                    ) : (
                      <div className="space-y-4">
                        {chatRows.map((row) => (
                          row.kind === 'stage' ? (
                            <div key={row.id} className="flex justify-center py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md flex items-center gap-1.5",
                                chatStageBadgeClass(row.stage)
                              )}>
                                {chatStageIcon(row.stage)}
                                {chatStageLabel(row.stage)}
                              </span>
                            </div>
                          ) : (
                            <motion.div
                              key={row.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "flex gap-3 max-w-[90%]",
                                row.message.role === 'buyer' ? "ml-auto flex-row-reverse" : ""
                              )}
                            >
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
                                row.message.role === 'buyer' ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-200" :
                                  row.message.role === 'seller' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-200" :
                                    "bg-white/5 border-white/10 text-white/50"
                              )}>
                                {row.message.role === 'buyer' ? <Bot className="h-4 w-4" /> :
                                  row.message.role === 'seller' ? <StoreIcon className="h-4 w-4" /> :
                                    <Command className="h-4 w-4" />}
                              </div>
                              <div className={cn(
                                "rounded-2xl p-3 text-sm leading-relaxed border break-words",
                                row.message.role === 'buyer' ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-100 rounded-tr-sm" :
                                  row.message.role === 'seller' ? "bg-emerald-600/10 border-emerald-500/20 text-emerald-100 rounded-tl-sm" :
                                    "bg-white/5 border-white/10 text-white/70 font-mono text-xs w-full"
                              )}>
                                {row.message.role === 'tool' && row.message.tool ? (
                                  <div
                                    className="space-y-2 cursor-pointer group"
                                    onClick={() => {
                                      setToolModal({
                                        name: row.message.tool!.name,
                                        ts: row.message.ts,
                                        stage: row.message.stage,
                                        args: row.message.tool!.args,
                                        result: row.message.tool!.result,
                                      });
                                    }}
                                  >
                                    <div className="flex items-center justify-between text-xs opacity-70 border-b border-white/5 pb-1 mb-1">
                                      <span className="font-bold">{row.message.tool.name}</span>
                                      <Maximize2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="opacity-80 line-clamp-3">
                                      Input: {stringifyForDisplay(row.message.tool.args, false)}
                                    </div>
                                    <div className="opacity-60 text-[10px] mt-1 text-emerald-300">
                                      Result: {row.message.tool.result ? "Success" : "Pending..."}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] text-white/50">
                                      <span className="font-semibold">{row.message.speaker}</span>
                                      <span className="font-mono">{formatTime(row.message.ts)}</span>
                                    </div>
                                    <div>{row.message.content}</div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Chat Footer */}
              <div className="p-4 bg-white/[0.02] border-t border-white/5">
                {running ? (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 glass-panel text-white/70"
                      onClick={resetDemo}
                    >
                      中止
                    </Button>
                    <div className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-sm font-medium animate-pulse">
                      <CircleDashed className="h-4 w-4 animate-spin" />
                      Running...
                    </div>
                  </div>
                ) : settling ? (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 glass-panel text-white/70"
                      onClick={resetDemo}
                    >
                      中止
                    </Button>
                    <div className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 text-sm font-medium animate-pulse">
                      <CircleDashed className="h-4 w-4 animate-spin" />
                      结算中...
                    </div>
                  </div>
                ) : awaitingConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      disabled={!agentSessionId}
                      onClick={confirmSettlement}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.2)] border-0 disabled:opacity-60"
                    >
                      <Coins className="mr-2 h-5 w-5" />
                      发起结算
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="glass-panel text-white/70"
                      onClick={resetDemo}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.25)] border-0"
                    onClick={() => !running && confirmStart()}
                  >
                    <ZapIcon className="mr-2 h-5 w-5 fill-current" />
                    启动 AI 代理交易
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN: Timeline & Status (3 cols) */}
          <div className="space-y-6 lg:col-span-3">
            <Card className="glass-panel border-white/5 h-full max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-base font-medium text-indigo-100/90 flex items-center gap-2">
                  <Cable className="h-4 w-4" />
                  跨链时间线
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-4 pr-1 pt-1">
                {timeline.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "relative pl-6 pb-6 last:pb-0 border-l transition-colors duration-500",
                      item.status === 'done' ? "border-emerald-500/30" :
                        item.status === 'running' ? "border-indigo-500/50" : "border-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full ring-4 ring-black",
                      item.status === 'done' ? "bg-emerald-400" :
                        item.status === 'running' ? "bg-indigo-400 animate-pulse" :
                          item.status === 'error' ? "bg-rose-400" : "bg-white/20"
                    )} />

                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        item.status === 'idle' ? "text-white/40" : "text-white/90"
                      )}>
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1 bg-white/5">
                          {chainIcon(item.chain)}
                          {chainLabel(item.chain)}
                        </Badge>
                        {item.txHash && (
                          <a href="#" className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline font-mono">
                            {item.txHash.slice(0, 8)}...
                          </a>
                        )}
                      </div>
                      {item.detail && (
                        <div className="text-xs text-white/50 bg-white/5 rounded p-1.5 mt-1 border border-white/5">
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Modals and Overlays */}
      {/* ... existing modal code (MarketModal, ToolModal) ... */}
      <AnimatePresence>
        {chatModalOpen ? (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setChatModalOpen(false);
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {marketModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMarketModalOpen(false);
            }}
          >
            <div className="flex h-full w-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-6xl max-h-[85vh] flex flex-col glass-panel overflow-hidden border-white/10 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2 p-4 border-b border-white/10 bg-white/5">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="h-5 w-5 text-indigo-300" />
                    <div className="text-sm font-medium text-white/90">Universal Market</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setMarketModalOpen(false)}>
                    <X className="h-4 w-4" />
                    关闭
                  </Button>
                </div>
                <div className="overflow-hidden flex-1 p-0 bg-black/40">
                  {renderMarketplacePanel("modal")}
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toolModal ? (
          <motion.div
            key="tool-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setToolModal(null);
                setToolModalMaximized(false);
              }
            }}
          >
            <div className="flex h-full w-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "w-full glass-panel border-white/10 shadow-2xl overflow-hidden",
                  toolModalMaximized ? "max-w-[95vw] h-[90vh]" : "max-w-4xl"
                )}
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                  <div className="flex items-center gap-2">
                    <Command className="h-5 w-5 text-indigo-300" />
                    <span className="font-mono text-sm font-medium">{toolModal.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setToolModalMaximized((v) => !v)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setToolModal(null);
                        setToolModalMaximized(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                      关闭
                    </Button>
                  </div>
                </div>
                <div className="p-4 grid gap-4 md:grid-cols-2 flex-1 overflow-auto bg-black/40">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-white/70">输入（args）</div>
                    <pre
                      className={cn(
                        "overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-white/80 whitespace-pre-wrap break-all border border-white/5",
                        toolModalMaximized ? "max-h-[70vh]" : "max-h-[55vh]"
                      )}
                    >
                      {stringifyForDisplay(toolModal.args, true)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-white/70">输出（result）</div>
                    <pre
                      className={cn(
                        "overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-white/80 whitespace-pre-wrap break-all border border-white/5",
                        toolModalMaximized ? "max-h-[70vh]" : "max-h-[55vh]"
                      )}
                    >
                      {stringifyForDisplay(toolModal.result ?? null, true)}
                    </pre>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
