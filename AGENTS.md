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
- `pnpm web:dev` run the Next.js demo UI (`apps/web`)
- `pnpm web:lint` lint the Next.js app
- `pnpm web:build` build the Next.js app
- `pnpm lint` run ESLint over `.ts`
- `pnpm format` format via Prettier

## Web Agent Demo (apps/web)

The hackathon UI is designed to be "agent-adapted": the frontend consumes a single Agent SSE stream that includes chat + tool calls + cross-chain timeline.

- Agent SSE entry: `apps/web/src/app/api/agent/stream/route.ts`
  - Built-in demo: `GET /api/agent/stream?engine=builtin`
  - Proxy to external LangChain agent: `GET /api/agent/stream?engine=proxy&upstream=http://localhost:8080/api/agent/stream`
- Tool endpoint (for external agents): `apps/web/src/app/api/agent/tool/route.ts`
  - `GET /api/agent/tool` returns tool schema list
  - `POST /api/agent/tool` executes tools (`search_stores`, `search_products`, `prepare_deal`, `settle_deal`)
- Action endpoint (confirm flow): `apps/web/src/app/api/agent/action/route.ts`
  - `POST /api/agent/action` with `{ sessionId, action: "confirm_settlement" }`

## External LangChain Agent (apps/agent)

There is also an optional standalone agent service (for running a LangChain agent on your machine) under `apps/agent`.

- SSE entry: `apps/agent/src/index.ts` (`GET /api/agent/stream`)
- Confirm action: `apps/agent/src/index.ts` (`POST /api/agent/action`)
- It calls the web tool bridge at `apps/web/src/app/api/agent/tool/route.ts`

### Event protocol stability

Keep these SSE event names stable so the UI and external agents stay compatible:

- `message`, `tool_call`, `tool_result`, `timeline_step`, `state`, `done`, `error`

### Session storage note

`apps/web/src/lib/agentSessions.ts` stores confirmation sessions in-memory (sufficient for local/hackathon demos). If deploying serverless/multi-instance, replace with shared storage.

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
