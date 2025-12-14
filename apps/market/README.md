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

