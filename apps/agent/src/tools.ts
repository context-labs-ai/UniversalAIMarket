import { z } from "zod";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { DynamicStructuredTool as Tool } from "@langchain/core/tools";

type ToolCallResult = { ok: boolean; result?: unknown; error?: string };

export async function invokeToolBridge(webBaseUrl: string, name: string, args: unknown) {
  const res = await fetch(new URL("/api/agent/tool", webBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  const json = (await res.json().catch(() => null)) as ToolCallResult | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Tool ${name} failed`);
  return json.result;
}

export type ToolBridgeContext = {
  webBaseUrl: string;
  onToolResult?: (name: string, result: unknown) => void;
};

export function buildTools(ctx: ToolBridgeContext): DynamicStructuredTool[] {
  const searchStores = new Tool({
    name: "search_stores",
    description: "Search stores in the marketplace catalog.",
    schema: z.object({
      query: z.string(),
      limit: z.number(),
    }),
    func: async (args) => {
      const result = await invokeToolBridge(ctx.webBaseUrl, "search_stores", args);
      ctx.onToolResult?.("search_stores", result);
      return JSON.stringify(result);
    },
  });

  const searchProducts = new Tool({
    name: "search_products",
    description: "Search products within a store.",
    schema: z.object({
      storeId: z.string(),
      query: z.string(),
      limit: z.number(),
    }),
    func: async (args) => {
      const result = await invokeToolBridge(ctx.webBaseUrl, "search_products", args);
      ctx.onToolResult?.("search_products", result);
      return JSON.stringify(result);
    },
  });

  const prepareDeal = new Tool({
    name: "prepare_deal",
    description: "Create a cross-chain settlement deal payload (computes dealId).",
    schema: z.object({
      buyer: z.string(),
      sellerBase: z.string(),
      polygonEscrow: z.string(),
      nft: z.string(),
      tokenId: z.union([z.number(), z.string()]),
      priceUSDC: z.string(),
      deadlineSecondsFromNow: z.number(),
    }),
    func: async (args) => {
      const result = await invokeToolBridge(ctx.webBaseUrl, "prepare_deal", args);
      ctx.onToolResult?.("prepare_deal", result);
      return JSON.stringify(result);
    },
  });

  const settleDeal = new Tool({
    name: "settle_deal",
    description: "Returns a settlement SSE URL for a prepared deal.",
    schema: z.object({
      mode: z.enum(["testnet", "simulate"]),
      deal: z.any(),
    }),
    func: async (args) => {
      const result = await invokeToolBridge(ctx.webBaseUrl, "settle_deal", args);
      ctx.onToolResult?.("settle_deal", result);
      return JSON.stringify(result);
    },
  });

  return [searchStores, searchProducts, prepareDeal, settleDeal];
}
