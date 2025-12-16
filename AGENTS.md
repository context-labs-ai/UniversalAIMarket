# Repository Guidelines

## Project Structure & Module Organization

- `contracts/` Solidity sources
  - `contracts/zevm/` ZetaChain (ZEVM) "Universal App" contracts (e.g., `UniversalMarket.sol`)
  - `contracts/polygon/` Polygon-side ERC-721 + escrow contracts (e.g., `MockWeaponNFT.sol`, `WeaponEscrow.sol`)
- `scripts/` Hardhat scripts
  - `scripts/deploy/` deployments (localnet + testnets)
  - `scripts/demo/` end-to-end demo flows (e.g., `phase1_demo.ts`)
  - `scripts/utils/` one-off helpers (e.g., funding)
- `types/` shared TypeScript types used by scripts/apps
- Generated (do not hand-edit): `artifacts/`, `cache/`, `typechain-types/`, and `deployed.json` (created by deploy scripts)

## Build, Test, and Development Commands

Use `pnpm` (Node.js >= 18).

- `pnpm install` install dependencies
- `pnpm compile` compile contracts via Hardhat
- `pnpm test` run Hardhat tests (expects `test/` to exist)
- `pnpm test:coverage` run solidity coverage (`solidity-coverage`)
- `pnpm localnet:start` start ZetaChain localnet (requires Foundry/anvil)
- `pnpm deploy:local` deploy to localnet (`--network localhost`)
- `pnpm demo:phase1` run the local end-to-end demo
- `pnpm market:dev` run the market UI (`apps/market`)
- `pnpm market:lint` lint the market app
- `pnpm market:build` build the market app
- `pnpm lint` run ESLint over `.ts`
- `pnpm format` format via Prettier

## Market Site (apps/market)

`apps/market` is a standalone market website (default port **3001**) that focuses on being agent-friendly (discovery/auth/tools) while still offering a human browsing UI.

- Discovery: `GET /.well-known/universal-ai-market.json`
- Auth (MVP): `POST /api/auth/challenge` → `POST /api/auth/verify` (EIP-191 message signature)
- Tools: `GET/POST /api/agent/tool`
- Settlement stream: `GET /api/settle/stream`

## Buyer Agent Hub (apps/agent)

Standalone buyer agent service (LangChain-based) under `apps/agent`. Acts as the hub for multi-agent negotiation.

- Port: **8080**
- SSE entry: `GET /api/agent/stream`
- Run trigger: `POST /api/agent/run`
- Confirm action: `POST /api/agent/action`
- AG-UI entry: `POST /api/agui/run`
- **LLM Startup Test**: Auto-tests LLM connectivity and falls back to templates if unavailable

## Seller Agent Services (apps/seller-agent)

Standalone seller customer-service agents under `apps/seller-agent`. Each instance represents one seller persona.

- Port A: **8081** (aggressive style)
- Port B: **8082** (pro style)
- Endpoint: `POST /api/seller/chat`
- Health: `GET /health` (returns `llmAvailable` status)
- **LLM Startup Test**: Auto-tests LLM connectivity and falls back to templates if unavailable

Run two instances:
```bash
pnpm -C apps/seller-agent dev:a  # Seller A (aggressive)
pnpm -C apps/seller-agent dev:b  # Seller B (pro)
```

### Event protocol stability

Keep these SSE event names stable so the UI and external agents stay compatible:

- `message`, `tool_call`, `tool_result`, `timeline_step`, `state`, `done`, `error`

### Session storage note

`apps/market/src/lib/agentSessions.ts` stores confirmation sessions in-memory (sufficient for local/hackathon demos). If deploying serverless/multi-instance, replace with shared storage.

## Coding Style & Naming Conventions

- TypeScript: 2-space indentation; prefer `camelCase` for variables/functions and `PascalCase` for types/classes.
- Solidity: follow common Solidity conventions (`PascalCase` contracts, `camelCase` functions).
- Keep deploy/demo scripts deterministic and idempotent when possible (safe re-runs on localnet).

## Testing Guidelines

- Framework: Hardhat + Mocha/Chai.
- Put tests under `test/` and name files `*.test.ts` (example: `test/universalMarket.test.ts`).
- Prefer E2E-style tests that validate balances + NFT ownership across the scripted flow.

## Commit & Pull Request Guidelines

- History currently contains a single "Initial Commit"; no established convention yet.
- Use Conventional Commits going forward (`feat:`, `fix:`, `chore:`, `docs:`), and include the chain/module in scope when useful (e.g., `feat(polygon): add escrow checks`).
- PRs: include a short description, how to run (`pnpm ...`), and (when behavior changes) paste relevant console output from scripts/demos.

## Security & Configuration Tips

- Copy `.env.example` to `.env` and set RPC URLs + private keys for testnets.
- Never commit real private keys; `hardhat.config.ts` includes default keys strictly for local testing.
