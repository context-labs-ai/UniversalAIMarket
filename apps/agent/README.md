# Universal AI Market - External Agent (LangChain)

`apps/agent` 是一个外部 Agent 服务示例：

- 对前端输出 SSE 事件流（聊天 / 工具调用 / 时间线）
- 通过 HTTP 调用 `apps/market` 的 API 来完成“逛店 / 选品 / 生成 deal / 结算”等动作

## 这些 API 和 “AI Tool” 的关系是什么？

这些都是 **market 后端提供的 HTTP API**。在 Agent 里，你可以把它们封装为 LLM Tools（或普通函数）。

- `POST /api/auth/challenge`：鉴权流程第 1 步，返回要签名的 challenge（不是业务 tool）
- `POST /api/auth/verify`：鉴权流程第 2 步，提交 address + signature 换 token（不是业务 tool）
- `GET /api/agent/tool`：返回工具清单（tool schema）
- `POST /api/agent/tool`：执行工具（body: `{ "name": "...", "args": { ... } }`）

## 卖家客服 Agent（用于聊天/砍价）

你的设想是对的：每个店铺都有一个“卖家客服 Agent”作为对话对象。现在 `apps/market` 已经支持：

- `search_stores` 会返回 `sellerAgentId` 和 `sellerAgent`（包含 `id/name/address/chatEndpoint/chat`）
- `search_products` 会在返回里带 `store.sellerAgent*`

你可以用这些字段把“选店铺/选商品”和“发起聊天”连起来：

1. 先 `search_stores`/`search_products` 拿到 `storeId`
2. 再调用 `seller_agent_chat`：
   - endpoint：`POST {WEB_BASE_URL}/api/agent/tool`
   - body：`{ "name":"seller_agent_chat", "args": { "storeId":"...", "message":"...", "productId": "...?", "conversationId": "...?" } }`
3. 返回：`conversationId`（用于续聊）、`reply`（卖家回复）、`suggestedPriceUSDC`（砍价建议，若有）

说明：目前 `seller_agent_chat` 是 rule-based 的 MVP（为了 hackathon 稳定演示），后续你可以替换成真正的“第二个 LLM 卖家 Agent”并保持同样的 tool 形状。

## Agent <-> Market 的时序（MVP）

### A) 不开启鉴权（AGENT_AUTH_REQUIRED=0）

1. Agent 发现能力：`GET /.well-known/universal-ai-market.json`
2. 拉取工具列表：`GET /api/agent/tool`
3. 执行工具：`POST /api/agent/tool`（search -> seller_agent_chat -> prepare_deal -> settle_deal）
4. 订阅结算进度：`GET /api/settle/stream`（SSE）
5. 前端订阅 Agent 事件流：`GET /api/agent/stream`（SSE，由本服务 `apps/agent` 提供）

### B) 开启鉴权（AGENT_AUTH_REQUIRED=1）

1. `POST /api/auth/challenge` -> 得到 challenge 文本 / nonce
2. Agent 用钱包私钥签名 challenge
3. `POST /api/auth/verify` -> 换取 Bearer token
4. 后续 `POST /api/agent/tool` 需要带 `Authorization: Bearer <token>`

## curl 示例（直接调用 market）

假设 market 在 `http://localhost:3001`（Windows PowerShell 建议用 `curl.exe`，避免 `curl` 被当成 `Invoke-WebRequest` 别名）。

