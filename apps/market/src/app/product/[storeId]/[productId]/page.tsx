import Link from "next/link";
import { notFound } from "next/navigation";
import { STORES } from "@/lib/catalog";

export default function ProductPage({ params }: { params: { storeId: string; productId: string } }) {
  const store = STORES.find((s) => s.id === params.storeId);
  const product = store?.products.find((p) => p.id === params.productId);
  if (!store || !product) return notFound();

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/store/${store.id}`} className="text-xs text-white/50 hover:text-white/70">
            ← 返回店铺
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">{product.name}</h1>
          <p className="mt-2 text-sm text-white/60">{product.description}</p>
        </div>
        <Link
          className="glass-panel rounded-lg px-3 py-1.5 text-sm text-white/80 hover:text-white"
          href="/agent"
        >
          Agent 接入
        </Link>
      </header>

      <section className="mt-6 glass-panel rounded-2xl p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-white/50">店铺</div>
            <div className="text-sm text-white/85">{store.name}</div>
          </div>
          <div>
            <div className="text-xs text-white/50">价格</div>
            <div className="text-sm text-white/85">{product.priceUSDC} USDC</div>
          </div>
          <div>
            <div className="text-xs text-white/50">交付</div>
            <div className="text-sm text-white/85">{product.leadTime}</div>
          </div>
          <div>
            <div className="text-xs text-white/50">Demo</div>
            <div className="text-sm text-white/85">{product.demoReady ? "Testnet/Sim" : "Sim Only"}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-white/50">亮点</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.highlights.map((h) => (
              <span
                key={h}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/50">
          <div className="font-medium text-white/70">Agent-friendly</div>
          <div className="mt-1">
            Agent 可以通过工具接口搜索/生成 Deal：<code className="font-mono text-white/70">POST /api/agent/tool</code>
          </div>
        </div>
      </section>
    </main>
  );
}

