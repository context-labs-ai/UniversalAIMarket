import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

function isPresent(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!isPresent(raw)) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function toPriceString(n: number) {
  return round2(n).toFixed(2).replace(/\.00$/, "");
}

type SellerStyle = "aggressive" | "pro" | "friendly";

function normalizeStyle(raw: string | undefined): SellerStyle {
  if (raw === "aggressive" || raw === "pro" || raw === "friendly") return raw;
  return "pro";
}

function computeQuote(opts: {
  listPrice: number;
  round: number;
  style: SellerStyle;
  minPriceFactor: number;
  maxDiscountPerRound: number;
}) {
  const { listPrice, round, style, minPriceFactor, maxDiscountPerRound } = opts;
  const minPrice = listPrice * Math.min(1, Math.max(0.1, minPriceFactor));
  const baseDiscount = style === "aggressive" ? 0.08 : style === "friendly" ? 0.1 : 0.05;
  const discount = Math.min(baseDiscount + (round - 1) * maxDiscountPerRound, 0.35);
  const raw = listPrice * (1 - discount);
  return round2(Math.max(minPrice, raw));
}

const ChatRequestSchema = z.object({
  sessionId: z.string().min(1),
  round: z.number().int().min(1).max(10),
  buyerMessage: z.string().min(1),
  store: z
    .object({
      id: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  product: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      priceUSDC: z.string().optional(),
      highlights: z.array(z.string()).optional(),
      inventory: z.string().optional(),
    })
    .optional(),
});

