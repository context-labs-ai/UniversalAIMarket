export type DemoMode = "testnet" | "simulate";
export type CheckoutMode = "auto" | "confirm";

export type TimelineStepPayload = {
  id: string;
  status: "idle" | "running" | "done" | "error";
  detail?: string;
  txHash?: string;
  ts: number;
};

export type ChatMessagePayload = {
  id: string;
  role: "buyer" | "seller" | "system";
  stage: "browse" | "negotiate" | "prepare" | "settle";
  speaker: string;
  content: string;
  ts: number;
  // Optional: seller info for grouping negotiate stage messages
  sellerId?: string;
  storeId?: string;
  storeName?: string;
  productId?: string;
  productName?: string;
  priceUSDC?: string;
};

export type DealProposalPayload = {
  id: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  priceUSDC: string;
  status: "pending" | "failed" | "cancelled";
  reason?: string; // e.g., "over_budget", "negotiation_failed"
};

export type ToolCallPayload = {
  id: string;
  stage: ChatMessagePayload["stage"];
  name: string;
  args: unknown;
  ts: number;
};

export type ToolResultPayload = {
  id: string;
  result: unknown;
  ts: number;
};

export type SettlementCompletePayload = {
  storeId: string;
  productId: string;
  dealId?: string;
  txHash?: string;
};

export interface FlowEmitter {
  comment(comment: string): void;
  state(patch: Record<string, unknown>): void;
  timelineStep(step: TimelineStepPayload): void;
  message(msg: ChatMessagePayload): void;
  dealProposal(proposal: DealProposalPayload): void;
  settlementComplete(payload: SettlementCompletePayload): void;
  toolCall(call: ToolCallPayload): void;
  toolResult(result: ToolResultPayload): void;
  done(payload: unknown): void;
  error(payload: unknown): void;
}

