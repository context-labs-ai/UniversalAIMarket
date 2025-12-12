import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { Deal, computeDealId, DealWithoutId } from "../../types/Deal";
import { encodeDealPayload } from "../utils/encodeDeal";

// Gateway ABI for depositAndCall
const GATEWAY_ABI = [
  "function depositAndCall(address receiver, uint256 amount, address asset, bytes calldata payload, tuple(address revertAddress, bool callOnRevert, address abortAddress, bytes revertMessage, uint256 onRevertGasLimit) revertOptions) external",
];

// ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// ERC721 ABI
const ERC721_ABI = ["function ownerOf(uint256) view returns (address)"];

interface DeployedAddresses {
  BASE_GATEWAY_ADDRESS: string;
  BASE_USDC_ADDRESS: string;
  ZETA_UNIVERSAL_MARKET: string;
  POLYGON_WEAPON_ESCROW: string;
  POLYGON_MOCK_WEAPON_NFT: string;
  BASE_RPC?: string;
  POLYGON_RPC?: string;
}

function loadDeployedAddresses(): DeployedAddresses | null {
  const deployedPath = path.join(process.cwd(), "deployed.json");
  if (fs.existsSync(deployedPath)) {
    return JSON.parse(fs.readFileSync(deployedPath, "utf-8"));
  }
  return null;
}