const PrepareDealRequestSchema = z.object({
  sessionId: z.string().min(1),
  transcript: z.array(z.object({
    speaker: z.enum(["buyer", "seller"]),
    content: z.string(),
  })),
  product: z.object({
    id: z.string(),
    name: z.string(),
    listPriceUSDC: z.string(),
  }),
  store: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const port = envNumber("PORT", 8081);
const sellerId = isPresent(process.env.SELLER_ID) ? process.env.SELLER_ID : "seller-agent";
const sellerName = isPresent(process.env.SELLER_NAME) ? process.env.SELLER_NAME : "卖家 Agent";
const style = normalizeStyle(process.env.SELLER_STYLE);

const minPriceFactor = envNumber("MIN_PRICE_FACTOR", style === "aggressive" ? 0.85 : style === "friendly" ? 0.8 : 0.9);
const maxDiscountPerRound = envNumber("MAX_DISCOUNT_PER_ROUND", 0.06);

const model = isPresent(process.env.MODEL) ? process.env.MODEL : "qwen-turbo";
const openAIApiKey = isPresent(process.env.OPENAI_API_KEY) ? process.env.OPENAI_API_KEY : undefined;
const openAIBaseUrl = isPresent(process.env.OPENAI_BASE_URL) ? process.env.OPENAI_BASE_URL : undefined;

// LLM 连接状态
let llmAvailable = false;

function createLLM() {
  return new ChatOpenAI({
    model,
    openAIApiKey,
    configuration: openAIBaseUrl ? { baseURL: openAIBaseUrl } : undefined,
    temperature: 0.7,
  });
}

async function testLLMConnection(): Promise<boolean> {
  if (!openAIApiKey && !openAIBaseUrl) {
    console.log(`[seller-agent] LLM 未配置，使用固定话术模式`);
    return false;
  }

  console.log(`[seller-agent] 测试 LLM 连接... (model: ${model})`);
  try {
    const llm = createLLM();
    const testMessage = new HumanMessage("你好，请回复'OK'");
    const res = await llm.invoke([testMessage]);
    const content = String(res.content ?? "").trim();
    if (content.length > 0) {
      console.log(`[seller-agent] ✅ LLM 连接成功，响应: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`);
      return true;
    }
    console.log(`[seller-agent] ⚠️ LLM 返回空内容，fallback 到固定话术`);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[seller-agent] ❌ LLM 连接失败: ${msg}`);
    console.log(`[seller-agent] fallback 到固定话术模式`);
    return false;
  }
}

function buildSystemPrompt(input: z.infer<typeof ChatRequestSchema>, quote: number) {
  const storeName = input.store?.name || input.store?.id || "本店";
  const productName = input.product?.name || input.product?.id || "该商品";
  const highlights = input.product?.highlights?.slice(0, 3).join(" / ");
  const inventory = input.product?.inventory;

  const tone =
    style === "aggressive"
      ? "更强势、会反驳、会制造紧迫感，但禁止辱骂和人身攻击。"
      : style === "friendly"
        ? "更热情、愿意让利、会用夸赞和赠品来促成成交。"
        : "更专业、强调品质/保障/交付与跨链托管安全。";

  return [
    `你是${sellerName}（${sellerId}），代表店铺「${storeName}」与买家谈判并促成成交。`,
    `沟通风格：${tone}`,
    "要求：中文、1-3 句话，必须包含明确报价行，格式严格为：报价: <数字> USDC",
    `当前商品：${productName}`,
    highlights ? `亮点：${highlights}` : "",
    inventory ? `库存：${inventory}` : "",
    `本轮给出的报价是：${toPriceString(quote)} USDC（必须写在“报价:”行里）`,
  ]
    .filter(Boolean)
    .join("\n");
}

function generateFallbackReply(input: z.infer<typeof ChatRequestSchema>, quote: number) {
  const listPrice = Number(input.product?.priceUSDC ?? "0");
  const listPriceText = Number.isFinite(listPrice) && listPrice > 0 ? toPriceString(listPrice) : "未知";

  const opening =
    style === "aggressive"
      ? `别再压了，这个价已经很顶。标价 ${listPriceText} USDC，给你最后一次机会。`
      : style === "friendly"
        ? `我理解你想省预算～标价 ${listPriceText} USDC，我尽量帮你申请到优惠。`
        : `我们这款主打品质与跨链托管交付，价格有底线，但我可以给你最优方案。标价 ${listPriceText} USDC。`;
  return `${opening}\n报价: ${toPriceString(quote)} USDC`;
}

async function generateReply(input: z.infer<typeof ChatRequestSchema>, quote: number) {
  // 如果 LLM 不可用，直接使用固定话术
  if (!llmAvailable) {
    return generateFallbackReply(input, quote);
  }

  // 尝试调用 LLM，失败时 fallback
  try {
    const llm = createLLM();
    const system = new SystemMessage(buildSystemPrompt(input, quote));
    const human = new HumanMessage(`买家消息：${input.buyerMessage}\n请回复并给出报价。`);
    const res = await llm.invoke([system, human]);
    const text = String(res.content ?? "").trim();
    if (text.includes("报价:")) return text;
    return `${text}\n报价: ${toPriceString(quote)} USDC`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[seller-agent] LLM 调用失败: ${msg}，使用 fallback`);
    return generateFallbackReply(input, quote);
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, sellerId, sellerName, style, model, llmAvailable });
});

