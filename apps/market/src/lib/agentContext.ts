"use client";

import { createContext, useContext } from "react";

// === Connection Status ===
export type AgentConnectionStatus =
  | "disconnected"
  | "discovering"
  | "authenticating"
  | "connected"
  | "running"
  | "completed"
  | "error";

// === Timeline Types ===
export type TimelineStatus = "idle" | "running" | "done" | "error";

export type TimelineChain = "offchain" | "baseSepolia" | "zetaAthens" | "polygonAmoy";

export interface TimelineStep {
  id: string;
  title: string;
  chain: TimelineChain;
  status: TimelineStatus;
  detail?: string;
  txHash?: string;
  ts: number;
}

// === Chat Types ===
export type ChatRole = "buyer" | "seller" | "tool" | "system";

export type ChatStage = "browse" | "negotiate" | "prepare" | "settle";

export interface ToolCall {
  name: string;
  args: unknown;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  stage?: ChatStage;
  speaker: string;
  content: string;
  ts: number;
  tool?: ToolCall;
}

// === Deal Types ===
export interface SerializedDeal {
  dealId: string;
  buyer: string;
  sellerBase: string;
  polygonEscrow: string;
  nft: string;
  tokenId: string;
  price: string;
  deadline: string;
}

// === Discovery Document ===
export interface DiscoveryDocument {
  name: string;
  kind: string;
  version: string;
  origin: string;
  auth: {
    required: boolean;
    scheme: string;
    challengeEndpoint: string;
    verifyEndpoint: string;
  };
  endpoints: {
    config: string;
    tools: string;
    settlementStream: string;
  };
}

// === Demo Mode ===
export type DemoMode = "simulate" | "testnet";

// === Checkout Mode ===
export type CheckoutMode = "auto" | "confirm";

// === Agent Engine ===
export type AgentEngine = "builtin" | "proxy";

// === Scenario ===
export type AgentScenario = "single" | "multi";

// === Agent State ===
export interface AgentState {
  // Connection
  connectionStatus: AgentConnectionStatus;
  sessionId: string | null;
  sessionToken: string | null;

  // Discovery data
  discovery: DiscoveryDocument | null;

  // UI state
  isExpanded: boolean;
  isChatExpanded: boolean;

  // Demo mode
  demoMode: DemoMode;
  checkoutMode: CheckoutMode;

  // Agent runtime config
  agentEngine: AgentEngine;
  agentUpstream: string;
  scenario: AgentScenario;

  // Runtime state
  selectedStoreId: string | null;
  selectedProductId: string | null;
  awaitingConfirm: boolean;
  settling: boolean;

  // Timeline
  timeline: TimelineStep[];

  // Chat
  messages: ChatMessage[];

  // Deal
  deal: SerializedDeal | null;

  // Error
  errorMessage: string | null;
}

// === Agent Actions ===
export interface AgentActions {
  connect: (goal?: string) => Promise<void>;
  watchSession: (sessionId: string) => Promise<void>;
  disconnect: () => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  reset: () => void;
  setDemoMode: (mode: DemoMode) => void;
  setCheckoutMode: (mode: CheckoutMode) => void;
  setAgentEngine: (engine: AgentEngine) => void;
  setAgentUpstream: (upstream: string) => void;
  setScenario: (scenario: AgentScenario) => void;
  confirmSettlement: () => Promise<void>;
}

// === Combined Context Type ===
export type AgentContextValue = AgentState & AgentActions;

// === Context ===
export const AgentContext = createContext<AgentContextValue | null>(null);

// === Hook ===
export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within AgentProvider");
  }
  return context;
}

// === Optional Hook (for components outside provider) ===
export function useAgentOptional() {
  return useContext(AgentContext);
}
