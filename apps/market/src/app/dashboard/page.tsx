import { Suspense } from "react";
import Link from "next/link";
import { STORES } from "@/lib/catalog";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CartButton } from "@/components/CartButton";
import { AgentConnectButton } from "@/components/agent";
import { Logo } from "@/components/Logo";

type PageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const { category } = await searchParams;

  const filteredStores = category
    ? STORES.filter((store) => store.categories.includes(category))
    : STORES;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <h1 className="text-2xl font-semibold tracking-tight">Universal AI Market</h1>
          </div>
          <div className="flex items-center gap-2">
            <AgentConnectButton />
            <CartButton />
            <Link
              className="glass-panel rounded-lg px-3 py-1.5 text-sm text-white/80 hover:text-white"
              href="/agent"
            >
              API 文档
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <SearchBar />
          <div className="text-xs text-white/50 shrink-0">
            <code className="font-mono text-white/70">/.well-known/universal-ai-market.json</code>
          </div>
        </div>
      </header>

      <section className="mt-6">
        <Suspense fallback={<div className="h-10" />}>
          <CategoryFilter currentCategory={category} />
        </Suspense>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-medium text-white/90">
            {category ? `${category} 店铺` : "精选店铺"}
          </h2>
          <span className="text-xs text-white/50">{filteredStores.length} 家店铺</span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStores.map((store) => (
            <Link
              key={store.id}
              href={`/store/${store.id}`}
              className="glass-panel rounded-2xl p-4 transition-all hover:bg-white/[0.05] hover:border-[#d4a574]/20 flex gap-4"
            >
              {/* Avatar - 长方形 */}
              <div className="shrink-0 w-24 self-stretch rounded-xl bg-gradient-to-br from-[#d4a574]/20 to-[#c8d86a]/10 border border-[#d4a574]/20 flex items-center justify-center min-h-[120px]">
                <span className="text-4xl font-semibold text-[#d4a574]/80">
                  {store.name.charAt(0)}
                </span>
              </div>

              {/* 右侧内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-base font-semibold text-white/90">{store.name}</div>
                  {store.verified ? (
                    <span className="shrink-0 rounded-full border border-[#c8d86a]/30 bg-[#c8d86a]/10 px-2 py-0.5 text-[10px] text-[#c8d86a]">
                      Verified
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-white/50">{store.tagline}</div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {store.categories.slice(0, 4).map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/45">
                  <div className="flex items-center gap-1">
                    <span className="text-[#d4a574]">★</span>
                    <span>{store.rating.toFixed(1)}</span>
                  </div>
                  <div>订单：{store.orders}</div>
                  <div>响应：{store.responseMins}m</div>
                  <div className="truncate">Agent：{store.sellerAgentName}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredStores.length === 0 && (
          <div className="mt-10 text-center text-sm text-white/50">
            该分类暂无店铺
          </div>
        )}
      </section>

      <footer className="mt-10 text-xs text-white/45">
        <div>
          Universal AI Market - 跨链 AI 电商平台 |
          点击「启动 Agent」体验全自动购物流程 |
          ZetaChain 跨链结算 + 买卖家 Agent 自动交易
        </div>
      </footer>
    </main>
  );
}

