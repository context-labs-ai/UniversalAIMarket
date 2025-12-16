# Seller Agent Service (MVP)

This is a standalone seller-customer-service Agent service used by the multi-service demo.

- Runs as an independent HTTP service (start two instances for Seller A / Seller B).
- Only does **chat + price quote** (no on-chain actions, no market tool calls).
- The Buyer Agent (hub) aggregates both sellers into a single SSE stream for the website.

## Features

- **3 Seller Styles**: `aggressive` (强势), `pro` (专业), `friendly` (热情)
- **LLM-powered or Template-based**: Auto-fallback to templates if LLM unavailable
- **Startup LLM Test**: Validates LLM connectivity on boot

## Endpoints

- `GET /health` — returns `{ ok, sellerId, sellerName, style, model, llmAvailable }`
- `POST /api/seller/chat` — negotiate with buyer

### `POST /api/seller/chat` request

```json
{
  "sessionId": "uuid",
  "round": 1,
  "buyerMessage": "我出 70 USDC ...",
  "store": { "id": "store-1", "name": "xxx" },
  "product": { "id": "p-1", "name": "xxx", "priceUSDC": "80" }
}
```

### Response

```json
{
  "sellerId": "seller-agent-a",
  "sellerName": "卖家 Agent A",
  "reply": "……\n报价: 78 USDC",
  "quotePriceUSDC": "78"
}
```

## Run locally

Create two env files (they are gitignored):
- `apps/seller-agent/.env.seller-a` (copy from `apps/seller-agent/.env.seller-a.example`)
- `apps/seller-agent/.env.seller-b` (copy from `apps/seller-agent/.env.seller-b.example`)

Then start two services with different personas:

```powershell
# Seller A (aggressive style, port 8081)
pnpm -C apps/seller-agent dev:a

# Seller B (pro style, port 8082)
pnpm -C apps/seller-agent dev:b
```

### Startup Logs

On startup, you'll see LLM connectivity test results:

```
[seller-agent] 测试 LLM 连接... (model: qwen-plus)
[seller-agent] ✅ LLM 连接成功，响应: "OK"
[seller-agent] listening on http://localhost:8081 (seller-a, aggressive)
[seller-agent] LLM 模式: 启用
```

If LLM test fails, it auto-fallbacks to templates:

```
[seller-agent] ❌ LLM 连接失败: Request failed with status code 401
[seller-agent] fallback 到固定话术模式
[seller-agent] LLM 模式: 固定话术
```

## Configuration

See `.env.example` for all options:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `8081` |
| `SELLER_ID` | Seller identifier | `seller-agent` |
| `SELLER_NAME` | Display name | `卖家 Agent` |
| `SELLER_STYLE` | `aggressive` / `pro` / `friendly` | `pro` |
| `MIN_PRICE_FACTOR` | Minimum price as factor of list price | `0.80` |
| `MAX_DISCOUNT_PER_ROUND` | Max discount per negotiation round | `0.06` |
| `MODEL` | LLM model name | `qwen-plus` |
| `OPENAI_API_KEY` | API key for LLM | (empty = template mode) |
| `OPENAI_BASE_URL` | OpenAI-compatible API base URL | (empty = OpenAI official) |

### LLM Configuration Examples

**Alibaba Qwen (DashScope International)**:
```env
MODEL=qwen-plus
OPENAI_API_KEY=sk-your-dashscope-key
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

**OpenAI Official**:
```env
MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-your-openai-key
OPENAI_BASE_URL=
```

**Local Ollama**:
```env
MODEL=qwen2:7b
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
```
