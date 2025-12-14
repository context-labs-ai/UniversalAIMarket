import Link from "next/link";
import { STORES } from "@/lib/catalog";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Universal AI Market</h1>
          <Link
            className="glass-panel rounded-lg px-3 py-1.5 text-sm text-white/80 hover:text-white"
            href="/agent"
          >
            Agent 接入
          </Link>
        </div>
        <p className="text-sm text-white/60">
          这是独立 Market 站点（端口 3001）：人类可浏览，Agent 可通过 discovery/auth/tools 接入。
        </p>
      </header>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-medium text-white/90">精选店铺</h2>
          <div className="text-xs text-white/50">
            discovery:{" "}
            <code className="font-mono text-white/70">/.well-known/universal-ai-market.json</code>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STORES.map((store) => (
            <Link
              key={store.id}
              href={`/store/${store.id}`}
              className="glass-panel rounded-2xl p-4 transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white/90">{store.name}</div>
                  <div className="mt-1 text-sm text-white/60">{store.tagline}</div>
                </div>
                {store.verified ? (
                  <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                    Verified
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/50">
                    New
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {store.categories.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/55">
                <div>评分：{store.rating.toFixed(1)}</div>
                <div>订单：{store.orders}</div>
                <div>响应：{store.responseMins}m</div>
                <div className="truncate">Agent：{store.sellerAgentName}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-10 text-xs text-white/45">
        <div>
          提示：黑客松 MVP 推荐同时运行 `apps/web`（评委可视化 Demo）与 `apps/agent`（LangChain Agent），
          本站负责 market + agent APIs。
        </div>
      </footer>
    </main>
  );
}

