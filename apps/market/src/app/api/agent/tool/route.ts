import { ethers } from "ethers";
import { z } from "zod";
import { encodeBase64Url } from "@/lib/base64url";
import { STORES } from "@/lib/catalog";
import { createDeal, type Deal } from "@/lib/deal";
import { scoreText } from "@/lib/textScore";
import { getSessionFromRequest, isAuthRequired } from "@/lib/agentAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoMode = "testnet" | "simulate";

type SerializedDeal = {
  dealId: string;
  buyer: string;
  sellerBase: string;
  polygonEscrow: string;
  nft: string;
  tokenId: string;
  price: string;
  deadline: string;
};

function serializeDeal(deal: Deal): SerializedDeal {
  return {
    ...deal,
    tokenId: deal.tokenId.toString(),
    price: deal.price.toString(),
    deadline: deal.deadline.toString(),
  };
}

function requireAuthIfEnabled(req: Request) {
  if (!isAuthRequired()) return { ok: true as const, session: null as ReturnType<typeof getSessionFromRequest> };
  const session = getSessionFromRequest(req);
  if (!session) return { ok: false as const, error: "Unauthorized" };
  return { ok: true as const, session };
}

export async function GET(req: Request) {
  const auth = requireAuthIfEnabled(req);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: 401 });

  return Response.json({
    ok: true,
    authRequired: isAuthRequired(),
    tools: [
      {
        name: "search_stores",
        description: "Search stores in the marketplace catalog.",
        args: { query: "string", limit: "number" },
      },
      {
        name: "search_products",
        description: "Search products within a store.",
        args: { storeId: "string", query: "string", limit: "number" },
      },
      {
        name: "prepare_deal",
        description: "Create a cross-chain settlement deal payload (computes dealId).",
        args: {
          buyer: "address",
          sellerBase: "address",
          polygonEscrow: "address",
          nft: "address",
          tokenId: "number|string",
          priceUSDC: "string",
          deadlineSecondsFromNow: "number",
        },
      },
      {
        name: "settle_deal",
        description: "Returns a settlement SSE URL for a prepared deal.",
        args: { mode: "\"testnet\"|\"simulate\"", deal: "SerializedDeal" },
      },
    ],
  });
}

const BodySchema = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.any()).default({}),
});

export async function POST(req: Request) {
  const auth = requireAuthIfEnabled(req);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const name = parsed.data.name;
  const args = parsed.data.args ?? {};

  try {
    if (name === "search_stores") {
      const query = typeof args.query === "string" ? args.query : "";
      const limitRaw = typeof args.limit === "number" ? args.limit : 5;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 5;

      const scored = STORES.map((store) => {
        const content = `${store.name} ${store.tagline} ${store.location} ${store.categories.join(" ")} ${store.products
          .map((p) => `${p.name} ${p.description} ${p.tags.join(" ")} ${p.highlights.join(" ")}`)
          .join(" ")}`;
        return { store, score: scoreText(content, query) };
      }).sort((a, b) => b.score - a.score);

      return Response.json({
        ok: true,
        result: {
          stores: scored.slice(0, limit).map(({ store }) => ({
            id: store.id,
            name: store.name,
            tagline: store.tagline,
            location: store.location,
            verified: store.verified,
            rating: store.rating,
            orders: store.orders,
            responseMins: store.responseMins,
            categories: store.categories,
            sellerAgentName: store.sellerAgentName,
            hasDemoReady: store.products.some((p) => p.demoReady),
          })),
        },
      });
    }

    if (name === "search_products") {
      const storeId = typeof args.storeId === "string" ? args.storeId : "";
      const query = typeof args.query === "string" ? args.query : "";
      const limitRaw = typeof args.limit === "number" ? args.limit : 5;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 5;

      const store = STORES.find((s) => s.id === storeId);
      if (!store) throw new Error("Unknown storeId");

      const scored = store.products
        .map((product) => {
          const content = `${product.name} ${product.description} ${product.tags.join(" ")} ${product.highlights.join(
            " "
          )}`;
          return { product, score: scoreText(content, query) };
        })
        .sort((a, b) => b.score - a.score);

      return Response.json({
        ok: true,
        result: {
          storeId: store.id,
          products: scored.slice(0, limit).map(({ product }) => ({
            id: product.id,
            name: product.name,
            kind: product.kind,
            description: product.description,
            priceUSDC: product.priceUSDC,
            tokenId: product.tokenId,
            demoReady: product.demoReady,
            inventory: product.inventory,
            leadTime: product.leadTime,
            highlights: product.highlights,
            tags: product.tags,
          })),
        },
      });
    }

    if (name === "prepare_deal") {
      const buyer = typeof args.buyer === "string" ? String(args.buyer) : "";
      const sellerBase = typeof args.sellerBase === "string" ? String(args.sellerBase) : "";
      const polygonEscrow = typeof args.polygonEscrow === "string" ? String(args.polygonEscrow) : "";
      const nft = typeof args.nft === "string" ? String(args.nft) : "";
      const tokenIdRaw = args.tokenId;
      const tokenId =
        typeof tokenIdRaw === "number" || typeof tokenIdRaw === "bigint"
          ? BigInt(tokenIdRaw)
          : typeof tokenIdRaw === "string"
            ? BigInt(tokenIdRaw)
            : undefined;
      const priceUSDC = typeof args.priceUSDC === "string" ? String(args.priceUSDC) : "";
      const deadlineSecondsFromNow = typeof args.deadlineSecondsFromNow === "number" ? args.deadlineSecondsFromNow : 3600;

      if (!ethers.isAddress(buyer)) throw new Error("Invalid buyer address");
      if (!ethers.isAddress(sellerBase)) throw new Error("Invalid sellerBase address");
      if (!ethers.isAddress(polygonEscrow)) throw new Error("Invalid polygonEscrow address");
      if (!ethers.isAddress(nft)) throw new Error("Invalid nft address");
      if (tokenId === undefined) throw new Error("Invalid tokenId");
      if (!priceUSDC) throw new Error("Missing priceUSDC");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, deadlineSecondsFromNow));
      const dealParams = {
        buyer: ethers.getAddress(buyer),
        sellerBase: ethers.getAddress(sellerBase),
        polygonEscrow: ethers.getAddress(polygonEscrow),
        nft: ethers.getAddress(nft),
        tokenId,
        price: ethers.parseUnits(priceUSDC, 6),
        deadline,
      } as const;
      const deal = createDeal(dealParams);
      const serialized = serializeDeal(deal);

      return Response.json({
        ok: true,
        result: {
          deal: serialized,
          dealId: deal.dealId,
          deadlineISO: new Date(Number(deal.deadline) * 1000).toISOString(),
        },
      });
    }

    if (name === "settle_deal") {
      const mode: DemoMode = args.mode === "testnet" ? "testnet" : "simulate";
      const deal = args.deal as SerializedDeal | undefined;
      if (!deal || typeof deal !== "object") throw new Error("Missing deal");
      if (!deal.dealId) throw new Error("Missing deal.dealId");

      const encoded = encodeBase64Url(JSON.stringify(deal));
      const streamUrl = `/api/settle/stream?mode=${mode}&deal=${encoded}`;

      return Response.json({
        ok: true,
        result: {
          streamUrl,
          sseEvents: ["step", "log", "done", "error"],
        },
      });
    }

    return Response.json({ ok: false, error: "Unknown tool name" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
