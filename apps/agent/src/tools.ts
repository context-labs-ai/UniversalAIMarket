import { z } from "zod";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { DynamicStructuredTool as Tool } from "@langchain/core/tools";
import { MarketClient } from "./marketClient.js";

function isPresent(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function invokeToolBridge(webBaseUrl: string, name: string, args: unknown) {
  const client = new MarketClient({
    baseUrl: webBaseUrl,
    agentId: isPresent(process.env.AGENT_ID) ? process.env.AGENT_ID : undefined,
    agentPrivateKey: isPresent(process.env.AGENT_PRIVATE_KEY) ? process.env.AGENT_PRIVATE_KEY : undefined,
  });
  return client.invokeTool(name, args);
}

export type ToolBridgeContext = {
  webBaseUrl: string;
  onToolResult?: (name: string, result: unknown) => void;
};

export function buildTools(ctx: ToolBridgeContext): DynamicStructuredTool[] {
  const client = new MarketClient({
    baseUrl: ctx.webBaseUrl,
    agentId: isPresent(process.env.AGENT_ID) ? process.env.AGENT_ID : undefined,
    agentPrivateKey: isPresent(process.env.AGENT_PRIVATE_KEY) ? process.env.AGENT_PRIVATE_KEY : undefined,
  });

  const searchStores = new Tool({
    name: "search_stores",
    description: "Search stores in the marketplace catalog.",
    schema: z.object({
      query: z.string(),
      limit: z.number(),
    }),
    func: async (args) => {
      const result = await client.invokeTool("search_stores", args);
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
      const result = await client.invokeTool("search_products", args);
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
      const result = await client.invokeTool("prepare_deal", args);
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
      const result = await client.invokeTool("settle_deal", args);
      ctx.onToolResult?.("settle_deal", result);
      return JSON.stringify(result);
    },
  });

  const sellerAgentChat = new Tool({
    name: "seller_agent_chat",
    description: "Chat with a store's seller customer-support agent (ask questions / negotiate).",
    schema: z.object({
      storeId: z.string(),
      message: z.string(),
      productId: z.string().nullable(),
      conversationId: z.string().nullable(),
    }),
    func: async (args) => {
      const result = await client.invokeTool("seller_agent_chat", args);
      ctx.onToolResult?.("seller_agent_chat", result);
      return JSON.stringify(result);
    },
  });

  return [searchStores, searchProducts, prepareDeal, settleDeal, sellerAgentChat];
}
