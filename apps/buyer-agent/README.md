# Buyer Agent Service

Buyer Agent 服务，代表用户执行购买操作。

**注意**：在 Universal AI Market 中，Buyer Agent 有两种运行模式：

1. **浏览器端模式**（推荐）：用户在前端配置钱包私钥，私钥仅存于浏览器内存，从不发送到服务器
2. **外部服务模式**：运行独立的 Buyer Agent 服务，适合自托管场景

本目录是外部服务模式的实现，供高级用户自托管使用。

## 功能

- **砍价策略**：根据配置的策略自动出价
- **预算管理**：控制单笔和每日消费限额
- **钱包签名**：使用 EIP-712 结构化签名进行跨链交易授权

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

## 运行模式对比

| 特性 | 浏览器端模式 | 外部服务模式 |
|------|-------------|-------------|
| 私钥存储 | 浏览器内存（更安全） | 服务器 .env 文件 |
| 签名位置 | 用户浏览器 | 外部服务 |
| 适用场景 | 普通用户 | 自托管 / 企业级 |
| 配置方式 | 前端 Buyer Agent 标签页 | .env 文件 |

## 浏览器端模式（推荐）

大多数用户应使用浏览器端模式：

1. 打开 Market 前端 (http://localhost:3001)
2. 在右侧边栏选择 "Buyer Agent" 标签页
3. 配置：
   - 钱包私钥（仅存于浏览器内存）
   - 预算
   - 购物目标
   - 砍价策略
   - 支付链
4. 点击 "保存配置"

私钥从不发送到服务器，所有签名操作在浏览器端完成。

## 外部服务模式（自托管）

高级用户可以自托管 Buyer Agent 服务：

1. 克隆项目
2. 配置 `BUYER_PRIVATE_KEY`（你的钱包私钥）
3. 设置预算限额
4. 运行服务：`pnpm dev`
5. 在 Agent Hub 的 `.env` 中配置：`BUYER_AGENT_URL=http://your-host:8083`

这样，AI 代购将使用你自托管的 Buyer Agent 进行签名。
