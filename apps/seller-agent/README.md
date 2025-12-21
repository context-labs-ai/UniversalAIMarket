# Seller Agent Service

Seller Agent 服务，代表卖家进行客服和砍价对话。**单服务支持多卖家身份**，通过请求参数动态配置。

## 功能

- **多卖家支持**：单服务通过 `sellerConfig` 参数支持 N 个卖家身份
- **多种风格**：支持 `aggressive`（强势）、`pro`（专业）、`friendly`（热情）三种销售风格
- **智能报价**：根据砍价轮次动态调整报价，有底价保护
- **LLM 增强**：使用 Qwen 等大模型生成自然对话，失败时自动降级到模板
- **成交确认**：通过 `prepare_deal` 接口分析聊天记录确定最终成交价

## 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/seller/chat` | POST | 砍价对话，返回回复和报价 |
| `/api/seller/prepare_deal` | POST | 分析聊天记录，确认成交价格 |
| `/health` | GET | 健康检查 |

---

## 快速启动

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 LLM API Key

# 2. 启动服务
pnpm dev  # 默认端口 8081
```

**注意**：单个服务实例即可支持多个卖家身份，通过请求中的 `sellerConfig` 参数区分不同卖家。

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `8081` |
| `SELLER_ID` | 卖家标识 | `seller-agent` |
| `SELLER_NAME` | 显示名称 | `卖家 Agent` |
| `SELLER_STYLE` | 销售风格 | `pro` |
| `MIN_PRICE_FACTOR` | 最低价格系数（相对标价） | `0.80` |
| `MAX_DISCOUNT_PER_ROUND` | 每轮最大降价幅度 | `0.06` |
| `MODEL` | LLM 模型 | `qwen-plus` |
| `LLM_API_KEY` | Qwen API Key | - |
| `LLM_BASE_URL` | API 地址 | DashScope |

---

## 销售风格

| 风格 | 特点 |
|------|------|
| `aggressive` | 强势，坚持高价，降价幅度小 |
| `pro` | 专业，平衡价格和成交率 |
| `friendly` | 热情，更愿意让步促成交易 |

---

## API 示例

### POST /api/seller/chat

```bash
curl -X POST http://localhost:8081/api/seller/chat \
  -H "content-type: application/json" \
  -d '{
    "sessionId": "session-123",
    "round": 1,
    "buyerMessage": "这个价格有点贵，能便宜点吗？",
    "store": { "id": "store-1", "name": "Polyguns 军械库" },
    "product": { "id": "weapon-1", "name": "量子之剑", "priceUSDC": "0.50" },
    "sellerConfig": {
      "name": "军械库客服小王",
      "style": "aggressive",
      "minPriceFactor": 0.85
    }
  }'
```

响应：
```json
{
  "ok": true,
  "sellerId": "seller-agent",
  "sellerName": "军械库客服小王",
  "reply": "这把量子之剑品质上乘，0.48 USDC 已经是很优惠的价格了！\n报价: 0.48 USDC",
  "quotePriceUSDC": "0.48"
}
```

### POST /api/seller/prepare_deal

```bash
curl -X POST http://localhost:8081/api/seller/prepare_deal \
  -H "content-type: application/json" \
  -d '{
    "sessionId": "session-123",
    "transcript": [
      { "speaker": "buyer", "content": "0.42 成交！" },
      { "speaker": "seller", "content": "好的，成交！" }
    ],
    "product": { "id": "weapon-1", "name": "量子之剑", "listPriceUSDC": "0.50" },
    "store": { "id": "store-1", "name": "Polyguns 军械库" }
  }'
```

响应：
```json
{
  "ok": true,
  "dealReady": true,
  "sellerId": "seller-agent-a",
  "sellerName": "卖家 Agent A",
  "deal": {
    "productId": "weapon-1",
    "productName": "量子之剑",
    "storeId": "store-1",
    "storeName": "Polyguns 军械库",
    "listPriceUSDC": "0.50",
    "finalPriceUSDC": "0.42",
    "discount": 16
  }
}
```

---

## 与 Agent Hub 集成

Seller Agent 作为单一服务运行，由 Agent Hub 协调，通过 `sellerConfig` 支持多个卖家身份：

```
Agent Hub (8080)
     │
     ├── /api/seller/chat ──────→  Seller Agent Service
     │   + sellerConfig: 卖家 A         │
     │                                  └── 返回卖家 A 的报价
     │
     ├── /api/seller/chat ──────→  Seller Agent Service
     │   + sellerConfig: 卖家 B         │
     │                                  └── 返回卖家 B 的报价
     │
     └── /api/seller/prepare_deal ──→  Seller Agent Service
         + sellerConfig: 成交卖家        │
                                        └── 确认成交价
```

---

## LLM 配置

使用 OpenAI 兼容的 LLM API（如 Qwen）进行自然语言生成：

```env
MODEL=qwen3-max
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

启动时会自动测试 LLM 连接：

```
[seller-agent] 测试 LLM 连接... (model: qwen3-max)
[seller-agent] ✅ LLM 连接成功，响应: "OK"
[seller-agent] listening on http://localhost:8081
```

如果 LLM 不可用，自动降级到模板模式：

```
[seller-agent] LLM 未配置，使用固定话术模式
```

### sellerConfig 参数

每个请求可以携带 `sellerConfig` 来指定卖家身份：

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | 卖家客服名称 |
| `style` | string | 砍价风格：aggressive / pro / friendly |
| `minPriceFactor` | number | 最低价格系数（0.7 = 最低 7 折） |
| `maxDiscountPerRound` | number | 每轮最大降价幅度 |