async function main() {
  console.log("=== Phase 1 Demo: Cross-Chain Settlement ===\n");

  // Try to load from deployed.json first, then fall back to env
  const deployed = loadDeployedAddresses();

  // Get signers from hardhat (handles nonce management properly)
  const signers = await ethers.getSigners();
  const [, buyer, seller] = signers; // deployer, buyer, seller

  console.log("Buyer:", buyer.address);
  console.log("Seller:", seller.address);

  // Contract addresses from deployed.json or environment
  const baseGateway =
    deployed?.BASE_GATEWAY_ADDRESS || process.env.BASE_GATEWAY_ADDRESS;
  const baseUSDC = deployed?.BASE_USDC_ADDRESS || process.env.BASE_USDC_ADDRESS;
  const universalMarket =
    deployed?.ZETA_UNIVERSAL_MARKET || process.env.ZETA_UNIVERSAL_MARKET;
  const polygonEscrow =
    deployed?.POLYGON_WEAPON_ESCROW || process.env.POLYGON_WEAPON_ESCROW;
  const polygonNFT =
    deployed?.POLYGON_MOCK_WEAPON_NFT || process.env.POLYGON_MOCK_WEAPON_NFT;

  if (
    !baseGateway ||
    !baseUSDC ||
    !universalMarket ||
    !polygonEscrow ||
    !polygonNFT
  ) {
    throw new Error(
      "Missing required addresses. Please run 'pnpm deploy:local' first, or set env vars:\n" +
        "BASE_GATEWAY_ADDRESS, BASE_USDC_ADDRESS, ZETA_UNIVERSAL_MARKET, " +
        "POLYGON_WEAPON_ESCROW, POLYGON_MOCK_WEAPON_NFT"
    );
  }

  console.log("\nContract Addresses:");
  console.log("  Base Gateway:", baseGateway);
  console.log("  Base USDC:", baseUSDC);
  console.log("  Universal Market:", universalMarket);
  console.log("  Polygon Escrow:", polygonEscrow);
  console.log("  Polygon NFT:", polygonNFT);

  // === Step 1: Record initial balances ===
  const usdc = new ethers.Contract(baseUSDC, ERC20_ABI, buyer);
  const decimals = await usdc.decimals();
  const symbol = await usdc.symbol();

  const buyerInitial = await usdc.balanceOf(buyer.address);
  const sellerInitial = await usdc.balanceOf(seller.address);

  console.log(`\nInitial ${symbol} balances:`);
  console.log(
    `  Buyer: ${ethers.formatUnits(buyerInitial, decimals)} ${symbol}`
  );
  console.log(
    `  Seller: ${ethers.formatUnits(sellerInitial, decimals)} ${symbol}`
  );

  // Check NFT ownership on Polygon (in localnet, same provider)
  const nft = new ethers.Contract(polygonNFT, ERC721_ABI, buyer.provider);
  const tokenId = 1n;
  let nftOwnerInitial: string;
  try {
    nftOwnerInitial = await nft.ownerOf(tokenId);
  } catch (e) {
    throw new Error(`NFT #${tokenId} not found. Did you run deploy:polygon?`);
  }
  console.log(`  NFT #${tokenId} owner: ${nftOwnerInitial}`);

  // === Step 2: Prepare Deal ===
  const price = ethers.parseUnits("80", decimals); // 80 USDC - negotiated price
  const amount = price; // Buyer sends exactly the price (no refund needed)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  const dealWithoutId: DealWithoutId = {
    buyer: buyer.address,
    sellerBase: seller.address,
    polygonEscrow: polygonEscrow,
    nft: polygonNFT,
    tokenId: tokenId,
    price: price,
    deadline: deadline,
  };

  const dealId = computeDealId(dealWithoutId);
  const deal: Deal = { dealId, ...dealWithoutId };

  console.log(`\nDeal prepared:`);
  console.log(`  Deal ID: ${dealId}`);
  console.log(`  Price: ${ethers.formatUnits(price, decimals)} ${symbol}`);
  console.log(`  Amount sent: ${ethers.formatUnits(amount, decimals)} ${symbol}`);
  console.log(`  Deadline: ${new Date(Number(deadline) * 1000).toISOString()}`);

  // Check buyer has enough balance
  if (buyerInitial < amount) {
    throw new Error(
      `Buyer has insufficient ${symbol}. Has: ${ethers.formatUnits(buyerInitial, decimals)}, needs: ${ethers.formatUnits(amount, decimals)}`
    );
  }

  // === Step 3: Approve Gateway ===
  console.log(
    `\nApproving Base Gateway to spend ${ethers.formatUnits(amount, decimals)} ${symbol}...`
  );
  const approveTx = await usdc.approve(baseGateway, amount);
  await approveTx.wait();
  console.log(`  Approved. Tx: ${approveTx.hash}`);

  // === Step 4: Call depositAndCall ===
  const payload = encodeDealPayload(deal);
  console.log(`  Payload size: ${payload.length / 2 - 1} bytes`);

  const gateway = new ethers.Contract(baseGateway, GATEWAY_ABI, buyer);

  const revertOptions = {
    revertAddress: buyer.address,
    callOnRevert: false,
    abortAddress: ethers.ZeroAddress,
    revertMessage: "0x",
    onRevertGasLimit: 0n,
  };

  console.log(`\nCalling depositAndCall on Base Gateway...`);
  const depositTx = await gateway.depositAndCall(
    universalMarket,
    amount,
    baseUSDC,
    payload,
    revertOptions
  );
  await depositTx.wait();
  console.log(`  Deposit tx: ${depositTx.hash}`);

  // === Step 5: Wait for cross-chain completion ===
  console.log(`\nWaiting for cross-chain settlement...`);
  console.log(
    `  (In localnet this should be fast, testnet may take 1-2 minutes)`
  );

  // Poll for NFT ownership change
  let attempts = 0;
  const maxAttempts = 60;
  let nftOwnerFinal = nftOwnerInitial;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2000)); // Wait 2s
    try {
      nftOwnerFinal = await nft.ownerOf(tokenId);
      if (nftOwnerFinal.toLowerCase() === buyer.address.toLowerCase()) {
        console.log(`  NFT transferred to buyer!`);
        break;
      }
    } catch (e) {
      // NFT might be in transit
    }
    attempts++;
    process.stdout.write(".");
  }

  // === Step 6: Final state ===
  console.log(`\n\n=== Final State ===`);

  const buyerFinal = await usdc.balanceOf(buyer.address);
  const sellerFinal = await usdc.balanceOf(seller.address);

  console.log(`\n${symbol} Balances:`);
  console.log(
    `  Buyer:  ${ethers.formatUnits(buyerInitial, decimals)} -> ${ethers.formatUnits(buyerFinal, decimals)} ${symbol}`
  );
  console.log(
    `  Seller: ${ethers.formatUnits(sellerInitial, decimals)} -> ${ethers.formatUnits(sellerFinal, decimals)} ${symbol}`
  );

  const buyerSpent = buyerInitial - buyerFinal;
  const sellerReceived = sellerFinal - sellerInitial;

  console.log(`\nNet changes:`);
  console.log(
    `  Buyer spent: ${ethers.formatUnits(buyerSpent, decimals)} ${symbol}`
  );
  console.log(
    `  Seller received: ${ethers.formatUnits(sellerReceived, decimals)} ${symbol}`
  );

  console.log(`\nNFT Ownership:`);
  console.log(`  Token #${tokenId}: ${nftOwnerInitial} -> ${nftOwnerFinal}`);

  // === Assertions ===
  console.log(`\n=== Verification ===`);

  // Buyer should have spent exactly the price (80 USDC)
  if (buyerSpent === price) {
    console.log(
      `[PASS] Buyer spent exactly ${ethers.formatUnits(buyerSpent, decimals)} ${symbol}`
    );
  } else {
    console.log(
      `[WARN] Buyer spent ${ethers.formatUnits(buyerSpent, decimals)} ${symbol} (expected ${ethers.formatUnits(price, decimals)})`
    );
  }

  // Seller should receive price minus gas fee
  if (sellerReceived > 0n) {
    console.log(
      `[PASS] Seller received ${ethers.formatUnits(sellerReceived, decimals)} ${symbol} (price minus cross-chain gas fee)`
    );
  } else {
    console.log(`[FAIL] Seller did not receive payment`);
  }

  if (nftOwnerFinal.toLowerCase() === buyer.address.toLowerCase()) {
    console.log(`[PASS] NFT successfully transferred to buyer`);
  } else {
    console.log(`[FAIL] NFT not transferred. Current owner: ${nftOwnerFinal}`);
  }

  console.log(`\n=== Demo Complete ===`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
