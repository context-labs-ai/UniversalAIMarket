import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const ZRC20_ABI = [
  "function transfer(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log("=== Fund Market with ETH.BASESEP ZRC-20 ===\n");

  const zetaRpc = process.env.ZETA_ATHENS_RPC || "https://zetachain-athens-evm.blockpi.network/v1/rpc/public";
  const deployerPk = process.env.DEPLOYER_PRIVATE_KEY;
  const universalMarket = process.env.ZETA_UNIVERSAL_MARKET;

  // ETH.BASESEP ZRC-20 on ZetaChain Athens
  const ethBaseZRC20 = "0x236b0DE675cC8F46AE186897fCCeFe3370C9eDeD";

  if (!deployerPk) throw new Error("Missing DEPLOYER_PRIVATE_KEY");
  if (!universalMarket) throw new Error("Missing ZETA_UNIVERSAL_MARKET");

  const provider = new ethers.JsonRpcProvider(zetaRpc);
  const deployer = new ethers.Wallet(deployerPk, provider);

  console.log("Deployer:", deployer.address);
  console.log("Market:", universalMarket);
  console.log("ETH.BASESEP ZRC-20:", ethBaseZRC20);

  const ethZrc20 = new ethers.Contract(ethBaseZRC20, ZRC20_ABI, deployer);
  const symbol = await ethZrc20.symbol();

  // Check deployer balance
  const deployerBalance = await ethZrc20.balanceOf(deployer.address);
  console.log(`\nDeployer ${symbol} balance:`, ethers.formatEther(deployerBalance));

  if (deployerBalance === 0n) {
    console.log("\n❌ Deployer has no ETH.BASESEP ZRC-20!");
    console.log("You need to deposit ETH from Base Sepolia to ZetaChain first.");
    console.log("Use: npx ts-node scripts/utils/deposit_eth_to_zeta.ts");
    return;
  }

  // Transfer a small amount (0.001 ETH should be plenty)
  const transferAmount = ethers.parseEther("0.001");

  if (deployerBalance < transferAmount) {
    console.log(`\n⚠️ Deployer only has ${ethers.formatEther(deployerBalance)} ${symbol}`);
    console.log("Transferring entire balance instead...");
  }

  const amountToTransfer = deployerBalance < transferAmount ? deployerBalance : transferAmount;

  // Check market current balance
  const marketBefore = await ethZrc20.balanceOf(universalMarket);
  console.log(`Market ${symbol} balance (before):`, ethers.formatEther(marketBefore));

  console.log(`\nTransferring ${ethers.formatEther(amountToTransfer)} ${symbol} to Market...`);
  const tx = await ethZrc20.transfer(universalMarket, amountToTransfer);
  console.log("Tx hash:", tx.hash);
  await tx.wait();

  const marketAfter = await ethZrc20.balanceOf(universalMarket);
  console.log(`Market ${symbol} balance (after):`, ethers.formatEther(marketAfter));

  console.log("\n✅ Done! Market now has ETH.BASESEP for gas fees.");
}

main().catch(console.error);
