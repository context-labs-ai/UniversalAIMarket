import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const ERC721_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function name() view returns (string)",
];

async function main() {
  console.log("=== Testnet Balance Check ===\n");

  // RPC URLs
  const baseRpc = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const polygonRpc = process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology";
  const zetaRpc = process.env.ZETA_ATHENS_RPC || "https://zetachain-athens-evm.blockpi.network/v1/rpc/public";

  // Providers
  const baseProvider = new ethers.JsonRpcProvider(baseRpc);
  const polygonProvider = new ethers.JsonRpcProvider(polygonRpc);
  const zetaProvider = new ethers.JsonRpcProvider(zetaRpc);

  // Addresses
  const buyerPk = process.env.BUYER_PRIVATE_KEY;
  const sellerPk = process.env.SELLER_PRIVATE_KEY;

  if (!buyerPk || !sellerPk) {
    throw new Error("Missing BUYER_PRIVATE_KEY or SELLER_PRIVATE_KEY");
  }

  const buyer = new ethers.Wallet(buyerPk);
  const seller = new ethers.Wallet(sellerPk);

  const baseUsdc = process.env.BASE_USDC_ADDRESS || "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
  const polZrc20 = process.env.POLYGON_GAS_ZRC20 || "0x777915D031d1e8144c90D025C594b3b8Bf07a08d";
  const usdcZrc20 = process.env.USDC_BASE_ZRC20 || "0xd0eFed75622e7AA4555EE44F296dA3744E3ceE19";
  const universalMarket = process.env.ZETA_UNIVERSAL_MARKET;
  const weaponEscrow = process.env.POLYGON_WEAPON_ESCROW;
  const mockNft = process.env.POLYGON_MOCK_WEAPON_NFT;

  console.log("Addresses:");
  console.log(`  Buyer:  ${buyer.address}`);
  console.log(`  Seller: ${seller.address}`);
  console.log(`  UniversalMarket: ${universalMarket || "NOT SET"}`);
  console.log(`  WeaponEscrow: ${weaponEscrow || "NOT SET"}`);
  console.log(`  MockNFT: ${mockNft || "NOT SET"}`);
  console.log("");

  // Check Base Sepolia USDC balances
  console.log("=== Base Sepolia (USDC) ===");
  const usdc = new ethers.Contract(baseUsdc, ERC20_ABI, baseProvider);
  try {
    const decimals = await usdc.decimals();
    const buyerUsdc = await usdc.balanceOf(buyer.address);
    const sellerUsdc = await usdc.balanceOf(seller.address);
    console.log(`  Buyer USDC:  ${ethers.formatUnits(buyerUsdc, decimals)}`);
    console.log(`  Seller USDC: ${ethers.formatUnits(sellerUsdc, decimals)}`);
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Check ZetaChain balances
  console.log("\n=== ZetaChain Athens ===");

  if (universalMarket) {
    const pol = new ethers.Contract(polZrc20, ERC20_ABI, zetaProvider);
    const usdcZ = new ethers.Contract(usdcZrc20, ERC20_ABI, zetaProvider);

    try {
      const marketPolBalance = await pol.balanceOf(universalMarket);
      const marketUsdcBalance = await usdcZ.balanceOf(universalMarket);
      console.log(`  Market POL ZRC-20:  ${ethers.formatUnits(marketPolBalance, 18)}`);
      console.log(`  Market USDC ZRC-20: ${ethers.formatUnits(marketUsdcBalance, 6)}`);

      // Check native ZETA balance
      const zetaBalance = await zetaProvider.getBalance(universalMarket);
      console.log(`  Market ZETA (gas):  ${ethers.formatEther(zetaBalance)}`);
    } catch (e) {
      console.log(`  Error: ${e}`);
    }
  }

  // Check Polygon Amoy NFT status
  console.log("\n=== Polygon Amoy (NFT) ===");
  if (mockNft) {
    const nft = new ethers.Contract(mockNft, ERC721_ABI, polygonProvider);
    try {
      const name = await nft.name();
      console.log(`  NFT Contract: ${name}`);

      // Check token 1 (the sword)
      for (const tokenId of [1, 7]) {
        try {
          const owner = await nft.ownerOf(tokenId);
          const ownerLabel = owner.toLowerCase() === weaponEscrow?.toLowerCase() ? "Escrow" :
                            owner.toLowerCase() === buyer.address.toLowerCase() ? "Buyer" :
                            owner.toLowerCase() === seller.address.toLowerCase() ? "Seller" : owner;
          console.log(`  Token #${tokenId} owner: ${ownerLabel}`);
        } catch {
          console.log(`  Token #${tokenId}: Does not exist or error`);
        }
      }
    } catch (e) {
      console.log(`  Error: ${e}`);
    }
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
