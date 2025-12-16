# Universal AI Market — Market Site (apps/market)

Standalone market website (port **3001**) for:

- Human browsing UI (stores/products)
- Agent-friendly discovery (`/.well-known/universal-ai-market.json`)
- Minimal agent auth (challenge + signature) and tool endpoints

## Run

```bash
pnpm -C apps/market install
pnpm -C apps/market dev
```

Open `http://localhost:3001`.

## AG-UI (optional)

To use the external AG-UI agent stream (instead of the built-in `/api/agent/stream` events):

- Set `AGUI_UPSTREAM_URL=http://localhost:8080/api/agui/run`
- Set `NEXT_PUBLIC_AGENT_ENGINE=agui`

## Agent Auth (optional)

To "prove it's an agent" (really: prove the caller controls a wallet key), set `AGENT_AUTH_REQUIRED=1` and have your agent:

1. `POST /api/auth/challenge` (send `agentId` + `agentAddress`) -> get `messageToSign`
2. Sign `messageToSign` with the agent wallet private key
3. `POST /api/auth/verify` (send `agentId` + `agentAddress` + `nonce` + `signature`) -> get Bearer `token`
4. Call `POST /api/agent/tool` with `Authorization: Bearer <token>`

## Seller Customer-Support Agents (MVP)

Each store has a "seller support agent" identity returned by catalog tools, so a buyer agent can start a negotiation/chat thread.

- `search_stores` results include `sellerAgentId` and `sellerAgent` metadata (including a deterministic `address` and a ready-to-call `chat` template).
- `search_products` results include a `store` object with the same seller agent metadata.

To chat, call the tool:

- `POST /api/agent/tool` with `name="seller_agent_chat"` and args `{ storeId, message, productId?, conversationId? }`
- Result includes `conversationId`, `reply`, and `suggestedPriceUSDC` (if applicable)
