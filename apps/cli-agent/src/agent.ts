/**
 * Autonomous Agent
 *
 * A generic LLM-powered agent that can browse websites, learn APIs, and execute tasks.
 * The agent has NO built-in knowledge of specific websites - it discovers everything.
 *
 * Built-in capabilities (generic):
 * - fetch_url: Read any webpage or API documentation
 * - call_api: Make HTTP requests to any endpoint
 * - sign_message: Sign messages with local private key
 * - sign_typed_data: Sign EIP-712 data locally
 * - get_wallet_address: Get the configured wallet address
 * - check_balance: Check wallet balance on supported chains
 * - report_to_user: Output messages to the user
 */

import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import chalk from "chalk";
import { formatToolsForLLM, BUILTIN_TOOLS } from "./tools.js";
import { ToolExecutor } from "./executor.js";
import { InMemoryWallet } from "./wallet.js";

/**
 * Get LLM configuration from environment
 */
function getLLMConfig() {
  return {
    model: process.env.LLM_MODEL || process.env.MODEL || "qwen-plus",
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL,
  };
}

/**
 * Create LLM instance
 */
function createLLM(): ChatOpenAI {
  const config = getLLMConfig();

  if (!config.apiKey) {
    throw new Error("LLM API Key 未配置。请设置 LLM_API_KEY 环境变量。");
  }

  return new ChatOpenAI({
    model: config.model,
    openAIApiKey: config.apiKey,
    configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
    temperature: 0.3,
  });
}

/**
 * System prompt - explains the agent's generic capabilities
 */
function buildSystemPrompt(walletAddress: string | null, budget?: number): string {
  const toolList = BUILTIN_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n");

  return `你是一个通用的 AI 购物助手。你可以访问任何网站，学习它们的 API，并帮助用户完成购买任务。

## 你的内置能力（通用工具）
${toolList}

## 重要：你不知道任何网站的具体 API
你没有任何网站的内置知识。当用户让你访问某个网站时，你必须：
1. 先用 fetch_url 获取网站的 API 文档（通常在 /.well-known/ 目录）
2. 阅读文档，了解网站提供了哪些接口
3. 使用 call_api 调用这些接口

## 工作流程示例
用户说："帮我去 http://localhost:3000 买一个量子之枪"

你应该：
1. fetch_url("http://localhost:3000/.well-known/universal-ai-market.json") - 获取 API 文档
2. 阅读文档，发现有 tools 端点可以调用
3. call_api(tools端点, "GET") - 获取可用的 tools 列表
4. call_api(tools端点, "POST", body=搜索参数) - 搜索商品
5. 找到商品后，调用聊天接口与卖家砍价
6. 达成协议后，调用准备交易的接口获取 Deal 数据
7. sign_typed_data(Deal数据) - 本地签名
8. call_api(提交接口, "POST", 签名数据) - 提交完成交易

## 当前状态
- 钱包地址：${walletAddress || "未配置（需要先配置钱包）"}
- 预算限制：${budget ? `${budget} USDC` : "用户未指定"}

## 注意事项
1. 签名操作（sign_message, sign_typed_data）完全在本地完成，私钥永远不会发送到任何服务器
2. 每一步都要用 report_to_user 告诉用户你在做什么
3. 如果网站的 API 文档中没有你需要的接口，告诉用户
4. 砍价时注意用户的预算限制
5. 遇到错误时，尝试分析原因并告诉用户

## 回复格式
分析用户需求，使用工具完成任务。每次调用一个或多个工具，等待结果后决定下一步。
`;
}

/**
 * Autonomous Agent class
 */
export class AutonomousAgent {
  private llm: ChatOpenAI;
  private executor: ToolExecutor;
  private wallet: InMemoryWallet;
  private messages: BaseMessage[] = [];
  private maxIterations: number = 20;

  constructor(wallet: InMemoryWallet) {
    this.wallet = wallet;
    this.llm = createLLM();
    this.executor = new ToolExecutor(wallet);
  }

  /**
   * Test LLM connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const config = getLLMConfig();
      console.log(chalk.gray(`[Agent] 测试 LLM 连接... (model: ${config.model})`));

      const response = await this.llm.invoke([new HumanMessage("回复 OK")]);
      const content = String(response.content || "").trim();

      if (content) {
        console.log(chalk.green(`[Agent] ✅ LLM 连接成功`));
        return true;
      }
      return false;
    } catch (err) {
      console.log(
        chalk.red(`[Agent] ❌ LLM 连接失败: ${err instanceof Error ? err.message : err}`)
      );
      return false;
    }
  }

  /**
   * Run the agent with a user message
   */
  async run(userMessage: string, budget?: number): Promise<void> {
    // Initialize conversation
    const systemPrompt = buildSystemPrompt(this.wallet.getAddress(), budget);
    this.messages = [new SystemMessage(systemPrompt), new HumanMessage(userMessage)];

    console.log(chalk.cyan("\n[Agent] 开始处理您的请求...\n"));

    // Bind tools to LLM
    const tools = formatToolsForLLM();
    const llmWithTools = this.llm.bind({ tools });

    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      try {
        // Get LLM response
        const response = await llmWithTools.invoke(this.messages);

        // Check if there are tool calls
        const toolCalls = response.additional_kwargs?.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
          // No tool calls - agent is responding or done
          const content = String(response.content || "");
          if (content) {
            console.log(chalk.white(`\n[Agent] ${content}`));
          }

          // Check if agent seems done
          if (
            content.includes("完成") ||
            content.includes("成功") ||
            content.includes("已提交") ||
            content.includes("无法") ||
            !content
          ) {
            break;
          }

          this.messages.push(new AIMessage(response));
          continue;
        }

        // Add assistant message with tool calls
        this.messages.push(new AIMessage(response));

        // Execute each tool call
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let args: Record<string, unknown> = {};

          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            args = {};
          }

          // Log tool call
          if (toolName === "report_to_user") {
            // report_to_user will print its own message
          } else {
            console.log(chalk.blue(`\n[Tool] ${toolName}`));
            if (Object.keys(args).length > 0) {
              const argsStr = JSON.stringify(args, null, 2);
              if (argsStr.length < 200) {
                console.log(chalk.gray(argsStr));
              }
            }
          }

          // Execute tool
          const result = await this.executor.execute(toolName, args);

          // Log result (abbreviated)
          if (toolName !== "report_to_user") {
            if (result.success) {
              const resultStr = JSON.stringify(result.result);
              if (resultStr.length > 300) {
                console.log(chalk.gray(`[Result] (${resultStr.length} chars) ...`));
              } else {
                console.log(chalk.gray(`[Result] ${resultStr}`));
              }
            } else {
              console.log(chalk.red(`[Error] ${result.error}`));
            }
          }

          // Add tool result to messages
          this.messages.push(
            new ToolMessage({
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
            })
          );
        }
      } catch (err) {
        console.log(
          chalk.red(`\n[Agent] 错误: ${err instanceof Error ? err.message : err}`)
        );

        // Add error to conversation
        this.messages.push(
          new HumanMessage(
            `发生错误: ${err instanceof Error ? err.message : err}。请尝试其他方法或告知用户。`
          )
        );
      }
    }

    if (iteration >= this.maxIterations) {
      console.log(chalk.yellow("\n[Agent] 达到最大迭代次数，停止执行。"));
    }

    console.log(chalk.cyan("\n[Agent] 任务处理完成。\n"));
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
  }
}
