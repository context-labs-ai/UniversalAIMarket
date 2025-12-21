import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export type DualChatConfig = {
  model: string;
  openAIApiKey?: string;
  openAIBaseUrl?: string;
};

// Base buyer prompt - budget will be added dynamically
export const BUYER_SYSTEM_PROMPT_BASE = [
  "你是买家 Agent。你将向卖家 Agent 发起需求咨询。",
  "要求：中文，1-2 句话，明确预算/偏好（如果有），并表明你会对价格进行砍价。",
  "风格：可以强势、带一点情绪，但禁止辱骂、脏话、人身攻击、歧视。",
].join("\n");

// Helper to build buyer system prompt with budget
export function buildBuyerSystemPromptWithBudget(budgetUSDC?: number): string {
  const lines = [
    "你是买家 Agent。你将向卖家 Agent 发起需求咨询。",
    "要求：中文，1-2 句话，明确预算/偏好（如果有），并表明你会对价格进行砍价。",
    "风格：可以强势、带一点情绪，但禁止辱骂、脏话、人身攻击、歧视。",
  ];
  if (budgetUSDC !== undefined && budgetUSDC < 9999) {
    lines.push(`【重要】你的预算上限是 ${budgetUSDC} USDC。你的出价必须低于商品标价，且不能超过预算。`);
  }
  return lines.join("\n");
}

// Keep for backward compatibility
export const BUYER_SYSTEM_PROMPT = BUYER_SYSTEM_PROMPT_BASE;

export const SELLER_SYSTEM_PROMPT = [
  "你是卖家 Agent，代表一家店铺与买家沟通并促成交易。",
  "目标：给出一个清晰推荐 + 标价理由 + 交易承诺（发货/交付/售后一句话）。",
  "要求：中文，2-3 句话。可以适度拉扯/回怼，但要保持专业，不得人身攻击或脏话。",
].join("\n");

export const BUYER_BARGAIN_SYSTEM_PROMPT_BASE = [
  "你是买家 Agent，正在和卖家讨价还价。",
  "要求：中文，1-2 句话。",
  "- 先表达对标价的不满（可以吐槽/争辩，但禁止辱骂、脏话、人身攻击）。",
  "- 明确提出你的报价 offerPriceUSDC（必须包含数字），并给出一个理由（预算/对比/风险）。",
  '- 语气要有点"吵架感"，但仍然要可继续交易。',
].join("\n");

// Helper to build buyer bargain prompt with budget
export function buildBuyerBargainPromptWithBudget(budgetUSDC?: number): string {
  const lines = [
    "你是买家 Agent，正在和卖家讨价还价。",
    "要求：中文，1-2 句话。",
    "- 先表达对标价的不满（可以吐槽/争辩，但禁止辱骂、脏话、人身攻击）。",
    "- 明确提出你的报价 offerPriceUSDC（必须包含数字），并给出一个理由（预算/对比/风险）。",
    '- 语气要有点"吵架感"，但仍然要可继续交易。',
  ];
  if (budgetUSDC !== undefined && budgetUSDC < 9999) {
    lines.push(`【重要】你的预算上限是 ${budgetUSDC} USDC。你的报价必须低于商品标价，且不能超过预算。绝对不要报出比标价更高的价格！`);
  }
  return lines.join("\n");
}

// Keep for backward compatibility
export const BUYER_BARGAIN_SYSTEM_PROMPT = BUYER_BARGAIN_SYSTEM_PROMPT_BASE;

export const SELLER_COUNTER_SYSTEM_PROMPT = [
  "你是卖家 Agent，正在应对买家砍价。",
  "要求：中文，2 句话左右。",
  "- 先回应买家的吐槽，轻微反击/据理力争（不攻击人）。",
  "- 给出你的反报价 counterPriceUSDC（必须包含数字），并补充一点额外价值（加急/赠品/售后）。",
].join("\n");

export const BUYER_FINAL_OFFER_SYSTEM_PROMPT = [
  "你是买家 Agent，进行最后一轮砍价。",
  "要求：中文，1 句话。",
  "- 给出最终报价 finalPriceUSDC（必须包含数字），表明这是“最后价”。",
  "- 同时明确你同意跨链结算流程，并让卖家生成订单。",
].join("\n");

export const SELLER_CLOSE_SYSTEM_PROMPT = [
  "你是卖家 Agent，收尾成交。",
  "要求：中文，1-2 句话。",
  "- 接受最终报价 finalPriceUSDC（必须包含数字），并用一句话确认交付与售后。",
  "- 最后表示马上生成订单并进入跨链结算。",
].join("\n");

export const BUYER_ACCEPT_SYSTEM_PROMPT =
  "你是买家 Agent。你将确认购买并授权进入结算。用中文，1 句话。（如果有价格，以最终价为准）";

function makeChat(cfg: DualChatConfig) {
  return new ChatOpenAI({
    model: cfg.model,
    apiKey: cfg.openAIApiKey,
    configuration: cfg.openAIBaseUrl ? { baseURL: cfg.openAIBaseUrl } : undefined,
    temperature: 0.4,
  });
}

