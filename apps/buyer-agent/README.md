# Buyer Agent Service

独立的 Buyer Agent 服务，代表用户执行购买操作。

## 功能

- **砍价策略**：根据配置的策略自动出价
- **预算管理**：控制单笔和每日消费限额
- **钱包签名**：代表用户签署跨链交易

## 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/negotiate` | POST | 砍价对话，返回出价建议 |
| `/sign` | POST | 签署交易（生成签名） |
| `/config` | GET | 获取 Agent 配置 |
| `/health` | GET | 健康检查 |

---

## 快速启动

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入钱包私钥和预算设置

# 2. 启动服务
pnpm buyer:dev  # 默认端口 8083
```

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `8083` |
| `AGENT_NAME` | Agent 名称 | `Demo Buyer Agent` |
| `BUYER_PRIVATE_KEY` | 买家钱包私钥 | - |
| `DAILY_BUDGET_USDC` | 每日预算 (USDC) | `100` |
| `MAX_PER_DEAL_USDC` | 单笔限额 (USDC) | `10` |
| `STRATEGY` | 砍价策略 | `adaptive` |
| `AGGRESSIVENESS` | 砍价激进程度 (0-1) | `0.5` |

---

## 砍价策略

| 策略 | 说明 |
|------|------|
| `conservative` | 保守出价，优先成交 |
| `aggressive` | 激进砍价，追求低价 |
| `adaptive` | 自适应，根据卖家回应调整 |

---

## API 示例

### POST /negotiate

```bash
curl -X POST http://localhost:8083/negotiate \
  -H "content-type: application/json" \
  -d '{
    "productId": "p-1",
    "productName": "量子之剑",
    "listPrice": "0.5",
    "sellerOffer": "0.45",
    "round": 2
  }'
```

响应：
```json
{
  "action": "counter",
  "offer": "0.40",
  "message": "这个价格有点高，能再便宜点吗？"
}
```

### POST /sign

```bash
curl -X POST http://localhost:8083/sign \
  -H "content-type: application/json" \
  -d '{
    "dealId": "0x...",
    "buyer": "0x...",
    "sellerBase": "0x...",
    "nft": "0x...",
    "tokenId": "2",
    "priceUSDC": "0.40"
  }'
```

响应：
```json
{
  "signature": "0x...",
  "signer": "0x..."
}
```

### GET /config

```bash
curl http://localhost:8083/config
```

响应：
```json
{
  "name": "Demo Buyer Agent",
  "address": "0x...",
  "budget": {
    "daily": 100,
    "remaining": 95.5,
    "maxPerDeal": 10
  },
  "strategy": "adaptive"
}
```

---

## 与 Agent Hub 集成

Buyer Agent 作为独立服务运行，由 Agent Hub 调用：

```
Agent Hub (8080)
     │
     ├── /negotiate  ──→  Buyer Agent (8083)
     │                        │
     │                        └── 返回出价
     │
     └── /sign       ──→  Buyer Agent (8083)
                              │
                              └── 返回签名
```

在 Agent Hub 的 `.env` 中配置：
```
BUYER_AGENT_URL=http://localhost:8083
```

---

## 自托管

用户可以自托管 Buyer Agent，连接自己的钱包：

1. 克隆项目
2. 配置 `BUYER_PRIVATE_KEY`（你的钱包私钥）
3. 设置预算限额
4. 运行服务
5. 告诉 Agent Hub 你的 Buyer Agent URL

这样，AI 代购将使用你自己的钱包和预算。
