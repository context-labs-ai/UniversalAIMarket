/**
 * Agent Built-in Tools
 *
 * These are the ONLY tools the agent has built-in.
 * Everything else is discovered dynamically from websites.
 *
 * The agent is a generic AI assistant that can:
 * 1. Read web pages and API documentation
 * 2. Make HTTP requests to any API
 * 3. Sign messages/transactions locally
 * 4. Report progress to the user
 */

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

/**
 * Built-in tools - these are generic and not website-specific
 */
export const BUILTIN_TOOLS: Tool[] = [
  {
    name: "fetch_url",
    description: "获取任意 URL 的内容。可以用来读取网站的 API 文档、商品页面、或任何公开的网页内容。返回页面的文本内容。",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "要访问的完整 URL，如 http://localhost:3000/.well-known/universal-ai-market.json",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "call_api",
    description: "调用任意 HTTP API。根据从网站文档中学到的接口规范，发送 HTTP 请求。支持 GET、POST 等方法。",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "API 端点的完整 URL",
        },
        method: {
          type: "string",
          description: "HTTP 方法",
          enum: ["GET", "POST", "PUT", "DELETE"],
        },
        headers: {
          type: "string",
          description: "请求头，JSON 格式字符串，如 '{\"Content-Type\": \"application/json\"}'",
        },
        body: {
          type: "string",
          description: "请求体，JSON 格式字符串（仅 POST/PUT 需要）",
        },
      },
      required: ["url", "method"],
    },
  },
  {
    name: "sign_message",
    description: "使用本地钱包私钥签署消息。签名过程完全在本地完成，私钥不会发送到任何服务器。用于证明身份或授权操作。",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "要签名的消息内容",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "sign_typed_data",
    description: "使用本地钱包签署 EIP-712 类型化数据。用于签署链上交易授权，如 Deal 结算。签名完全在本地完成。",
    parameters: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "EIP-712 domain，JSON 格式字符串",
        },
        types: {
          type: "string",
          description: "EIP-712 types 定义，JSON 格式字符串",
        },
        message: {
          type: "string",
          description: "要签名的消息对象，JSON 格式字符串",
        },
      },
      required: ["domain", "types", "message"],
    },
  },
  {
    name: "get_wallet_address",
    description: "获取当前钱包地址。用于在调用 API 时提供 buyer 地址。",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "check_balance",
    description: "查询钱包在指定链上的余额。返回原生代币和 USDC 余额。",
    parameters: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: "要查询的链",
          enum: ["polygon_amoy", "base_sepolia"],
        },
      },
      required: ["chain"],
    },
  },
  {
    name: "report_to_user",
    description: "向用户报告当前进度、发现或结果。用于告知用户你正在做什么。",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "要报告给用户的消息",
        },
        type: {
          type: "string",
          description: "消息类型",
          enum: ["info", "success", "warning", "error", "progress"],
        },
      },
      required: ["message", "type"],
    },
  },
];

/**
 * Format tools for OpenAI/Qwen function calling
 */
export function formatToolsForLLM(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Tool["parameters"];
  };
}> {
  return BUILTIN_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
