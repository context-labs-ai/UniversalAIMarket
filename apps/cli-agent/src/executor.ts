/**
 * Tool Executor
 *
 * Executes the agent's BUILT-IN tools only.
 * These are generic capabilities, not website-specific.
 *
 * The agent discovers website-specific APIs by reading documentation,
 * then uses call_api to invoke them.
 */

import chalk from "chalk";
import { InMemoryWallet, getUSDCBalance, getNativeBalance } from "./wallet.js";

// Chain configurations (for balance checking)
const CHAINS: Record<string, { name: string; rpc: string; usdc: string }> = {
  polygon_amoy: {
    name: "Polygon Amoy (Testnet)",
    rpc: "https://rpc-amoy.polygon.technology",
    usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  },
  base_sepolia: {
    name: "Base Sepolia (Testnet)",
    rpc: "https://sepolia.base.org",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
};

/**
 * Tool executor - handles only built-in generic tools
 */
export class ToolExecutor {
  private wallet: InMemoryWallet;

  constructor(wallet: InMemoryWallet) {
    this.wallet = wallet;
  }

  /**
   * Execute a built-in tool
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result: unknown; error?: string }> {
    try {
      switch (toolName) {
        case "fetch_url":
          return await this.fetchUrl(args.url as string);

        case "call_api":
          return await this.callApi(
            args.url as string,
            args.method as string,
            args.headers as string | undefined,
            args.body as string | undefined
          );

        case "sign_message":
          return await this.signMessage(args.message as string);

        case "sign_typed_data":
          return await this.signTypedData(
            args.domain as string,
            args.types as string,
            args.message as string
          );

        case "get_wallet_address":
          return this.getWalletAddress();

        case "check_balance":
          return await this.checkBalance(args.chain as string);

        case "report_to_user":
          return this.reportToUser(args.message as string, args.type as string);

        default:
          return {
            success: false,
            result: null,
            error: `Unknown tool: ${toolName}. Only built-in tools are available.`,
          };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, result: null, error };
    }
  }

  /**
   * Fetch any URL content
   */
  private async fetchUrl(url: string): Promise<{ success: boolean; result: unknown }> {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json, text/html, */*",
        "User-Agent": "CLI-Agent/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await response.json();
      return { success: true, result: json };
    } else {
      const text = await response.text();
      // Truncate very long text
      const truncated = text.length > 5000 ? text.slice(0, 5000) + "\n...(truncated)" : text;
      return { success: true, result: truncated };
    }
  }

  /**
   * Call any HTTP API
   */
  private async callApi(
    url: string,
    method: string,
    headersStr?: string,
    bodyStr?: string
  ): Promise<{ success: boolean; result: unknown }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "CLI-Agent/1.0",
    };

    // Parse custom headers
    if (headersStr) {
      try {
        const customHeaders = JSON.parse(headersStr);
        Object.assign(headers, customHeaders);
      } catch {
        // Ignore invalid headers
      }
    }

    const options: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };

    // Add body for POST/PUT
    if (bodyStr && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      options.body = bodyStr;
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    let result: unknown;
    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    return {
      success: response.ok,
      result: {
        status: response.status,
        statusText: response.statusText,
        data: result,
      },
    };
  }

  /**
   * Sign a message locally
   */
  private async signMessage(message: string): Promise<{ success: boolean; result: unknown }> {
    if (!this.wallet.isConfigured()) {
      throw new Error("钱包未配置");
    }

    const signature = await this.wallet.signMessage(message);

    return {
      success: true,
      result: {
        message,
        signature,
        signerAddress: this.wallet.getAddress(),
        note: "签名已在本地完成，私钥未离开本机",
      },
    };
  }

  /**
   * Sign EIP-712 typed data locally
   */
  private async signTypedData(
    domainStr: string,
    typesStr: string,
    messageStr: string
  ): Promise<{ success: boolean; result: unknown }> {
    if (!this.wallet.isConfigured()) {
      throw new Error("钱包未配置");
    }

    // Parse JSON strings
    const domain = JSON.parse(domainStr);
    const types = JSON.parse(typesStr);
    const message = JSON.parse(messageStr);

    // Convert numeric strings to BigInt for uint256 fields
    const processedMessage: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(message)) {
      // Check if this field is uint256 in types
      const dealType = types.Deal || types.deal || [];
      const fieldDef = dealType.find((f: { name: string }) => f.name === key);

      if (fieldDef && fieldDef.type === "uint256" && typeof value === "string") {
        processedMessage[key] = BigInt(value);
      } else {
        processedMessage[key] = value;
      }
    }

    const signature = await this.wallet.signTypedData(domain, types, processedMessage);

    return {
      success: true,
      result: {
        signature,
        signerAddress: this.wallet.getAddress(),
        domain,
        note: "EIP-712 签名已在本地完成，私钥未离开本机",
      },
    };
  }

  /**
   * Get wallet address
   */
  private getWalletAddress(): { success: boolean; result: unknown; error?: string } {
    const address = this.wallet.getAddress();

    if (!address) {
      return {
        success: false,
        result: null,
        error: "钱包未配置。请先使用 /wallet 或 /key 配置钱包。",
      };
    }

    return {
      success: true,
      result: { address },
    };
  }

  /**
   * Check balance on a chain
   */
  private async checkBalance(chain: string): Promise<{ success: boolean; result: unknown }> {
    const address = this.wallet.getAddress();
    if (!address) {
      throw new Error("钱包未配置");
    }

    const chainConfig = CHAINS[chain];
    if (!chainConfig) {
      throw new Error(`未知的链: ${chain}。支持的链: ${Object.keys(CHAINS).join(", ")}`);
    }

    const nativeBalance = await getNativeBalance(address, chainConfig.rpc);
    const usdcBalance = await getUSDCBalance(address, chainConfig.rpc, chainConfig.usdc);

    return {
      success: true,
      result: {
        chain: chainConfig.name,
        address,
        nativeBalance,
        usdcBalance: usdcBalance + " USDC",
      },
    };
  }

  /**
   * Report to user
   */
  private reportToUser(message: string, type: string): { success: boolean; result: unknown } {
    const colorMap: Record<string, (s: string) => string> = {
      info: chalk.cyan,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      progress: chalk.blue,
    };

    const color = colorMap[type] || chalk.white;
    console.log(color(`\n[Agent] ${message}`));

    return {
      success: true,
      result: { reported: true },
    };
  }
}
