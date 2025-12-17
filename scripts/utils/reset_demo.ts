import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const ERC20_ABI = [
  "function transfer(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const ERC721_ABI = [
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function ownerOf(uint256) view returns (address)",
  "function approve(address, uint256)",
];

async function main() {
  console.log("=== Reset Demo State ===\n");

  // RPCs
  const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const polygonRpc = process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology";
  const zetaRpc = process.env.ZETA_ATHENS_RPC || "https://zetachain-athens-evm.blockpi.network/v1/rpc/public";

  // Providers
  const baseProvider = new ethers.JsonRpcProvider(baseRpc);
  const polygonProvider = new ethers.JsonRpcProvider(polygonRpc);
  const zetaProvider = new ethers.JsonRpcProvider(zetaRpc);

  // Wallets
  const buyerPk = process.env.BUYER_PRIVATE_KEY!;
  const sellerPk = process.env.SELLER_PRIVATE_KEY!;

  const buyerBase = new ethers.Wallet(buyerPk, baseProvider);
  const buyerPolygon = new ethers.Wallet(buyerPk, polygonProvider);
  const buyerZeta = new ethers.Wallet(buyerPk, zetaProvider);
  const sellerBase = new ethers.Wallet(sellerPk, baseProvider);

  // Addresses
  const baseUsdc = process.env.BASE_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const mockNft = process.env.POLYGON_MOCK_WEAPON_NFT || "0xE0EFF1C50040d7Fbcd56F5f0fcFCBad751c07c57";
  const escrow = process.env.POLYGON_WEAPON_ESCROW || "0x0BAD4C5E163A7f2831bDB83Eaf48DaD2B472906c";
  const market = process.env.ZETA_UNIVERSAL_MARKET || "0xB7f7c2Dd2790741D5fF6b1965d37d0338cD01477";
  const polZrc20 = "0x777915D031d1e8144c90D025C594b3b8Bf07a08d";

  console.log("Buyer:", buyerBase.address);
  console.log("Seller:", sellerBase.address);
  console.log("");

  // 1. Transfer USDC from Seller back to Buyer
  console.log("=== Step 1: Return USDC to Buyer ===");
  const usdc = new ethers.Contract(baseUsdc, ERC20_ABI, sellerBase);
  const sellerUsdcBalance = await usdc.balanceOf(sellerBase.address);

  if (sellerUsdcBalance > 0n) {
    console.log(`Seller has ${ethers.formatUnits(sellerUsdcBalance, 6)} USDC, transferring back...`);
    const tx1 = await usdc.transfer(buyerBase.address, sellerUsdcBalance);
    await tx1.wait();
    console.log("✅ USDC returned to Buyer");
  } else {
    console.log("Seller has no USDC to return");
  }

  // 2. Transfer NFT from Buyer back to Escrow
  console.log("\n=== Step 2: Return NFT to Escrow ===");
  const nft = new ethers.Contract(mockNft, ERC721_ABI, buyerPolygon);

  const tokenIds = [1, 7]; // The two demo NFTs
  for (const tokenId of tokenIds) {
    try {
      const owner = await nft.ownerOf(tokenId);
      if (owner.toLowerCase() === buyerPolygon.address.toLowerCase()) {
        console.log(`Token #${tokenId} owned by Buyer, transferring back to Escrow...`);
        const tx2 = await nft.transferFrom(buyerPolygon.address, escrow, tokenId);
        await tx2.wait();
        console.log(`✅ Token #${tokenId} returned to Escrow`);
      } else if (owner.toLowerCase() === escrow.toLowerCase()) {
        console.log(`Token #${tokenId} already in Escrow`);
      } else {
        console.log(`Token #${tokenId} owned by ${owner}`);
      }
    } catch (e) {
      console.log(`Token #${tokenId}: Error or doesn't exist`);
    }
  }

  // 3. Top up Market gas if needed
  console.log("\n=== Step 3: Check Market Gas ===");
  const pol = new ethers.Contract(polZrc20, ERC20_ABI, zetaProvider);
  const marketPol = await pol.balanceOf(market);
  const requiredPol = ethers.parseEther("0.0084");

  console.log(`Market POL: ${ethers.formatEther(marketPol)}`);
  console.log(`Required: ${ethers.formatEther(requiredPol)}`);

  if (marketPol < requiredPol) {
    console.log("Market needs more POL, checking buyer balance...");
    const buyerPol = await pol.balanceOf(buyerZeta.address);
    const needed = requiredPol - marketPol + ethers.parseEther("0.002"); // Add buffer

    if (buyerPol >= needed) {
      const polWithSigner = new ethers.Contract(polZrc20, ERC20_ABI, buyerZeta);
      const tx3 = await polWithSigner.transfer(market, needed);
      await tx3.wait();
      console.log("✅ POL topped up");
    } else {
      console.log(`⚠️ Buyer only has ${ethers.formatEther(buyerPol)} POL, need to swap more ZETA`);
    }
  } else {
    console.log("✅ Market has enough POL");
  }

  // Final state
  console.log("\n=== Final State ===");
  const buyerUsdcFinal = await new ethers.Contract(baseUsdc, ERC20_ABI, baseProvider).balanceOf(buyerBase.address);
  const sellerUsdcFinal = await new ethers.Contract(baseUsdc, ERC20_ABI, baseProvider).balanceOf(sellerBase.address);

  console.log(`Buyer USDC: ${ethers.formatUnits(buyerUsdcFinal, 6)}`);
  console.log(`Seller USDC: ${ethers.formatUnits(sellerUsdcFinal, 6)}`);

  for (const tokenId of tokenIds) {
    try {
      const owner = await nft.ownerOf(tokenId);
      const label = owner.toLowerCase() === escrow.toLowerCase() ? "Escrow" :
                    owner.toLowerCase() === buyerPolygon.address.toLowerCase() ? "Buyer" : owner;
      console.log(`NFT #${tokenId}: ${label}`);
    } catch {
      console.log(`NFT #${tokenId}: N/A`);
    }
  }

  console.log("\n✅ Demo reset complete! Ready for another test.");
}

main().catch(console.error);
