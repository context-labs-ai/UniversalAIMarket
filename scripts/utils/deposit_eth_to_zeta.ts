import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Deposit ETH from Base Sepolia to ZetaChain ===\n");

  const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const baseGateway = process.env.BASE_GATEWAY_ADDRESS;
  const deployerPk = process.env.DEPLOYER_PRIVATE_KEY;

  if (!baseGateway) throw new Error("Missing BASE_GATEWAY_ADDRESS");
  if (!deployerPk) throw new Error("Missing DEPLOYER_PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider(baseRpc);
  const deployer = new ethers.Wallet(deployerPk, provider);

  console.log("Deployer:", deployer.address);
  console.log("Base Gateway:", baseGateway);

  // Check ETH balance on Base
  const balance = await provider.getBalance(deployer.address);
  console.log("ETH balance on Base Sepolia:", ethers.formatEther(balance), "ETH");

  // Deposit amount (0.005 ETH should be plenty for many transactions)
  const depositAmount = ethers.parseEther("0.005");

  if (balance < depositAmount) {
    console.log("\n❌ Insufficient ETH balance!");
    console.log("Need at least 0.005 ETH + gas on Base Sepolia");
    console.log("Get testnet ETH from: https://www.alchemy.com/faucets/base-sepolia");
    return;
  }

  // Gateway ABI for deposit
  const gatewayAbi = [
    "function deposit(address receiver, tuple(address revertAddress, bool callOnRevert, address abortAddress, bytes revertMessage, uint256 onRevertGasLimit) revertOptions) external payable",
  ];

  const gateway = new ethers.Contract(baseGateway, gatewayAbi, deployer);

  const revertOptions = {
    revertAddress: deployer.address,
    callOnRevert: false,
    abortAddress: ethers.ZeroAddress,
    revertMessage: "0x",
    onRevertGasLimit: 0,
  };

  console.log(`\nDepositing ${ethers.formatEther(depositAmount)} ETH to ZetaChain...`);
  const tx = await gateway.deposit(deployer.address, revertOptions, {
    value: depositAmount,
  });

  console.log("Tx hash:", tx.hash);
  console.log("Waiting for confirmation...");
  await tx.wait();

  console.log("\n✅ Deposit submitted!");
  console.log("ETH will arrive as ETH.BASESEP ZRC-20 on ZetaChain in a few minutes.");
  console.log("\nAfter it arrives, run: npx ts-node scripts/utils/fund_market_eth.ts");
}

main().catch(console.error);