app.post("/api/seller/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const input = parsed.data;
  const listPriceRaw = input.product?.priceUSDC;
  const listPriceNum = isPresent(listPriceRaw) ? Number(listPriceRaw) : NaN;
  const listPrice = Number.isFinite(listPriceNum) && listPriceNum > 0 ? listPriceNum : 80;

  const quote = computeQuote({
    listPrice,
    round: input.round,
    style,
    minPriceFactor,
    maxDiscountPerRound,
  });

  try {
    const reply = await generateReply(input, quote);
    return res.json({
      ok: true,
      sellerId,
      sellerName,
      reply,
      quotePriceUSDC: toPriceString(quote),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seller agent failed";
    return res.status(500).json({ ok: false, error: message });
  }
});

/**
 * POST /api/seller/prepare_deal
 *
 * 根据砍价聊天记录确定最终成交价格和交易详情
 * 由 Seller Agent 分析对话，提取双方同意的最终价格
 */
app.post("/api/seller/prepare_deal", async (req, res) => {
  const parsed = PrepareDealRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const input = parsed.data;
  const listPrice = Number(input.product.listPriceUSDC);

  // 从聊天记录中提取最终价格
  const finalPrice = await extractFinalPriceFromTranscript(input.transcript, listPrice);

  if (finalPrice === null) {
    return res.json({
      ok: false,
      error: "无法从对话中确定最终成交价格",
      dealReady: false,
    });
  }

  return res.json({
    ok: true,
    dealReady: true,
    sellerId,
    sellerName,
    deal: {
      productId: input.product.id,
      productName: input.product.name,
      storeId: input.store.id,
      storeName: input.store.name,
      listPriceUSDC: toPriceString(listPrice),
      finalPriceUSDC: toPriceString(finalPrice),
      discount: round2((1 - finalPrice / listPrice) * 100),
    },
  });
});

/**
 * 从聊天记录中提取最终成交价格
 * 优先使用 LLM 分析，fallback 到正则提取
 */
async function extractFinalPriceFromTranscript(
  transcript: Array<{ speaker: string; content: string }>,
  listPrice: number
): Promise<number | null> {
  // 先尝试从最后几条消息中用正则提取
  const lastMessages = transcript.slice(-4);

  // 查找买家最后明确接受的价格
  for (let i = lastMessages.length - 1; i >= 0; i--) {
    const msg = lastMessages[i];
    if (msg.speaker === "buyer") {
      // 匹配 "接受 X USDC" 或 "同意 X USDC" 或 "成交 X USDC"
      const acceptMatch = msg.content.match(/(?:接受|同意|成交|deal|accept)[^\d]*(\d+(?:\.\d+)?)\s*(?:USDC|usdc|U)?/i);
      if (acceptMatch) {
        const price = parseFloat(acceptMatch[1]);
        if (Number.isFinite(price) && price > 0 && price <= listPrice) {
          return round2(price);
        }
      }
    }
  }

  // 查找卖家最后的报价（如果买家接受了）
  let lastSellerQuote: number | null = null;
  let buyerAccepted = false;

  for (const msg of lastMessages) {
    if (msg.speaker === "seller") {
      const quoteMatch = msg.content.match(/报价[:：]\s*(\d+(?:\.\d+)?)\s*(?:USDC|usdc|U)?/i);
      if (quoteMatch) {
        lastSellerQuote = parseFloat(quoteMatch[1]);
      }
    } else if (msg.speaker === "buyer") {
      // 检查买家是否表达了接受意愿
      if (/(?:好|可以|行|成交|同意|接受|deal|ok|agree)/i.test(msg.content)) {
        buyerAccepted = true;
      }
    }
  }

  if (buyerAccepted && lastSellerQuote !== null && Number.isFinite(lastSellerQuote)) {
    return round2(lastSellerQuote);
  }

  // 如果正则无法确定，尝试用 LLM
  if (llmAvailable) {
    try {
      const llm = createLLM();
      const transcriptText = transcript.map(t => `${t.speaker === "buyer" ? "买家" : "卖家"}: ${t.content}`).join("\n");

      const system = new SystemMessage(`你是一个交易分析助手。根据买卖双方的砍价对话，提取最终双方同意的成交价格。
只返回一个数字（价格），不要任何其他文字。如果无法确定成交价格，返回 "null"。
商品原价: ${toPriceString(listPrice)} USDC`);

      const human = new HumanMessage(`以下是砍价对话记录：\n${transcriptText}\n\n请提取最终成交价格（只返回数字）：`);

      const result = await llm.invoke([system, human]);
      const text = String(result.content ?? "").trim();

      if (text !== "null") {
        const price = parseFloat(text.replace(/[^\d.]/g, ""));
        if (Number.isFinite(price) && price > 0 && price <= listPrice) {
          return round2(price);
        }
      }
    } catch (err) {
      console.log(`[seller-agent] LLM 提取价格失败: ${err instanceof Error ? err.message : err}`);
    }
  }

  return null;
}

async function main() {
  // 启动时测试 LLM 连接
  llmAvailable = await testLLMConnection();

  app.listen(port, () => {
    console.log(`[seller-agent] listening on http://localhost:${port} (${sellerId}, ${style})`);
    console.log(`[seller-agent] LLM 模式: ${llmAvailable ? "启用" : "固定话术"}`);
  });
}

main().catch((err) => {
  console.error("[seller-agent] 启动失败:", err);
  process.exit(1);
});