export async function generateBuyerOpening(
  cfg: DualChatConfig,
  goal: string,
  buyerNote: string,
  budgetUSDC?: number
) {
  if (!cfg.openAIApiKey) {
    const budgetText = budgetUSDC !== undefined && budgetUSDC < 9999 ? `（预算：${budgetUSDC} USDC）` : "";
    return buyerNote.trim()
      ? `我的需求：${goal}${budgetText}\n补充：${buyerNote.trim()}`
      : `我的需求：${goal}${budgetText}`;
  }

  const chat = makeChat(cfg);
  const systemPrompt = buildBuyerSystemPromptWithBudget(budgetUSDC);
  const res = await chat.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(JSON.stringify({ goal, buyerNote, budgetUSDC })),
  ]);
  return res.content.toString();
}

export async function generateSellerReply(
  cfg: DualChatConfig,
  ctx: {
    storeName: string;
    productName: string;
    priceUSDC: string;
    highlights: string[];
    inventoryHint?: string;
  }
) {
  if (!cfg.openAIApiKey) {
    return `推荐你看「${ctx.productName}」，价格 ${ctx.priceUSDC} USDC。亮点：${ctx.highlights
      .slice(0, 3)
      .join(" / ")}。${ctx.inventoryHint ? `库存：${ctx.inventoryHint}。` : ""}需要我直接为你生成订单吗？`;
  }

  const chat = makeChat(cfg);
  const res = await chat.invoke([
    new SystemMessage(SELLER_SYSTEM_PROMPT),
    new HumanMessage(JSON.stringify(ctx)),
  ]);
  return res.content.toString();
}

export async function generateBuyerBargain(
  cfg: DualChatConfig,
  ctx: { productName: string; listPriceUSDC: string; offerPriceUSDC: string; budgetUSDC?: number }
) {
  if (!cfg.openAIApiKey) {
    return `等等，「${ctx.productName}」标价 ${ctx.listPriceUSDC} USDC 也太贵了吧？我最多出 ${ctx.offerPriceUSDC} USDC，不行我就去别家了。`;
  }

  const chat = makeChat(cfg);
  const systemPrompt = buildBuyerBargainPromptWithBudget(ctx.budgetUSDC);
  const res = await chat.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(JSON.stringify(ctx)),
  ]);
  return res.content.toString();
}

export async function generateSellerCounter(
  cfg: DualChatConfig,
  ctx: { storeName: string; productName: string; listPriceUSDC: string; counterPriceUSDC: string }
) {
  if (!cfg.openAIApiKey) {
    return `你这砍价也太狠了，我们这款「${ctx.productName}」是正品保障+跨链交付，成本在这儿。这样吧 ${ctx.counterPriceUSDC} USDC，我给你加急交付并提供售后支持。`;
  }

  const chat = makeChat(cfg);
  const res = await chat.invoke([
    new SystemMessage(SELLER_COUNTER_SYSTEM_PROMPT),
    new HumanMessage(JSON.stringify(ctx)),
  ]);
  return res.content.toString();
}

export async function generateBuyerFinalOffer(cfg: DualChatConfig, ctx: { productName: string; finalPriceUSDC: string }) {
  if (!cfg.openAIApiKey) {
    return `行，我最后价 ${ctx.finalPriceUSDC} USDC，能成我就现在买「${ctx.productName}」，你直接生成订单并走跨链结算。`;
  }

  const chat = makeChat(cfg);
  const res = await chat.invoke([
    new SystemMessage(BUYER_FINAL_OFFER_SYSTEM_PROMPT),
    new HumanMessage(JSON.stringify(ctx)),
  ]);
  return res.content.toString();
}

export async function generateSellerClose(cfg: DualChatConfig, ctx: { storeName: string; productName: string; finalPriceUSDC: string }) {
  if (!cfg.openAIApiKey) {
    return `行，成交！按 ${ctx.finalPriceUSDC} USDC 给你「${ctx.productName}」。我马上生成订单并进入跨链结算，交付与售后我来负责。`;
  }

  const chat = makeChat(cfg);
  const res = await chat.invoke([
    new SystemMessage(SELLER_CLOSE_SYSTEM_PROMPT),
    new HumanMessage(JSON.stringify(ctx)),
  ]);
  return res.content.toString();
}

export async function generateBuyerAcceptance(cfg: DualChatConfig, ctx: { productName: string; finalPriceUSDC: string }) {
  if (!cfg.openAIApiKey) return `确认，下单「${ctx.productName}」，最终价 ${ctx.finalPriceUSDC} USDC。请继续跨链结算。`;
  const chat = makeChat(cfg);
  const res = await chat.invoke([
    new SystemMessage(BUYER_ACCEPT_SYSTEM_PROMPT),
    new HumanMessage(JSON.stringify(ctx)),
  ]);
  return res.content.toString();
}
