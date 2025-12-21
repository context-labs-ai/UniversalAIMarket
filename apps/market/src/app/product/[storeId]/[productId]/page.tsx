import Link from "next/link";
import { notFound } from "next/navigation";
import { findProductById } from "@/lib/catalogMerge";
import { CartButton } from "@/components/CartButton";
import { AddToCartButton } from "./AddToCartButton";

function getInventoryStatus(status: string) {
  switch (status) {
    case "in_stock":
      return { label: "有货", color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
    case "limited":
      return { label: "限量", color: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
    case "preorder":
      return { label: "预售", color: "text-indigo-300 bg-indigo-500/10 border-indigo-500/30" };
    default:
      return { label: "未知", color: "text-white/50 bg-white/5 border-white/10" };
  }
}

function getProductEmoji(kind: string, name: string) {
  if (kind === "physical") return "📦";
  if (name.includes("剑") || name.includes("武器")) return "⚔️";
  if (name.includes("枪")) return "🔫";
  if (name.includes("盾")) return "🛡️";
  if (name.includes("咖啡")) return "☕";
  if (name.includes("艺术") || name.includes("海报")) return "🎨";
  if (name.includes("API") || name.includes("工具")) return "🔧";
  return "🎮";
}

type PageProps = {
  params: Promise<{ storeId: string; productId: string }>;
};

export default async function ProductPage({ params }: PageProps) {
  const { storeId, productId } = await params;
  const result = findProductById(storeId, productId);

  if (!result) return notFound();

  const { store, product } = result;
  const inventory = getInventoryStatus(product.inventory);
  const emoji = getProductEmoji(product.kind, product.name);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/store/${store.id}`} className="text-xs text-white/50 hover:text-white/70">
            ← 返回店铺
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">{product.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <CartButton />
          <Link
            className="glass-panel rounded-lg px-3 py-1.5 text-sm text-white/80 hover:text-white"
            href="/agent"
          >
            Agent 接入
          </Link>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass-panel flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10">
          <span className="text-8xl">{emoji}</span>
        </div>

        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-white/90">{product.priceUSDC} USDC</div>
                <div className="mt-1 text-xs text-white/50">Token ID: #{product.tokenId}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${inventory.color}`}
                >
                  {inventory.label}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {product.kind === "digital" ? "数字商品" : "实物商品"}
                </span>
                {product.isDynamic && (
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
                    动态商品
                  </span>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm text-white/60 leading-relaxed">{product.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(product.highlights || []).map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60"
                >
                  {h}
                </span>
              ))}
            </div>

            <div className="mt-6 grid gap-3">
              <AddToCartButton
                storeId={store.id}
                storeName={store.name}
                productId={product.id}
                productName={product.name}
                priceUSDC={product.priceUSDC}
                tokenId={product.tokenId}
                kind={product.kind}
              />
              <Link
                href="/cart"
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/10"
              >
                查看购物车
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <h3 className="text-sm font-medium text-white/80">商品信息</h3>
            <div className="mt-3 grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">店铺</span>
                <Link href={`/store/${store.id}`} className="text-white/80 hover:text-white">
                  {store.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">交付时间</span>
                <span className="text-white/80">{product.leadTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Demo 状态</span>
                <span className={product.demoReady ? "text-emerald-300" : "text-white/50"}>
                  {product.demoReady ? "Testnet Ready" : "Simulate Only"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">卖家 Agent</span>
                <span className="text-white/80">{store.sellerAgentName}</span>
              </div>
              {product.nftConfig && (
                <>
                  <div className="flex justify-between">
                    <span className="text-white/50">链</span>
                    <span className="text-white/80">{product.nftConfig.chain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">合约地址</span>
                    <span className="text-white/80 font-mono text-xs">
                      {product.nftConfig.contractAddress.slice(0, 6)}...{product.nftConfig.contractAddress.slice(-4)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <h3 className="text-sm font-medium text-white/80">标签</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(product.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6 glass-panel rounded-2xl p-5">
        <div className="text-xs text-white/50">
          <div className="font-medium text-white/70">Agent-friendly</div>
          <div className="mt-1">
            Agent 可以通过工具接口搜索/生成 Deal：
            <code className="ml-1 font-mono text-white/70">POST /api/agent/tool</code>
          </div>
        </div>
      </section>
    </main>
  );
}
