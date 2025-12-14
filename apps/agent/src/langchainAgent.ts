import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { DynamicStructuredTool } from "@langchain/core/tools";

export type AgentInput = {
  goal: string;
  buyerNote?: string;
  mode: "testnet" | "simulate";
  checkoutMode: "auto" | "confirm";
  configJson: unknown;
};

export type AgentOptions = {
  model: string;
  openAIApiKey?: string;
  openAIBaseUrl?: string;
  tools: DynamicStructuredTool[];
  callbacks?: BaseCallbackHandler[];
};

export async function runToolsAgent(input: AgentInput, opts: AgentOptions) {
  const llm = new ChatOpenAI({
    model: opts.model,
    apiKey: opts.openAIApiKey,
    configuration: opts.openAIBaseUrl ? { baseURL: opts.openAIBaseUrl } : undefined,
    temperature: 0.2,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      [
        "你是买家 Agent，正在一个去中心化电商市场里完成一次端到端交易。",
        "你必须使用提供的 tools 来检索店铺/商品并生成 Deal。",
        "输出使用中文，尽量简洁、可给评委观看。",
        "",
        "规则：",
        "- 先用 search_stores 根据 goal 找到最合适的店铺；再用 search_products 找到最合适的商品。",
        "- 必须调用 prepare_deal 生成 deal。",
        "- 如果 checkoutMode=confirm：调用 prepare_deal 后就停止（不要调用 settle_deal）。",
        "- 如果 checkoutMode=auto：在 prepare_deal 后继续调用 settle_deal 获取 streamUrl。",
      ].join("\n"),
    ],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIToolsAgent({ llm, tools: opts.tools, prompt });
  const executor = new AgentExecutor({
    agent,
    tools: opts.tools,
    verbose: false,
    callbacks: opts.callbacks,
  });

  const payload = {
    goal: input.goal,
    buyerNote: input.buyerNote || "",
    mode: input.mode,
    checkoutMode: input.checkoutMode,
    config: input.configJson,
  };

  return executor.invoke({ input: JSON.stringify(payload) });
}

