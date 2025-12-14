import Link from "next/link";

const curlChallenge = `curl -s http://localhost:3001/api/auth/challenge \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"buyer-agent-001","agentAddress":"0xYOUR_ADDRESS"}'`;

const curlVerify = `curl -s http://localhost:3001/api/auth/verify \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"buyer-agent-001","agentAddress":"0xYOUR_ADDRESS","nonce":"<nonce>","signature":"<signature>"}'`;

const curlTools = `curl -s http://localhost:3001/api/agent/tool \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"name":"search_stores","args":{"query":"武器","limit":5}}'`;

export default function AgentPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/" className="text-xs text-white/50 hover:text-white/70">
            ← 返回市场
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">Agent 接入（MVP）</h1>
          <p className="mt-2 text-sm text-white/60">
            目标：让 Agent 通过 discovery + 握手认证拿到专用接口（tools/settlement）。
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <div className="text-sm font-medium text-white/90">1) Discovery</div>
          <div className="mt-2 text-sm text-white/65">
            <code className="font-mono text-white/80">GET /.well-known/universal-ai-market.json</code>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="text-sm font-medium text-white/90">2) Auth（挑战-签名）</div>
          <div className="mt-2 text-xs text-white/55">
            当前为黑客松 MVP：默认不强制（由 env `AGENT_AUTH_REQUIRED` 控制），但接口已就绪。
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
            <code>{curlChallenge}</code>
          </pre>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
            <code>{curlVerify}</code>
          </pre>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="text-sm font-medium text-white/90">3) Tools</div>
          <div className="mt-2 text-sm text-white/65">
            <code className="font-mono text-white/80">GET/POST /api/agent/tool</code>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
            <code>{curlTools}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}

