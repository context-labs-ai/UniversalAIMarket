import { Suspense } from "react";
import Link from "next/link";
import { getAllStores } from "@/lib/catalogMerge";
import { SearchBar } from "@/components/SearchBar";
import { CategoryFilter } from "@/components/CategoryFilter";

type PageProps = {
  searchParams: Promise<{ category?: string }>;
};

function getCategoryList(stores: ReturnType<typeof getAllStores>) {
  const categoryMap = new Map<string, number>();
  for (const store of stores) {
    for (const category of store.categories) {
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }
  }
  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { category } = await searchParams;

  const allStores = getAllStores();
  const filteredStores = category
    ? allStores.filter((store) => store.categories.includes(category))
    : allStores;

  // Prepare data for client components
  const categories = getCategoryList(allStores);
  const searchStores = allStores.map((store) => ({
    id: store.id,
    name: store.name,
    tagline: store.tagline,
    categories: store.categories,
    verified: store.verified,
    products: store.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceUSDC: p.priceUSDC,
      tags: p.tags,
    })),
  }));

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      {/* 搜索栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <SearchBar stores={searchStores} />
        <div className="text-xs text-white/50 shrink-0">
          <code className="font-mono text-white/70">/.well-known/universal-ai-market.json</code>
        </div>
      </div>

      <section>
        <Suspense fallback={<div className="h-10" />}>
          <CategoryFilter categories={categories} currentCategory={category} />
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
              <div className="shrink-0 w-24 self-stretch rounded-xl bg-gradient-to-br from-[#d4a574]/20 to-[#c8d86a]/10 border border-[#d4a574]/20 flex items-center justify-center min-h-[120px] overflow-hidden">
                {store.imageUrl ? (
                  <img
                    src={store.imageUrl}
                    alt={store.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-semibold text-[#d4a574]/80">
                    {store.name.charAt(0)}
                  </span>
                )}
              </div>

              {/* 右侧内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-base font-semibold text-white/90">{store.name}</div>
                  {store.verified ? (
                    <span className="shrink-0 rounded-full border border-[#c8d86a]/30 bg-[#c8d86a]/10 px-2 py-0.5 text-[10px] text-[#c8d86a]">
                      Verified
                    </span>
                  ) : store.isDynamic ? (
                    <span className="shrink-0 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200">
                      动态
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
