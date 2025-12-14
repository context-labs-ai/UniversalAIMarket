# Universal AI Market — External Agent (LangChain)

This service exposes an SSE endpoint compatible with the frontend proxy mode:

- `GET /api/agent/stream` (SSE)
- `POST /api/agent/action` (confirm-mode continuation)

It calls the web app tool bridge:

- `POST {WEB_BASE_URL}/api/agent/tool`
- `GET {WEB_BASE_URL}/api/config`

## Run

1. Copy `apps/agent/.env.example` to `apps/agent/.env`
2. Install deps: `pnpm -C apps/agent install`
3. Start agent: `pnpm -C apps/agent dev`

In the web UI, set:

- Agent 引擎 = `API 代理`
- API Endpoint = `http://localhost:8080/api/agent/stream`