```powershell
# 0) 发现文档（告诉 Agent 该怎么对接）
curl.exe http://localhost:3001/.well-known/universal-ai-market.json

# 1) 查看 market 支持哪些工具
curl.exe http://localhost:3001/api/agent/tool

# 2) 执行工具：搜索店铺
curl.exe -X POST http://localhost:3001/api/agent/tool `
  -H "content-type: application/json" `
  -d "{\"name\":\"search_stores\",\"args\":{\"query\":\"酷炫\",\"limit\":3}}"

# 3) 执行工具：在店铺内搜索商品（storeId 用上一步返回的 id）
curl.exe -X POST http://localhost:3001/api/agent/tool `
  -H "content-type: application/json" `
  -d "{\"name\":\"search_products\",\"args\":{\"storeId\":\"neo-garage\",\"query\":\"NFT\",\"limit\":5}}"

# 4) 执行工具：准备 deal（注意：address 必须是合法 0x 地址）
curl.exe -X POST http://localhost:3001/api/agent/tool `
  -H "content-type: application/json" `
  -d "{\"name\":\"prepare_deal\",\"args\":{\"buyer\":\"0x0000000000000000000000000000000000000001\",\"sellerBase\":\"0x0000000000000000000000000000000000000002\",\"polygonEscrow\":\"0x0000000000000000000000000000000000000003\",\"nft\":\"0x0000000000000000000000000000000000000004\",\"tokenId\":\"1\",\"priceUSDC\":\"9.99\",\"deadlineSecondsFromNow\":900}}"

# 5) 订阅内置 Agent SSE（用于看事件流/调试）
curl.exe -N -H "accept: text/event-stream" "http://localhost:3001/api/agent/stream?engine=builtin&mode=simulate&checkoutMode=auto"
```

## 本服务（apps/agent）对外暴露的接口

- `GET /api/agent/stream`（SSE）：给前端（或其它观察者）订阅 Agent 过程事件流
- `POST /api/agent/run`：从终端/脚本触发一次运行，返回 `sessionId`，随后用 `GET /api/agent/stream?sessionId=...` 订阅“总聊天室 + 时间线”
- `POST /api/agent/action`：confirm 模式下用于继续（例如 `{ sessionId, action: "confirm_settlement" }`）
- `POST /api/agui/run`（AG-UI）：返回 `text/event-stream`，`data:` 为 AG-UI 事件 JSON（可用 `@ag-ui/client` 的 `HttpAgent` 直连）

## 运行

1. 复制 `apps/agent/.env.example` 到 `apps/agent/.env`
   - 建议：`WEB_BASE_URL=http://localhost:3001`（apps/market）
   - 如果 `apps/market` 设置了 `AGENT_AUTH_REQUIRED=1`，还需要设置：`AGENT_ID` + `AGENT_PRIVATE_KEY`（用于签名登录）
2. 安装依赖：`pnpm -C apps/agent install`
3. 启动：`pnpm -C apps/agent dev`

在前端（`apps/market`）里选择代理模式：

- Agent 引擎：`API 代理`
- API Endpoint：`http://localhost:8080/api/agent/stream`

## 多 Agent 真对话（buyer + 2 sellers）

本服务支持一个“多 Agent 互聊”演示流：
- 买家 Agent 在本服务（hub）里运行
- 两个卖家客服 Agent 作为**独立服务**运行（只负责聊天 + 报价）

### 1) 启动 2 个 Seller Agent 服务
见：`apps/seller-agent/README.md`

默认可用：
- `http://localhost:8081/api/seller/chat`
- `http://localhost:8082/api/seller/chat`

在 `apps/agent/.env` 里配置：
- `SELLER_AGENT_A_URL=http://localhost:8081/api/seller/chat`
- `SELLER_AGENT_B_URL=http://localhost:8082/api/seller/chat`

### 2) 终端触发运行 -> 网页观战（总聊天室）

```powershell
# 触发一次 session（返回 sessionId）
pnpm agent:cli -- run --scenario multi --mode simulate --checkout confirm --goal "帮我买一个 100 USDC 内的酷炫商品"

# 网页：打开 market（http://localhost:3001）
# 右侧 Agent 控制台 -> Agent 引擎=外部 -> upstream=http://localhost:8080/api/agent/stream
# Session ID 粘贴上一步输出 -> 点“观看”
```

### 3) SSE / AG-UI
- SSE（连接即启动）：`GET /api/agent/stream?scenario=multi`
- SSE（观战）：`GET /api/agent/stream?sessionId=...`
- AG-UI：在 `/api/agui/run` 的 `forwardedProps` 里传 `scenario: "multi"`
