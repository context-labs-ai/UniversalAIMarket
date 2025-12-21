#!/usr/bin/env node

/**
 * CLI Agent - Autonomous AI Shopping Agent
 *
 * A conversational agent that autonomously browses and purchases from Universal AI Market.
 * Just tell it what you want to buy, and it will handle everything:
 * - Reading API documentation
 * - Searching products
 * - Negotiating with seller agents
 * - Signing deals locally (private key never leaves your machine)
 * - Submitting to ZetaChain for cross-chain settlement
 *
 * Usage:
 *   1. Configure wallet: /wallet or /key
 *   2. Chat naturally: "帮我去 localhost:3000 买一个量子之枪，预算 10 USDC"
 */

import "dotenv/config";
import * as readline from "readline";
import chalk from "chalk";

import { InMemoryWallet } from "./wallet.js";
import { AutonomousAgent } from "./agent.js";

// Global state
const wallet = new InMemoryWallet();
let agent: AutonomousAgent | null = null;

/**
 * Print banner
 */
function printBanner(): void {
  console.log(chalk.cyan.bold(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║       🤖 CLI Agent - 自主 AI 购物助手                          ║
  ║                                                               ║
  ║   告诉我你想买什么，我会自动完成搜索、砍价、签名、结算！          ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
`));
  console.log(chalk.gray("  输入 /help 查看帮助，或直接告诉我你想买什么\n"));
}

/**
 * Print help
 */
function printHelp(): void {
  console.log(chalk.cyan.bold("\n命令列表:"));
  console.log(chalk.white("  /help        ") + chalk.gray("显示帮助"));
  console.log(chalk.white("  /wallet      ") + chalk.gray("生成新钱包"));
  console.log(chalk.white("  /key         ") + chalk.gray("导入私钥"));
  console.log(chalk.white("  /status      ") + chalk.gray("查看当前状态"));
  console.log(chalk.white("  /clear       ") + chalk.gray("清屏"));
  console.log(chalk.white("  /exit        ") + chalk.gray("退出"));

  console.log(chalk.cyan.bold("\n使用示例:"));
  console.log(chalk.gray('  "帮我去 http://localhost:3000 买一个NFT量子之枪，预算 10 USDC"'));
  console.log(chalk.gray('  "搜索一下有什么武器类的商品，价格在 5 USDC 以内"'));
  console.log(chalk.gray('  "我想买一个 Agent 工作流，尽量便宜"'));
  console.log();
}

/**
 * Handle /wallet command
 */
function handleWallet(): void {
  const { address, privateKey } = wallet.generateRandom();

  console.log(chalk.green.bold("\n✅ 新钱包已生成！"));
  console.log(chalk.white("地址: ") + chalk.yellow(address));
  console.log(chalk.red.bold("\n⚠️  请保存私钥（只显示一次）:"));
  console.log(chalk.yellow(privateKey));
  console.log(chalk.gray("\n私钥仅存在内存中，退出后将清除。"));

  // Reinitialize agent with new wallet
  agent = new AutonomousAgent(wallet);
}

/**
 * Handle /key command
 */
async function handleKey(rl: readline.Interface): Promise<void> {
  return new Promise((resolve) => {
    console.log(chalk.cyan("\n请输入私钥（不会被存储或上传）:"));

    rl.question(chalk.gray("> "), (key) => {
      if (!key.trim()) {
        console.log(chalk.yellow("已取消。"));
        resolve();
        return;
      }

      const result = wallet.setPrivateKey(key.trim());

      if (result.success) {
        console.log(chalk.green.bold("\n✅ 钱包配置成功！"));
        console.log(chalk.white("地址: ") + chalk.yellow(result.address));

        // Reinitialize agent with new wallet
        agent = new AutonomousAgent(wallet);
      } else {
        console.log(chalk.red(`\n❌ 错误: ${result.error}`));
      }

      resolve();
    });
  });
}

/**
 * Handle /status command
 */
function handleStatus(): void {
  console.log(chalk.cyan.bold("\n当前状态:"));
  console.log(
    chalk.white("钱包: ") +
      (wallet.isConfigured()
        ? chalk.green(wallet.getAddress())
        : chalk.yellow("未配置 (使用 /wallet 或 /key)"))
  );
  console.log(
    chalk.white("LLM: ") +
      chalk.gray(process.env.LLM_MODEL || process.env.MODEL || "qwen-plus")
  );
  console.log();
}

/**
 * Parse budget from user message
 */
function parseBudget(message: string): number | undefined {
  // Match patterns like "预算 10 USDC", "10U", "10 usdc"
  const patterns = [
    /预算[^\d]*(\d+(?:\.\d+)?)\s*(?:USDC|usdc|U|u)?/,
    /(\d+(?:\.\d+)?)\s*(?:USDC|usdc)\s*(?:预算|的预算)?/,
    /最多[^\d]*(\d+(?:\.\d+)?)\s*(?:USDC|usdc|U|u)?/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return undefined;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  printBanner();

  // Check LLM configuration
  const llmKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!llmKey) {
    console.log(chalk.yellow("⚠️  LLM API Key 未配置。"));
    console.log(chalk.gray("请设置环境变量 LLM_API_KEY 或在 .env 文件中配置。"));
    console.log(chalk.gray("支持 Qwen (通义千问) 和其他 OpenAI 兼容的 API。\n"));
  }

  // Prompt for wallet if not configured
  console.log(chalk.cyan("首先，请配置你的钱包："));
  console.log(chalk.gray("  /wallet - 生成新钱包"));
  console.log(chalk.gray("  /key    - 导入已有私钥\n"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    const walletStatus = wallet.isConfigured()
      ? chalk.green("●")
      : chalk.yellow("○");

    rl.question(`${walletStatus} ${chalk.cyan("你: ")}`, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith("/")) {
        const cmd = trimmed.toLowerCase();

        switch (cmd) {
          case "/help":
            printHelp();
            break;

          case "/wallet":
            handleWallet();
            break;

          case "/key":
          case "/secret-key":
            await handleKey(rl);
            break;

          case "/status":
            handleStatus();
            break;

          case "/clear":
            console.clear();
            printBanner();
            break;

          case "/exit":
          case "/quit":
            console.log(chalk.gray("\n再见！钱包数据已从内存清除。\n"));
            wallet.clear();
            rl.close();
            process.exit(0);

          default:
            console.log(chalk.yellow(`未知命令: ${cmd}`));
            console.log(chalk.gray("输入 /help 查看可用命令"));
        }

        prompt();
        return;
      }

      // Natural language input - run agent
      if (!wallet.isConfigured()) {
        console.log(chalk.yellow("\n请先配置钱包。使用 /wallet 生成新钱包或 /key 导入私钥。\n"));
        prompt();
        return;
      }

      if (!agent) {
        agent = new AutonomousAgent(wallet);
      }

      // Test LLM connection on first use
      const connected = await agent.testConnection();
      if (!connected) {
        console.log(chalk.red("\nLLM 连接失败，请检查 API Key 配置。\n"));
        prompt();
        return;
      }

      // Parse budget from message
      const budget = parseBudget(trimmed);

      // Run agent
      try {
        await agent.run(trimmed, budget);
      } catch (err) {
        console.log(chalk.red(`\n错误: ${err instanceof Error ? err.message : err}\n`));
      }

      prompt();
    });
  };

  prompt();
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.gray("\n\n正在退出... 钱包数据已清除。"));
  wallet.clear();
  process.exit(0);
});

// Run
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
