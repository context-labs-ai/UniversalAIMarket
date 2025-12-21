"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AgentContext,
  type AgentState,
  type AgentConnectionStatus,
  type ChatMessage,
  type SerializedDeal,
  type TimelineStatus,
  type ChatRole,
  type ChatStage,
  type DemoMode,
  type CheckoutMode,
  type AgentEngine,
  type AgentScenario,
  type SellerChat,
  type DealItem,
  type DealItemStatus,
  type BuyerConfig,
  type LLMConfig,
} from "@/lib/agentContext";
import { ethers } from "ethers";
import { createInitialTimeline, updateTimelineStep } from "@/lib/agentTimeline";

interface AgentProviderProps {
  children: ReactNode;
}

const DEFAULT_UPSTREAM = (process.env.NEXT_PUBLIC_AGENT_UPSTREAM || "http://localhost:8080/api/agent/stream").trim();
const DEFAULT_ENGINE: AgentEngine = "builtin"; // Default to builtin Agent Hub (8080)
const DEFAULT_SCENARIO: AgentScenario =
  (process.env.NEXT_PUBLIC_AGENT_SCENARIO || "").trim() === "multi" ? "multi" : "single";

const INITIAL_STATE: AgentState = {
  connectionStatus: "disconnected",
  sessionId: null,
  sessionToken: null,
  discovery: null,
  isExpanded: false,
  isChatExpanded: true,
  demoMode: "testnet", // Default to testnet for real transactions
  checkoutMode: "confirm",
  agentEngine: DEFAULT_ENGINE,
  agentUpstream: DEFAULT_UPSTREAM,
  scenario: DEFAULT_SCENARIO,
  selectedStoreId: null,
  selectedProductId: null,
  awaitingConfirm: false,
  settling: false,
  timeline: createInitialTimeline(),
  messages: [],
  sellerChats: [],
  dealItems: [],
  deal: null,
  buyerConfig: null,
  llmConfig: null,
  errorMessage: null,
};

function isSerializedDeal(value: unknown): value is SerializedDeal {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.dealId === "string" &&
    typeof obj.buyer === "string" &&
    typeof obj.sellerBase === "string" &&
    typeof obj.polygonEscrow === "string" &&
    typeof obj.nft === "string" &&
    typeof obj.tokenId === "string" &&
    typeof obj.price === "string" &&
    typeof obj.deadline === "string"
  );
}

