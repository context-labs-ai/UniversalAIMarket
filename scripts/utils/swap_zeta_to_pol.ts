import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// UniswapV2 Router on ZetaChain Athens
const UNISWAP_ROUTER = "0x2ca7d64A7EFE2D62A725E2B35Cf7230D6677FfEe";
const WZETA = "0x5F0b1a82749cb4E2278EC87F8BF6B618dC71a8bf";
const POL_ZRC20 = "0x777915D031d1e8144c90D025C594b3b8Bf07a08d";

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

const ZRC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log("=== Swap ZETA to POL ZRC-20 ===\n");

  const zetaRpc = process.env.ZETA_ATHENS_RPC || "https://zetachain-athens-evm.blockpi.network/v1/rpc/public";
  const buyerPk = process.env.BUYER_PRIVATE_KEY;

  if (!buyerPk) throw new Error("Missing BUYER_PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider(zetaRpc);
  const buyer = new ethers.Wallet(buyerPk, provider);

  console.log("Account:", buyer.address);

  // Check ZETA balance
  const zetaBalance = await provider.getBalance(buyer.address);
  console.log("ZETA balance:", ethers.formatEther(zetaBalance), "ZETA");

  // ========================================
  // 修改这里的数量
  const swapAmount = ethers.parseEther("0.02"); // 要 swap 的 ZETA 数量
  // ========================================

  if (zetaBalance < swapAmount) {
    console.log("\n❌ Insufficient ZETA balance!");
    console.log("Need:", ethers.formatEther(swapAmount), "ZETA");
    console.log("Get testnet ZETA from: https://www.zetachain.com/docs/reference/apps/get-testnet-zeta/");
    return;
  }

  const router = new ethers.Contract(UNISWAP_ROUTER, ROUTER_ABI, buyer);
  const pol = new ethers.Contract(POL_ZRC20, ZRC20_ABI, provider);

  // Get quote
  const path = [WZETA, POL_ZRC20];
  const amounts = await router.getAmountsOut(swapAmount, path);
  const expectedOut = amounts[1];

  console.log(`\nSwapping ${ethers.formatEther(swapAmount)} ZETA for ~${ethers.formatEther(expectedOut)} POL...`);

  // Check balance before
  const balanceBefore = await pol.balanceOf(buyer.address);
  console.log("POL balance (before):", ethers.formatEther(balanceBefore));

  // Execute swap with 5% slippage tolerance
  const minOut = (expectedOut * 95n) / 100n;
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

  const tx = await router.swapExactETHForTokens(minOut, path, buyer.address, deadline, {
    value: swapAmount,
  });

  console.log("Tx hash:", tx.hash);
  console.log("Waiting for confirmation...");
  await tx.wait();

  // Check balance after
  const balanceAfter = await pol.balanceOf(buyer.address);
  console.log("POL balance (after):", ethers.formatEther(balanceAfter));

  console.log("\n✅ Swap complete!");
  console.log("Now run: npx ts-node scripts/utils/fund_market.ts");
}

main().catch(console.error);
