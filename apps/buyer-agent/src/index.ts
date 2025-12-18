/**
 * Buyer Agent Service
 *
 * 独立的 Buyer Agent 服务，提供:
 * - POST /negotiate  - 砍价对话
 * - POST /sign       - 交易签名
 * - GET  /config     - Agent 配置
 * - GET  /health     - 健康检查
 *
 * 用户可以自托管此服务，连接自己的钱包和预算。
 */

import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";

import type {
  NegotiateRequest,
  NegotiateResponse,
  SignRequest,
  SignResponse,
  AgentConfigResponse,
  ErrorResponse,
} from "./types.js";
import { createWalletFromEnv, AgentWallet } from "./wallet.js";
import { createBudgetFromEnv, BudgetManager } from "./budget.js";
import { createStrategyFromEnv, NegotiationStrategy } from "./strategy.js";

// ============================================
// 初始化
// ============================================

const PORT = parseInt(process.env.PORT || "8081", 10);
const AGENT_NAME = process.env.AGENT_NAME || "Demo Buyer Agent";
const VERSION = "0.1.0";

let wallet: AgentWallet;
let budget: BudgetManager;
let strategy: NegotiationStrategy;

try {
  wallet = createWalletFromEnv();
  budget = createBudgetFromEnv();
  // 用 MAX_PER_DEAL_USDC 作为砍价预算（单笔交易限额）
  strategy = createStrategyFromEnv(parseFloat(process.env.MAX_PER_DEAL_USDC || "10"));

  console.log(`[buyer-agent] Wallet: ${wallet.address}`);
  console.log(`[buyer-agent] Budget: ${JSON.stringify(budget.getStatus())}`);
} catch (err) {
  console.error("[buyer-agent] Initialization failed:", err);
  process.exit(1);
}

// 会话上下文存储
const sessions = new Map<
  string,
  {
    transcript: Array<{ role: "buyer" | "seller"; content: string }>;
    productName?: string;
    listPriceUSDC?: number;
    sellerName?: string;
    storeName?: string;
  }
>();

// ============================================
// Express App
// ============================================

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// GET /health - 健康检查
// ============================================

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, name: AGENT_NAME, version: VERSION });
});

// ============================================
// GET /config - Agent 配置
// ============================================

app.get("/config", (_req: Request, res: Response<AgentConfigResponse>) => {
  const budgetStatus = budget.getStatus();

  res.json({
    ok: true,
    name: AGENT_NAME,
    version: VERSION,
    address: wallet.address,
    budget: {
      maxPerDealUSDC: budgetStatus.maxPerDealUSDC,
      totalBudgetUSDC: budgetStatus.totalBudgetUSDC,
      spentUSDC: budgetStatus.spentUSDC,
    },
    strategy: {
      minDiscountPercent: parseFloat(process.env.MIN_DISCOUNT_PERCENT || "10"),
      maxRounds: parseInt(process.env.MAX_NEGOTIATION_ROUNDS || "5", 10),
      style: (process.env.NEGOTIATION_STYLE as "aggressive" | "balanced" | "conservative") || "balanced",
    },
    capabilities: {
      negotiate: true,
      sign: true,
      autoSettle: false, // 需要 Hub 调用 /sign 来签名
    },
  });
});

// ============================================
// POST /negotiate - 砍价对话
// ============================================

