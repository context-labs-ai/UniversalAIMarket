import type { TimelineStep, TimelineChain, TimelineStatus } from "./agentContext";

/**
 * Timeline Step Definitions
 *
 * The Agent flow consists of 9 steps across 4 chains:
 * - offchain: Discovery, browsing, negotiation, deal preparation
 * - offchain: Optional confirm (manual checkout)
 * - baseSepolia: USDC approval and deposit
 * - zetaAthens: Cross-chain orchestration
 * - polygonAmoy: NFT delivery
 */

export type TimelineStepId =
  | "discover"
  | "browse"
  | "negotiate"
  | "prepare"
  | "confirm"
  | "approve"
  | "deposit"
  | "orchestrate"
  | "deliver";

export interface TimelineStepDefinition {
  id: TimelineStepId;
  title: string;
  titleZh: string;
  chain: TimelineChain;
  description: string;
}

/**
 * All 9 timeline steps in execution order
 */
export const TIMELINE_STEPS: TimelineStepDefinition[] = [
  {
    id: "discover",
    title: "Discover Service",
    titleZh: "发现服务",
    chain: "offchain",
    description: "Fetching /.well-known/universal-ai-market.json",
  },
  {
    id: "browse",
    title: "Browse Products",
    titleZh: "浏览商品",
    chain: "offchain",
    description: "Exploring stores and selecting products",
  },
  {
    id: "negotiate",
    title: "Negotiate Price",
    titleZh: "讨价还价",
    chain: "offchain",
    description: "Buyer and seller agents negotiating",
  },
  {
    id: "prepare",
    title: "Prepare Deal",
    titleZh: "准备交易",
    chain: "offchain",
    description: "Generating deal parameters and signatures",
  },
  {
    id: "confirm",
    title: "Confirm Settlement",
    titleZh: "确认并发起结算",
    chain: "offchain",
    description: "Waiting for user confirmation before settlement",
  },
  {
    id: "approve",
    title: "Approve USDC",
    titleZh: "授权 USDC",
    chain: "baseSepolia",
    description: "Approving USDC spending on Base",
  },
  {
    id: "deposit",
    title: "Deposit Payment",
    titleZh: "提交付款",
    chain: "baseSepolia",
    description: "Depositing USDC to escrow contract",
  },
  {
    id: "orchestrate",
    title: "Cross-Chain Process",
    titleZh: "跨链处理",
    chain: "zetaAthens",
    description: "ZetaChain orchestrating the settlement",
  },
  {
    id: "deliver",
    title: "Deliver NFT",
    titleZh: "交付 NFT",
    chain: "polygonAmoy",
    description: "NFT transferred to buyer on Polygon",
  },
];

/**
 * Chain display names and colors
 */
export const CHAIN_CONFIG: Record<
  TimelineChain,
  { name: string; color: string; bgColor: string }
> = {
  offchain: {
    name: "Off-chain",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  baseSepolia: {
    name: "Base",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  zetaAthens: {
    name: "ZetaChain",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  polygonAmoy: {
    name: "Polygon",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
};

/**
 * Status icon and styling config
 */
export const STATUS_CONFIG: Record<
  TimelineStatus,
  { icon: string; color: string; animate: boolean }
> = {
  idle: {
    icon: "○",
    color: "text-gray-400",
    animate: false,
  },
  running: {
    icon: "◉",
    color: "text-blue-500",
    animate: true, // Pulsing animation
  },
  done: {
    icon: "✓",
    color: "text-green-500",
    animate: false,
  },
  error: {
    icon: "✕",
    color: "text-red-500",
    animate: false,
  },
};

/**
 * Create initial timeline state with all steps idle
 */
export function createInitialTimeline(): TimelineStep[] {
  return TIMELINE_STEPS.map((def) => ({
    id: def.id,
    title: def.titleZh,
    chain: def.chain,
    status: "idle" as TimelineStatus,
    ts: 0,
  }));
}

/**
 * Update a specific step's status in the timeline
 */
export function updateTimelineStep(
  timeline: TimelineStep[],
  stepId: string,
  updates: Partial<Pick<TimelineStep, "status" | "detail" | "txHash">>
): TimelineStep[] {
  return timeline.map((step) =>
    step.id === stepId
      ? { ...step, ...updates, ts: Date.now() }
      : step
  );
}

/**
 * Get the current active step (first non-idle, non-done step)
 */
export function getCurrentStep(timeline: TimelineStep[]): TimelineStep | null {
  return timeline.find((step) => step.status === "running") || null;
}

/**
 * Get progress percentage (0-100)
 */
export function getProgressPercent(timeline: TimelineStep[]): number {
  const completedCount = timeline.filter((step) => step.status === "done").length;
  return Math.round((completedCount / timeline.length) * 100);
}

/**
 * Check if all steps are completed
 */
export function isTimelineComplete(timeline: TimelineStep[]): boolean {
  return timeline.every((step) => step.status === "done");
}

/**
 * Check if any step has error
 */
export function hasTimelineError(timeline: TimelineStep[]): boolean {
  return timeline.some((step) => step.status === "error");
}

/**
 * Get block explorer URL for transaction hash
 */
export function getExplorerUrl(chain: TimelineChain, txHash: string): string {
  const explorers: Record<TimelineChain, string> = {
    offchain: "",
    baseSepolia: "https://sepolia.basescan.org/tx/",
    // Use /tx/ for normal transactions (from DealProcessed event)
    // /cc/tx/ is only for CCTX hashes which require separate API lookup
    zetaAthens: "https://athens.explorer.zetachain.com/tx/",
    polygonAmoy: "https://amoy.polygonscan.com/tx/",
  };
  return explorers[chain] + txHash;
}
