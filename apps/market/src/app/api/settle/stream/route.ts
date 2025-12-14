import { ethers } from "ethers";
import { decodeBase64Url } from "@/lib/base64url";
import { encodeDealPayload, type Deal } from "@/lib/deal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoMode = "testnet" | "simulate";
type TimelineStatus = "idle" | "running" | "done" | "error";

const GATEWAY_ABI = [
  "function depositAndCall(address receiver, uint256 amount, address asset, bytes payload, tuple(address revertAddress, bool callOnRevert, address abortAddress, bytes revertMessage, uint256 onRevertGasLimit) revertOptions) external",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const ERC721_ABI = ["function ownerOf(uint256) view returns (address)"];

const MARKET_ABI = [
  "event DealReceived(bytes32 indexed dealId, address indexed buyer, uint256 amount, address zrc20)",
  "event PaymentInitiated(bytes32 indexed dealId, address indexed seller, uint256 price)",
  "event ShipmentInitiated(bytes32 indexed dealId, address escrow, address nft, uint256 tokenId, uint256 gasUsed)",
  "event DealProcessed(bytes32 indexed dealId)",
];

const ESCROW_ABI = [
  "event NFTReleased(address indexed nft, uint256 indexed tokenId, address indexed buyer, bytes32 dealId)",
];

function isPresent(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function parseDeal(raw: unknown): Deal {
  if (!raw || typeof raw !== "object") {
    throw new Error("Deal 参数无效");
  }
  const obj = raw as Record<string, unknown>;
  const required = ["dealId", "buyer", "sellerBase", "polygonEscrow", "nft", "tokenId", "price", "deadline"];
  for (const key of required) {
    if (!(key in obj)) throw new Error(`Deal 缺少字段：${key}`);
  }

  return {
    dealId: String(obj.dealId),
    buyer: String(obj.buyer),
    sellerBase: String(obj.sellerBase),
    polygonEscrow: String(obj.polygonEscrow),
    nft: String(obj.nft),
    tokenId: BigInt(String(obj.tokenId)),
    price: BigInt(String(obj.price)),
    deadline: BigInt(String(obj.deadline)),
  };
}

function fakeHash(prefix: string) {
  const rand = ethers.hexlify(ethers.randomBytes(32));
  return ("0x" + prefix + rand.slice(2 + prefix.length)).slice(0, 66);
}

async function pollForEventTxHash({
  contract,
  filter,
  startBlock,
  timeoutMs,
  pollMs,
  signal,
}: {
  contract: ethers.Contract;
  filter: ethers.ContractEventName;
  startBlock: number;
  timeoutMs: number;
  pollMs: number;
  signal: AbortSignal;
}) {
  const deadline = Date.now() + timeoutMs;
  let fromBlock = startBlock;
  while (Date.now() < deadline && !signal.aborted) {
    const runner = contract.runner as unknown as { provider?: ethers.Provider } | ethers.Provider | undefined;
    const provider = (runner && "getBlockNumber" in runner ? runner : runner?.provider) as ethers.Provider | undefined;
    if (!provider) return undefined;

    const latest = await provider.getBlockNumber();
    const events = await contract.queryFilter(filter, fromBlock, latest);
    if (events.length > 0) {
      return events[0].transactionHash;
    }
    fromBlock = latest + 1;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const modeParam = url.searchParams.get("mode");
  const mode: DemoMode = modeParam === "testnet" ? "testnet" : "simulate";
  const dealEncoded = url.searchParams.get("deal");

  if (!dealEncoded) {
    return new Response("缺少 deal 参数", { status: 400 });
  }

  let deal: Deal;
  try {
    const raw = JSON.parse(decodeBase64Url(dealEncoded));
    deal = parseDeal(raw);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Deal 无效", { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: string, data: unknown) => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  const stream = new ReadableStream({
    start(controller) {
      const signal = req.signal;

      (async () => {
        const step = (id: string, patch: { status?: TimelineStatus; detail?: string; txHash?: string }) =>
          send(controller, "step", { id, ...patch });

        const log = (role: "buyer" | "seller" | "system", content: string) => send(controller, "log", { role, content });

        try {
          if (mode === "simulate") {
            log("system", "当前为模拟模式。");
            step("approve", { status: "running", detail: "授权 USDC（模拟）" });
            await new Promise((r) => setTimeout(r, 900));
            step("approve", { status: "done", txHash: fakeHash("a11ce"), detail: "USDC 授权完成" });

            step("deposit", { status: "running", detail: "已提交 depositAndCall（模拟）" });
            await new Promise((r) => setTimeout(r, 1100));
            step("deposit", { status: "done", txHash: fakeHash("depo5"), detail: "付款已提交" });

            step("orchestrate", { status: "running", detail: "UniversalMarket 执行中（模拟）" });
            await new Promise((r) => setTimeout(r, 1100));
            step("orchestrate", { status: "done", txHash: fakeHash("ze7a0"), detail: "卖家已在 Base 收款" });

            step("deliver", { status: "running", detail: "已调用托管释放（模拟）" });
            await new Promise((r) => setTimeout(r, 1100));
            step("deliver", { status: "done", txHash: fakeHash("p0lyg"), detail: "NFT 已在 Polygon 交付" });

            send(controller, "done", { ok: true });
            controller.close();
            return;
          }

          const missing: string[] = [];
          const baseGateway = process.env.BASE_GATEWAY_ADDRESS;
          const baseUSDC = process.env.BASE_USDC_ADDRESS;
          const universalMarket = process.env.ZETA_UNIVERSAL_MARKET;
          const buyerPk = process.env.BUYER_PRIVATE_KEY;

          if (!isPresent(baseGateway)) missing.push("BASE_GATEWAY_ADDRESS");
          if (!isPresent(baseUSDC)) missing.push("BASE_USDC_ADDRESS");
          if (!isPresent(universalMarket)) missing.push("ZETA_UNIVERSAL_MARKET");
          if (!isPresent(buyerPk)) missing.push("BUYER_PRIVATE_KEY");

          if (missing.length > 0) {
            send(controller, "error", `缺少环境变量：${missing.join(", ")}`);
            controller.close();
            return;
          }

          const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
          const polygonRpc = process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology";
          const zetaRpc =
            process.env.ZETA_ATHENS_RPC || "https://zetachain-athens-evm.blockpi.network/v1/rpc/public";

          const baseProvider = new ethers.JsonRpcProvider(baseRpc);
          const polygonProvider = new ethers.JsonRpcProvider(polygonRpc);
          const zetaProvider = new ethers.JsonRpcProvider(zetaRpc);

          const buyer = new ethers.Wallet(buyerPk!, baseProvider);
          if (buyer.address.toLowerCase() !== deal.buyer.toLowerCase()) {
            log(
              "system",
              `提示：Deal 中的买家地址（${deal.buyer}）与 BUYER_PRIVATE_KEY（${buyer.address}）不一致，将使用私钥对应地址签名交易。`
            );
          }

          const usdc = new ethers.Contract(baseUSDC!, ERC20_ABI, buyer);
          const gateway = new ethers.Contract(baseGateway!, GATEWAY_ABI, buyer);
          const market = new ethers.Contract(universalMarket!, MARKET_ABI, zetaProvider);
          const escrow = new ethers.Contract(deal.polygonEscrow, ESCROW_ABI, polygonProvider);
          const nft = new ethers.Contract(deal.nft, ERC721_ABI, polygonProvider);

          const zetaStart = await zetaProvider.getBlockNumber();
          const polygonStart = await polygonProvider.getBlockNumber();

          let decimals = 6;
          let symbol = "USDC";
          try {
            decimals = Number(await usdc.decimals());
            symbol = String(await usdc.symbol());
          } catch {
            // keep defaults
          }

          log("buyer", "预检查：查询余额与 NFT 状态...");
          const buyerInitial = (await usdc.balanceOf(buyer.address)) as bigint;
          const sellerInitial = (await usdc.balanceOf(deal.sellerBase)) as bigint;

          let ownerInitial: string | undefined;
          try {
            ownerInitial = String(await nft.ownerOf(deal.tokenId));
          } catch {
            ownerInitial = undefined;
          }

          log(
            "system",
            `余额（${symbol}）：买家 ${ethers.formatUnits(buyerInitial, decimals)} | 卖家 ${ethers.formatUnits(
              sellerInitial,
              decimals
            )}`
          );
          if (ownerInitial) log("system", `NFT 持有者（之前）：${ownerInitial}`);

          step("approve", { status: "running", detail: `授权 ${ethers.formatUnits(deal.price, decimals)} ${symbol}` });
          log("buyer", `正在授权 Base Gateway 花费 ${ethers.formatUnits(deal.price, decimals)} ${symbol}...`);
          const approveTx = await usdc.approve(baseGateway!, deal.price);
          await approveTx.wait();
          step("approve", { status: "done", txHash: approveTx.hash, detail: "授权完成" });

          step("deposit", { status: "running", detail: "正在调用 Base Gateway 的 depositAndCall..." });
          log("buyer", "正在调用 depositAndCall（开始跨链结算）...");
          const payload = encodeDealPayload(deal);
          const revertOptions = {
            revertAddress: buyer.address,
            callOnRevert: false,
            abortAddress: ethers.ZeroAddress,
            revertMessage: "0x",
            onRevertGasLimit: 0,
          };
          const depositTx = await gateway.depositAndCall(
            universalMarket!,
            deal.price,
            baseUSDC!,
            payload,
            revertOptions
          );
          await depositTx.wait();
          step("deposit", { status: "done", txHash: depositTx.hash, detail: "交易已确认" });

          step("orchestrate", { status: "running", detail: "等待 ZetaChain 处理..." });
          log("system", "等待 ZetaChain 处理消息（DealProcessed）...");

          const processedTxHash = await pollForEventTxHash({
            contract: market,
            filter: market.filters.DealProcessed(deal.dealId),
            startBlock: zetaStart,
            timeoutMs: 180_000,
            pollMs: 4_000,
            signal,
          });

          if (processedTxHash) {
            step("orchestrate", {
              status: "done",
              txHash: processedTxHash,
              detail: "已观察到 DealProcessed",
            });
          } else {
            step("orchestrate", { status: "done", detail: "未获取 DealProcessed 交易哈希（仍可能在处理中）" });
          }

          step("deliver", { status: "running", detail: "等待 Polygon 托管释放..." });
          log("system", "等待 Polygon 托管合约发出 NFTReleased 事件...");

          const releasedTxHash = await pollForEventTxHash({
            contract: escrow,
            filter: escrow.filters.NFTReleased(deal.nft, deal.tokenId, deal.buyer),
            startBlock: polygonStart,
            timeoutMs: 240_000,
            pollMs: 4_000,
            signal,
          });

          if (releasedTxHash) {
            step("deliver", { status: "done", txHash: releasedTxHash, detail: "已观察到 NFTReleased" });
          } else {
            let ownerFinal: string | undefined;
            try {
              ownerFinal = String(await nft.ownerOf(deal.tokenId));
            } catch {
              ownerFinal = undefined;
            }
            step("deliver", {
              status: "done",
              detail: ownerFinal ? `当前持有者：${ownerFinal}` : "未获取 NFTReleased 交易哈希（仍可能在处理中）",
            });
          }

          const buyerFinal = (await usdc.balanceOf(buyer.address)) as bigint;
          const sellerFinal = (await usdc.balanceOf(deal.sellerBase)) as bigint;

          log(
            "system",
            `最终余额（${symbol}）：买家 ${ethers.formatUnits(buyerFinal, decimals)} | 卖家 ${ethers.formatUnits(
              sellerFinal,
              decimals
            )}`
          );

          send(controller, "done", { ok: true });
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "未知错误";
          send(controller, "error", message);
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