app.post("/negotiate", async (req: Request, res: Response<NegotiateResponse | ErrorResponse>) => {
  try {
    const body = req.body as NegotiateRequest;
    const { sessionId, round, stage, product, seller, currentQuote, sellerMessage, expectedAction } = body;

    // Create a unique session key combining sessionId + seller to handle multi-seller negotiations
    const sessionKey = `${sessionId}:${seller.id}`;

    // 获取或创建会话上下文（每个卖家独立的 session）
    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, {
        transcript: [],
        productName: product.name,
        listPriceUSDC: parseFloat(product.listPriceUSDC),
        sellerName: seller.name,
        storeName: seller.storeName,
      });
    }

    const session = sessions.get(sessionKey)!;
    // Always use the passed-in product price to avoid confusion in multi-seller scenarios
    const listPrice = parseFloat(product.listPriceUSDC);
    const sellerQuote = currentQuote ? parseFloat(currentQuote.sellerPriceUSDC) : undefined;

    // 如果有卖家消息，加入 transcript
    if (sellerMessage) {
      session.transcript.push({ role: "seller", content: sellerMessage });
    }

    const ctx = {
      productName: product.name,
      listPriceUSDC: listPrice,
      sellerName: seller.name,
      storeName: seller.storeName,
      currentSellerQuote: sellerQuote,
      round,
      transcript: session.transcript,
    };

    let message: string;
    let decision: NegotiateResponse["decision"];

    // 根据阶段生成回复
    switch (stage) {
      case "opening": {
        message = await strategy.generateOpening(ctx);
        break;
      }

      case "bargain": {
        const result = await strategy.generateBargain(ctx);
        message = result.message;
        decision = {
          accept: false,
          offerPriceUSDC: result.offerPriceUSDC.toFixed(2),
        };
        break;
      }

      case "counter": {
        // 卖家给了反报价，我们决定是否接受
        if (!sellerQuote) {
          throw new Error("Missing sellerQuote for counter stage");
        }

        const shouldAcceptResult = strategy.shouldAccept(listPrice, sellerQuote, round);

        if (shouldAcceptResult.accept) {
          // 检查预算
          const budgetCheck = budget.canAccept(sellerQuote);
          if (!budgetCheck.allowed) {
            message = await strategy.generateRejection(ctx, budgetCheck.reason!);
            decision = { accept: false, reason: budgetCheck.reason };
          } else {
            message = await strategy.generateAcceptance(ctx, sellerQuote);
            decision = {
              accept: true,
              acceptedPrice: sellerQuote.toFixed(2),
              reason: shouldAcceptResult.reason
            };
          }
        } else {
          // 继续砍价
          const result = await strategy.generateBargain(ctx);
          message = result.message;
          decision = {
            accept: false,
            offerPriceUSDC: result.offerPriceUSDC.toFixed(2),
            reason: shouldAcceptResult.reason,
          };
        }
        break;
      }

      case "accept": {
        if (!sellerQuote) {
          throw new Error("Missing sellerQuote for accept stage");
        }
        message = await strategy.generateAcceptance(ctx, sellerQuote);
        decision = { accept: true, acceptedPrice: sellerQuote.toFixed(2) };
        break;
      }

      case "reject": {
        message = await strategy.generateRejection(ctx, "Price exceeds budget");
        decision = { accept: false };
        break;
      }

      default:
        throw new Error(`Unknown stage: ${stage}`);
    }

    // 将买家回复加入 transcript
    session.transcript.push({ role: "buyer", content: message });

    res.json({
      ok: true,
      message,
      decision,
    });
  } catch (err) {
    console.error("[buyer-agent] /negotiate error:", err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

// ============================================
// POST /sign - 交易签名
// ============================================

app.post("/sign", async (req: Request, res: Response<SignResponse | ErrorResponse>) => {
  try {
    const body = req.body as SignRequest;
    const { domain, types, message, dealMeta } = body;

    // 解析价格
    const priceUSDC = parseFloat(message.priceUSDC) / 1e6; // 假设 6 decimals

    console.log(`[buyer-agent] Sign request: ${dealMeta.productName} @ ${priceUSDC} USDC`);

    // 检查预算
    const budgetCheck = budget.canAccept(priceUSDC);
    if (!budgetCheck.allowed) {
      console.log(`[buyer-agent] Sign rejected: ${budgetCheck.reason}`);
      return res.status(400).json({
        ok: false,
        error: budgetCheck.reason!,
        code: "BUDGET_EXCEEDED",
      });
    }

    // 预留预算
    if (!budget.reserve(dealMeta.orderId, priceUSDC)) {
      return res.status(400).json({
        ok: false,
        error: "Failed to reserve budget",
        code: "BUDGET_RESERVE_FAILED",
      });
    }

    // 签名
    const signature = await wallet.signTypedData(
      domain,
      types,
      message as Record<string, unknown>
    );

    console.log(`[buyer-agent] Signed! Signature: ${signature.slice(0, 20)}...`);

    res.json({
      ok: true,
      signature,
      signer: wallet.address,
    });
  } catch (err) {
    console.error("[buyer-agent] /sign error:", err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Signing failed",
    });
  }
});

// ============================================
// POST /confirm - 确认交易成功（释放预留）
// ============================================

app.post("/confirm", (req: Request, res: Response) => {
  const { orderId, success } = req.body;

  if (success) {
    budget.confirm(orderId);
    console.log(`[buyer-agent] Order ${orderId} confirmed, budget updated`);
  } else {
    budget.cancel(orderId);
    console.log(`[buyer-agent] Order ${orderId} cancelled, budget released`);
  }

  res.json({ ok: true, budget: budget.getStatus() });
});

// ============================================
// 启动服务
// ============================================

app.listen(PORT, () => {
  console.log(`[buyer-agent] ${AGENT_NAME} v${VERSION}`);
  console.log(`[buyer-agent] Listening on http://localhost:${PORT}`);
  console.log(`[buyer-agent] Endpoints:`);
  console.log(`  GET  /health    - Health check`);
  console.log(`  GET  /config    - Agent configuration`);
  console.log(`  POST /negotiate - Negotiation dialogue`);
  console.log(`  POST /sign      - Transaction signing`);
  console.log(`  POST /confirm   - Confirm transaction result`);
});