export function AgentProvider({ children }: AgentProviderProps) {
  const [state, setState] = useState<AgentState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const aguiMessageBuffersRef = useRef<Record<string, { raw?: unknown; content: string }>>({});

  const fetchDiscovery = useCallback(async (signal: AbortSignal) => {
    const res = await fetch("/.well-known/universal-ai-market.json", { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Discovery error: HTTP ${res.status}`);
    return res.json();
  }, []);

  // === State update helpers ===
  const setConnectionStatus = useCallback((status: AgentConnectionStatus) => {
    setState((s) => ({ ...s, connectionStatus: status }));
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState((s) => ({ ...s, messages: [...s.messages, message] }));
  }, []);

  // Add message to a specific seller's chat (creates chat if not exists)
  const addMessageToSellerChat = useCallback((
    message: ChatMessage,
    sellerInfo: {
      sellerId: string;
      sellerName: string;
      storeId: string;
      storeName: string;
      productId: string;
      productName: string;
      priceUSDC: string;
    }
  ) => {
    setState((s) => {
      const existingChatIndex = s.sellerChats.findIndex(
        (c) => c.storeId === sellerInfo.storeId && c.productId === sellerInfo.productId
      );

      if (existingChatIndex >= 0) {
        // Update existing chat - also update price if provided
        const updatedChats = [...s.sellerChats];
        updatedChats[existingChatIndex] = {
          ...updatedChats[existingChatIndex],
          messages: [...updatedChats[existingChatIndex].messages, message],
          // Update price with the latest price from message
          priceUSDC: sellerInfo.priceUSDC || updatedChats[existingChatIndex].priceUSDC,
        };
        return { ...s, sellerChats: updatedChats };
      } else {
        // Create new chat for this seller/product
        const newChat: SellerChat = {
          sellerId: sellerInfo.sellerId,
          sellerName: sellerInfo.sellerName,
          storeId: sellerInfo.storeId,
          storeName: sellerInfo.storeName,
          productId: sellerInfo.productId,
          productName: sellerInfo.productName,
          priceUSDC: sellerInfo.priceUSDC,
          messages: [message],
          status: "negotiating",
        };
        return { ...s, sellerChats: [...s.sellerChats, newChat] };
      }
    });
  }, []);

  // Update seller chat status
  const updateSellerChatStatus = useCallback((
    storeId: string,
    productId: string,
    status: "negotiating" | "agreed" | "settled" | "failed" | "cancelled",
    deal?: SerializedDeal,
    priceUSDC?: string
  ) => {
    setState((s) => {
      const updatedChats = s.sellerChats.map((c) =>
        c.storeId === storeId && c.productId === productId
          ? { ...c, status, deal, ...(priceUSDC ? { priceUSDC } : {}) }
          : c
      );
      return { ...s, sellerChats: updatedChats };
    });
  }, []);

  // Add deal item
  const addDealItem = useCallback((dealItem: DealItem) => {
    setState((s) => {
      // Avoid duplicates
      const exists = s.dealItems.some((d) => d.id === dealItem.id);
      if (exists) return s;
      return { ...s, dealItems: [...s.dealItems, dealItem] };
    });
  }, []);

  // Update deal item status
  const updateDealItemStatus = useCallback((dealId: string, status: DealItemStatus, error?: string) => {
    setState((s) => ({
      ...s,
      dealItems: s.dealItems.map((d) =>
        d.id === dealId ? { ...d, status, error } : d
      ),
    }));
  }, []);

  const setError = useCallback((errorMessage: string | null) => {
    setState((s) => ({ ...s, errorMessage }));
  }, []);

  const handleSseEvent = useCallback((eventName: string, rawData: string) => {
    try {
      const data = JSON.parse(rawData);

      switch (eventName) {
        case "state": {
          setState((s) => {
            const newState = { ...s };
            if (data.sessionId) newState.sessionId = data.sessionId;
            if (data.selectedStoreId) newState.selectedStoreId = data.selectedStoreId;
            if (data.selectedProductId) newState.selectedProductId = data.selectedProductId;
            if (data.deal !== undefined) newState.deal = data.deal;
            if (typeof data.awaitingConfirm === "boolean") newState.awaitingConfirm = data.awaitingConfirm;
            if (typeof data.settling === "boolean") newState.settling = data.settling;
            if (typeof data.running === "boolean" && data.running) newState.connectionStatus = "running";
            return newState;
          });
          break;
        }

        case "timeline_step": {
          const step = data as {
            id: string;
            status?: TimelineStatus;
            detail?: string;
            txHash?: string;
          };
          setState((s) => ({
            ...s,
            timeline: updateTimelineStep(s.timeline, step.id, {
              status: step.status,
              detail: step.detail,
              txHash: step.txHash,
            }),
          }));
          break;
        }

        case "message": {
          const msg = data as {
            id: string;
            role: ChatRole;
            stage: ChatStage;
            speaker: string;
            content: string;
            ts: number;
            // New fields for seller grouping
            sellerId?: string;
            storeId?: string;
            storeName?: string;
            productId?: string;
            productName?: string;
            priceUSDC?: string;
          };

          const chatMessage: ChatMessage = {
            id: msg.id,
            role: msg.role,
            stage: msg.stage,
            speaker: msg.speaker,
            content: msg.content,
            ts: msg.ts,
          };

          // Add to general messages
          addMessage(chatMessage);

          // If message has seller info (negotiate stage), also add to seller chat
          if (msg.storeId && msg.productId && msg.stage === "negotiate") {
            addMessageToSellerChat(chatMessage, {
              sellerId: msg.sellerId || msg.storeId,
              sellerName: msg.speaker,
              storeId: msg.storeId,
              storeName: msg.storeName || msg.storeId,
              productId: msg.productId,
              productName: msg.productName || "Product",
              priceUSDC: msg.priceUSDC || "0",
            });
          }
          break;
        }

        case "deal_proposal": {
          // New event for deal proposals from negotiations
          const proposal = data as {
            id: string;
            storeId: string;
            storeName: string;
            productId: string;
            productName: string;
            priceUSDC: string;
            status: "pending" | "failed" | "cancelled";
            reason?: string; // e.g., "over_budget", "negotiation_failed"
            deal?: SerializedDeal;
          };

          // Map deal status to seller chat status
          let chatStatus: "agreed" | "failed" | "cancelled" = "failed";
          if (proposal.status === "pending") {
            chatStatus = "agreed";
          } else if (proposal.status === "cancelled" || proposal.reason === "over_budget") {
            chatStatus = "cancelled";
          }

          // Update seller chat status with final price
          updateSellerChatStatus(
            proposal.storeId,
            proposal.productId,
            chatStatus,
            proposal.deal,
            proposal.priceUSDC
          );

          // Add to deal items list
          addDealItem({
            id: proposal.id,
            storeId: proposal.storeId,
            storeName: proposal.storeName,
            productId: proposal.productId,
            productName: proposal.productName,
            priceUSDC: proposal.priceUSDC,
            status: proposal.status === "cancelled" ? "failed" : proposal.status,
            deal: proposal.deal,
            error: proposal.reason === "over_budget" ? "价格超出预算" : undefined,
          });
          break;
        }

        case "tool_call": {
          const tool = data as {
            id: string;
            stage: ChatStage;
            name: string;
            args: unknown;
            ts: number;
          };
          addMessage({
            id: tool.id,
            role: "tool",
            stage: tool.stage,
            speaker: "Tool",
            content: `调用工具: ${tool.name}`,
            ts: tool.ts,
            tool: {
              name: tool.name,
              args: tool.args,
            },
          });
          break;
        }

        case "tool_result": {
          const result = data as {
            id: string;
            result: unknown;
            ts: number;
          };
          setState((s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === result.id && m.tool ? { ...m, tool: { ...m.tool, result: result.result } } : m
            ),
          }));
          break;
        }

        case "settlement_complete": {
          // Settlement completed for a deal
          const settlement = data as {
            storeId: string;
            productId: string;
            dealId?: string;
            txHash?: string;
          };

          // Update seller chat status to settled
          updateSellerChatStatus(
            settlement.storeId,
            settlement.productId,
            "settled"
          );

          // Update deal item status to completed
          if (settlement.dealId) {
            updateDealItemStatus(settlement.dealId, "completed");
          }
          break;
        }

        case "done": {
          // Safety: mark all running steps as done when stream completes
          // This handles cases where timeline_step events were lost due to network issues
          setState((s) => ({
            ...s,
            connectionStatus: "completed",
            timeline: s.timeline.map((step) =>
              step.status === "running"
                ? { ...step, status: "done" as const, detail: step.detail || "完成" }
                : step
            ),
          }));
          break;
        }

        case "error": {
          const error = data as { message: string } | string;
          const message = typeof error === "string" ? error : error.message;
          setError(message);
          setConnectionStatus("error");
          break;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, [addMessage, addMessageToSellerChat, updateSellerChatStatus, addDealItem, updateDealItemStatus, setConnectionStatus, setError]);

  const handleAguiEvent = useCallback(
    (event: unknown) => {
      if (!event || typeof event !== "object") return;
      const evt = event as Record<string, unknown>;
      const type = typeof evt.type === "string" ? evt.type : "";

      if (type === "STATE_SNAPSHOT") {
        const snapshotRaw = evt.snapshot;
        if (!snapshotRaw || typeof snapshotRaw !== "object") return;
        const snapshot = snapshotRaw as Record<string, unknown>;

        setState((s) => {
          const newState = { ...s };

          const sessionId = snapshot.sessionId;
          if (typeof sessionId === "string" && sessionId) newState.sessionId = sessionId;

          const selectedStoreId = snapshot.selectedStoreId;
          if (typeof selectedStoreId === "string") newState.selectedStoreId = selectedStoreId;

          const selectedProductId = snapshot.selectedProductId;
          if (typeof selectedProductId === "string") newState.selectedProductId = selectedProductId;

          if ("deal" in snapshot) {
            const deal = snapshot.deal;
            if (deal === null) newState.deal = null;
            else if (isSerializedDeal(deal)) newState.deal = deal;
          }

          const awaitingConfirm = snapshot.awaitingConfirm;
          if (typeof awaitingConfirm === "boolean") newState.awaitingConfirm = awaitingConfirm;

          const settling = snapshot.settling;
          if (typeof settling === "boolean") newState.settling = settling;

          const running = snapshot.running;
          if (running === true) newState.connectionStatus = "running";
          return newState;
        });
        return;
      }

      if (type === "CUSTOM") {
        const name = typeof evt.name === "string" ? evt.name : "";
        const valueRaw = evt.value;
        if (!valueRaw || typeof valueRaw !== "object") return;
        const value = valueRaw as Record<string, unknown>;

        if (name === "universal_market.timeline_step") {
          const stepId = typeof value.id === "string" ? value.id : "";
          if (!stepId) return;

          const statusRaw = value.status;
          const status: TimelineStatus | undefined =
            statusRaw === "idle" || statusRaw === "running" || statusRaw === "done" || statusRaw === "error"
              ? (statusRaw as TimelineStatus)
              : undefined;
          const detail = typeof value.detail === "string" ? value.detail : undefined;
          const txHash = typeof value.txHash === "string" ? value.txHash : undefined;

          setState((s) => ({
            ...s,
            timeline: updateTimelineStep(s.timeline, stepId, {
              status,
              detail,
              txHash,
            }),
          }));
          return;
        }

        if (name === "universal_market.deal_proposal") {
          const proposal = value as {
            id: string;
            storeId: string;
            storeName: string;
            productId: string;
            productName: string;
            priceUSDC: string;
            status: "pending" | "failed" | "cancelled";
            reason?: string;
            deal?: SerializedDeal;
          };

          let chatStatus: "agreed" | "failed" | "cancelled" = "failed";
          if (proposal.status === "pending") {
            chatStatus = "agreed";
          } else if (proposal.status === "cancelled" || proposal.reason === "over_budget") {
            chatStatus = "cancelled";
          }

          updateSellerChatStatus(
            proposal.storeId,
            proposal.productId,
            chatStatus,
            proposal.deal,
            proposal.priceUSDC
          );

          addDealItem({
            id: proposal.id,
            storeId: proposal.storeId,
            storeName: proposal.storeName,
            productId: proposal.productId,
            productName: proposal.productName,
            priceUSDC: proposal.priceUSDC,
            status: proposal.status === "cancelled" ? "failed" : proposal.status,
            deal: proposal.deal,
            error: proposal.reason === "over_budget" ? "价格超出预算" : undefined,
          });
          return;
        }

        if (name === "universal_market.settlement_complete") {
          const settlement = value as {
            storeId: string;
            productId: string;
            dealId?: string;
            txHash?: string;
          };

          updateSellerChatStatus(
            settlement.storeId,
            settlement.productId,
            "settled"
          );

          if (settlement.dealId) {
            updateDealItemStatus(settlement.dealId, "completed");
          }
          return;
        }
        return;
      }

      if (type === "TEXT_MESSAGE_START") {
        const messageId = typeof evt.messageId === "string" ? evt.messageId : "";
        if (!messageId) return;
        aguiMessageBuffersRef.current[messageId] = { raw: evt.rawEvent, content: "" };
        return;
      }

      if (type === "TEXT_MESSAGE_CONTENT") {
        const messageId = typeof evt.messageId === "string" ? evt.messageId : "";
        if (!messageId) return;
        const buf = aguiMessageBuffersRef.current[messageId] ?? { content: "" };
        buf.content += typeof evt.delta === "string" ? evt.delta : String(evt.delta ?? "");
        if (evt.rawEvent) buf.raw = evt.rawEvent;
        aguiMessageBuffersRef.current[messageId] = buf;
        return;
      }

      if (type === "TEXT_MESSAGE_END") {
        const messageId = typeof evt.messageId === "string" ? evt.messageId : "";
        if (!messageId) return;
        const buf = aguiMessageBuffersRef.current[messageId];
        delete aguiMessageBuffersRef.current[messageId];

        const rawCandidate = buf?.raw ?? evt.rawEvent;
        const raw = rawCandidate && typeof rawCandidate === "object" ? (rawCandidate as Record<string, unknown>) : {};

        const roleRaw = raw.role;
        const role: ChatRole =
          roleRaw === "buyer" || roleRaw === "seller" || roleRaw === "tool" || roleRaw === "system"
            ? roleRaw
            : "system";

        const stageRaw = raw.stage;
        const stage: ChatStage =
          stageRaw === "browse" || stageRaw === "negotiate" || stageRaw === "prepare" || stageRaw === "settle"
            ? stageRaw
            : "browse";

        const speaker = typeof raw.speaker === "string" ? raw.speaker : "Agent";
        const ts = typeof raw.ts === "number" ? raw.ts : Date.now();
        const content = buf?.content ?? (typeof raw.content === "string" ? raw.content : String(raw.content ?? ""));
        if (!content) return;

        addMessage({
          id: messageId,
          role,
          stage,
          speaker,
          content,
          ts,
        });
        return;
      }

      if (type === "TOOL_CALL_START") {
        const toolCallId = typeof evt.toolCallId === "string" ? evt.toolCallId : "";
        const toolCallName = typeof evt.toolCallName === "string" ? evt.toolCallName : "";
        if (!toolCallId) return;

        const rawCandidate = evt.rawEvent;
        const raw = rawCandidate && typeof rawCandidate === "object" ? (rawCandidate as Record<string, unknown>) : {};

        const stageRaw = raw.stage;
        const stage: ChatStage =
          stageRaw === "browse" || stageRaw === "negotiate" || stageRaw === "prepare" || stageRaw === "settle"
            ? stageRaw
            : "settle";

        const ts = typeof raw.ts === "number" ? raw.ts : Date.now();
        const args = raw.args ?? {};

        addMessage({
          id: toolCallId,
          role: "tool",
          stage,
          speaker: "Tool",
          content: `调用工具: ${toolCallName || (typeof raw.name === "string" ? raw.name : "") || "unknown"}`,
          ts,
          tool: {
            name: toolCallName || (typeof raw.name === "string" ? raw.name : "") || "unknown",
            args,
          },
        });
        return;
      }

      if (type === "TOOL_CALL_RESULT") {
        const toolCallId = typeof evt.toolCallId === "string" ? evt.toolCallId : "";
        if (!toolCallId) return;
        const content = typeof evt.content === "string" ? evt.content : String(evt.content ?? "");
        let result: unknown = content;
        try {
          result = JSON.parse(content);
        } catch {
          // keep string
        }

        setState((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === toolCallId && m.tool ? { ...m, tool: { ...m.tool, result } } : m
          ),
        }));
        return;
      }

      if (type === "RUN_ERROR") {
        const message = typeof evt.message === "string" ? evt.message : "运行失败";
        setError(message);
        setConnectionStatus("error");
        return;
      }

      if (type === "RUN_FINISHED") {
        setConnectionStatus("completed");
      }
    },
    [addMessage, addDealItem, setConnectionStatus, setError, updateDealItemStatus, updateSellerChatStatus]
  );

  const runSseStream = useCallback(
    async (url: string, abortController: AbortController) => {
      const response = await fetch(url, {
        signal: abortController.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let eventName = "message";
      let data = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const idx = buffer.indexOf("\n");
          if (idx === -1) break;

          const lineRaw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);

          const line = lineRaw.replace(/\r$/, "");

          if (line === "") {
            if (data !== "") {
              try {
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === "object" && typeof (parsed as any).type === "string") {
                  handleAguiEvent(parsed);
                } else {
                  handleSseEvent(eventName, data);
                }
              } catch {
                handleSseEvent(eventName, data);
              }
            }
            eventName = "message";
            data = "";
            continue;
          }

          if (line.startsWith("event:")) {
            eventName = line.slice("event:".length).trim();
            continue;
          }

          if (line.startsWith("data:")) {
            data += line.slice("data:".length).trimStart();
          }
        }
      }

      setConnectionStatus("completed");
    },
    [handleAguiEvent, handleSseEvent, setConnectionStatus]
  );

  // === Actions ===
  const connect = useCallback(async (goal?: string) => {
    // Abort any existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentMode = state.demoMode;
    const currentCheckoutMode = state.checkoutMode;
    const currentEngine = state.agentEngine;
    const currentUpstream = state.agentUpstream.trim();
    const currentScenario = state.scenario;
    const currentBuyerConfig = state.buyerConfig;

    // Reset state but preserve user settings AND buyer/llm config
    setState((prev) => ({
      ...INITIAL_STATE,
      demoMode: prev.demoMode,
      checkoutMode: prev.checkoutMode,
      agentEngine: prev.agentEngine,
      agentUpstream: prev.agentUpstream,
      scenario: prev.scenario,
      buyerConfig: prev.buyerConfig, // Preserve buyer config!
      llmConfig: prev.llmConfig, // Preserve LLM config!
      isExpanded: true,
      isChatExpanded: true,
      connectionStatus: "discovering",
      timeline: updateTimelineStep(createInitialTimeline(), "discover", {
        status: "running",
        detail: "获取 discovery 信息",
      }),
    }));

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const discovery = await fetchDiscovery(abortController.signal);
      setState((s) => ({
        ...s,
        discovery,
        timeline: updateTimelineStep(s.timeline, "discover", { status: "done", detail: "已发现服务" }),
      }));
      setConnectionStatus("connected");

      setConnectionStatus("running");

      const params = new URLSearchParams();
      params.set("mode", currentMode);
      params.set("checkoutMode", currentCheckoutMode);

      // Use buyer config goal if available, otherwise use provided goal
      const effectiveGoal = currentBuyerConfig?.prompt || goal;
      if (effectiveGoal) params.set("goal", effectiveGoal);

      // Pass buyer config budget if available
      if (currentBuyerConfig?.budgetUSDC) {
        params.set("budget", currentBuyerConfig.budgetUSDC);
      }

      // Pass buyer wallet address if available
      if (currentBuyerConfig?.walletAddress) {
        params.set("buyerAddress", currentBuyerConfig.walletAddress);
      }

      // Pass negotiation strategy if available
      if (currentBuyerConfig?.strategy) {
        params.set("strategy", currentBuyerConfig.strategy);
      }

      if (currentScenario === "multi") params.set("scenario", "multi");

      // 内置模式：使用默认的 Agent Hub (8080)
      // 外置模式：使用用户自定义的 Agent URL
      if (currentEngine === "builtin") {
        // 内置模式自动使用我们配置好的 Agent Hub
        params.set("engine", "proxy");
        params.set("upstream", DEFAULT_UPSTREAM);
      } else {
        // 外置模式使用用户输入的 URL
        if (!currentUpstream) throw new Error("缺少 Agent Upstream，请在侧边栏填写 Agent API Endpoint");
        params.set("engine", "proxy");
        params.set("upstream", currentUpstream);
      }

      const url = `/api/agent/stream?${params.toString()}`;
      await runSseStream(url, abortController);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Connection was aborted, don't show error
        return;
      }
      const message = err instanceof Error ? err.message : "连接失败";
      setError(message);
      setConnectionStatus("error");
    }
  }, [
    fetchDiscovery,
    handleAguiEvent,
    handleSseEvent,
    setConnectionStatus,
    setError,
    state.agentEngine,
    state.agentUpstream,
    state.checkoutMode,
    state.demoMode,
    state.scenario,
    state.buyerConfig,
    runSseStream,
  ]);

  const watchSession = useCallback(
    async (sessionId: string) => {
      const id = sessionId.trim();
      if (!id) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state but preserve user settings
      setState((prev) => ({
        ...INITIAL_STATE,
        demoMode: prev.demoMode,
        checkoutMode: prev.checkoutMode,
        agentEngine: prev.agentEngine,
        agentUpstream: prev.agentUpstream,
        scenario: prev.scenario,
        isExpanded: true,
        isChatExpanded: true,
        connectionStatus: "discovering",
        sessionId: id,
        timeline: updateTimelineStep(createInitialTimeline(), "discover", {
          status: "running",
          detail: "获取 discovery 信息",
        }),
      }));

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const currentMode = state.demoMode;
      const upstream = state.agentUpstream.trim();

      if (!upstream) {
        setError("缺少 Agent Upstream，请在侧边栏填写 Agent API Endpoint");
        setConnectionStatus("error");
        return;
      }

      try {
        const discovery = await fetchDiscovery(abortController.signal);
        setState((s) => ({
          ...s,
          discovery,
          timeline: updateTimelineStep(s.timeline, "discover", { status: "done", detail: "已发现服务" }),
        }));
        setConnectionStatus("connected");
        setConnectionStatus("running");

        const params = new URLSearchParams();
        params.set("mode", currentMode);
        params.set("engine", "proxy");
        params.set("upstream", upstream);
        params.set("sessionId", id);

        const url = `/api/agent/stream?${params.toString()}`;
        await runSseStream(url, abortController);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "连接失败";
        setError(message);
        setConnectionStatus("error");
      }
    },
    [fetchDiscovery, runSseStream, setConnectionStatus, setError, state.agentUpstream, state.demoMode]
  );

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setConnectionStatus("disconnected");
  }, [setConnectionStatus]);

  const toggleSidebar = useCallback(() => {
    setState((s) => ({ ...s, isExpanded: !s.isExpanded }));
  }, []);

  const toggleChat = useCallback(() => {
    setState((s) => ({ ...s, isChatExpanded: !s.isChatExpanded }));
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...INITIAL_STATE,
      demoMode: prev.demoMode,
      checkoutMode: prev.checkoutMode,
      agentEngine: prev.agentEngine,
      agentUpstream: prev.agentUpstream,
      scenario: prev.scenario,
    }));
  }, []);

  const setDemoMode = useCallback((mode: DemoMode) => {
    setState((s) => ({ ...s, demoMode: mode }));
  }, []);

  const setCheckoutMode = useCallback((mode: CheckoutMode) => {
    setState((s) => ({ ...s, checkoutMode: mode }));
  }, []);

  const setAgentEngine = useCallback((engine: AgentEngine) => {
    setState((s) => ({ ...s, agentEngine: engine }));
  }, []);

  const setAgentUpstream = useCallback((upstream: string) => {
    setState((s) => ({ ...s, agentUpstream: upstream }));
  }, []);

  const setScenario = useCallback((scenario: AgentScenario) => {
    setState((s) => ({ ...s, scenario }));
  }, []);

  const setBuyerConfig = useCallback((config: BuyerConfig | null) => {
    setState((s) => ({ ...s, buyerConfig: config }));
  }, []);

  const setLLMConfig = useCallback((config: LLMConfig | null) => {
    setState((s) => ({ ...s, llmConfig: config }));
  }, []);

  // Sign a deal using the browser-side wallet (private key never leaves browser)
  const signDealWithBrowserWallet = useCallback(async (deal: SerializedDeal): Promise<string> => {
    const buyerConfig = state.buyerConfig;
    if (!buyerConfig || !buyerConfig.privateKey) {
      throw new Error("Buyer wallet not configured");
    }

    try {
      const wallet = new ethers.Wallet(buyerConfig.privateKey);

      // EIP-712 domain and types for Deal
      const domain = {
        name: "UniversalMarket",
        version: "1",
        chainId: 80002, // Polygon Amoy
        verifyingContract: deal.polygonEscrow as `0x${string}`,
      };

      const types = {
        Deal: [
          { name: "dealId", type: "bytes32" },
          { name: "buyer", type: "address" },
          { name: "sellerBase", type: "address" },
          { name: "polygonEscrow", type: "address" },
          { name: "nft", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        dealId: deal.dealId,
        buyer: deal.buyer,
        sellerBase: deal.sellerBase,
        polygonEscrow: deal.polygonEscrow,
        nft: deal.nft,
        tokenId: BigInt(deal.tokenId),
        price: BigInt(deal.price),
        deadline: BigInt(deal.deadline),
      };

      const signature = await wallet.signTypedData(domain, types, message);
      return signature;
    } catch (err) {
      throw new Error(`Failed to sign deal: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [state.buyerConfig]);

  const confirmSettlement = useCallback(async () => {
    const sessionId = state.sessionId;
    if (!sessionId || !state.awaitingConfirm) return;

    try {
      // 内置模式用默认 Agent Hub，外置模式用用户配置的 upstream
      const upstream = state.agentEngine === "builtin"
        ? DEFAULT_UPSTREAM
        : state.agentUpstream.trim();
      const res = await fetch("/api/agent/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "confirm_settlement",
          ...(upstream ? { upstream } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json().catch(() => null)) as null | { ok?: boolean; error?: string };
      if (!json?.ok) throw new Error(json?.error || "确认失败");
      setState((s) => ({ ...s, awaitingConfirm: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "确认失败";
      setError(message);
    }
  }, [setError, state.agentEngine, state.agentUpstream, state.awaitingConfirm, state.sessionId]);

  const contextValue = {
    ...state,
    connect,
    watchSession,
    disconnect,
    toggleSidebar,
    toggleChat,
    reset,
    setDemoMode,
    setCheckoutMode,
    setAgentEngine,
    setAgentUpstream,
    setScenario,
    confirmSettlement,
    setBuyerConfig,
    signDealWithBrowserWallet,
    setLLMConfig,
  };

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  );
}
