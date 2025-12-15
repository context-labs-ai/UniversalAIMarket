import Link from "next/link";
import { notFound } from "next/navigation";
import { STORES } from "@/lib/catalog";

type PageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function StorePage({ params }: PageProps) {
  const { storeId } = await params;
  const store = STORES.find((s) => s.id === storeId);
  if (!store) return notFound();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/" className="text-xs text-white/50 hover:text-white/70">
            ← 返回市场
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">{store.name}</h1>
          <p className="mt-2 text-sm text-white/60">{store.tagline}</p>
          <div className="mt-2 text-xs text-white/50">
            卖家 Agent：<span className="text-white/70">{store.sellerAgentName}</span>
          </div>
        </div>
        <Link
          className="glass-panel rounded-lg px-3 py-1.5 text-sm text-white/80 hover:text-white"
          href="/agent"
        >
          Agent 接入
        </Link>
      </header>

      <section className="mt-6">
        <h2 className="text-base font-medium text-white/90">商品</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.products.map((p) => (
            <Link
              key={p.id}
              href={`/product/${store.id}/${p.id}`}
              className="glass-panel rounded-2xl p-4 transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-semibold text-white/90">{p.name}</div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {p.kind === "digital" ? "数字" : "实物"}
                </span>
              </div>
              <div className="mt-2 text-sm text-white/60 line-clamp-3">{p.description}</div>
              <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                <span>价格：{p.priceUSDC} USDC</span>
                <span className="text-white/45">{p.demoReady ? "DemoReady" : "SimOnly"}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.highlights.slice(0, 3).map((h) => (
                  <span
                    key={h}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

