import { ethers } from "hardhat";
import type { MockWeaponNFT, UniversalEscrow } from "../../typechain-types";

/**
 * Setup Demo Environment
 *
 * This script deploys all contracts needed for the demo and prepares NFTs:
 * 1. Deploy MockWeaponNFT (example NFT contract)
 * 2. Deploy UniversalEscrow (chain-agnostic escrow)
 * 3. Mint demo NFTs to seller
 * 4. Deposit NFTs into escrow
 *
 * Usage:
 *   npx hardhat run scripts/deploy/setup_demo.ts --network polygon_amoy
 *
 * Required env vars:
 *   - POLYGON_GATEWAY_ADDRESS: ZetaChain Gateway address on target chain
 *   - SELLER_PRIVATE_KEY: Seller's private key (for minting/depositing)
 */
async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  // When deployer and buyer use the same key, we only have 2 unique signers
  // Seller is always the last signer in the array
  const seller = signers[signers.length - 1];

  console.log("=== Setting up Demo Environment ===\n");
  console.log("Deployer:", deployer.address);
  console.log("Seller:", seller.address);

  // === Step 1: Deploy MockWeaponNFT ===
  console.log("\n--- Deploying MockWeaponNFT ---");
  const MockWeaponNFT = await ethers.getContractFactory("MockWeaponNFT");
  const nft = (await MockWeaponNFT.deploy()) as unknown as MockWeaponNFT;
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("MockWeaponNFT deployed to:", nftAddress);

  // === Step 2: Deploy UniversalEscrow ===
  console.log("\n--- Deploying UniversalEscrow ---");
  const gatewayAddress = process.env.POLYGON_GATEWAY_ADDRESS;
  if (!gatewayAddress) {
    throw new Error("POLYGON_GATEWAY_ADDRESS not set in environment");
  }
  console.log("Using gateway:", gatewayAddress);

  const UniversalEscrow = await ethers.getContractFactory("UniversalEscrow");
  const escrow = (await UniversalEscrow.deploy(
    gatewayAddress
  )) as unknown as UniversalEscrow;
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("UniversalEscrow deployed to:", escrowAddress);

  // === Step 3: Mint and deposit NFTs ===
  console.log("\n--- Setting up Demo NFTs ---");
  // TokenIds for demo products (matching catalog.ts)
  const tokenIds = [2, 8]; // 量子之剑 and 咖啡豆收据

  const nftAsSeller = nft.connect(seller) as MockWeaponNFT;
  const escrowAsSeller = escrow.connect(seller) as UniversalEscrow;

  for (const tokenId of tokenIds) {
    const mintTx = await nft.mint(seller.address, tokenId);
    await mintTx.wait();
    console.log(`Minted tokenId ${tokenId} to seller (${seller.address})`);

    const approveTx = await nftAsSeller.approve(escrowAddress, tokenId);
    await approveTx.wait();
    console.log(`Seller approved escrow for tokenId ${tokenId}`);

    const depositTx = await escrowAsSeller.deposit(nftAddress, tokenId);
    await depositTx.wait();
    console.log(`NFT ${tokenId} deposited to escrow`);

    const nftOwner = await nft.ownerOf(tokenId);
    console.log(`NFT ${tokenId} owner is now: ${nftOwner}`);
  }

  // === Output Summary ===
  console.log("\n=== Demo Setup Complete ===\n");
  console.log("Add to .env:");
  console.log(`POLYGON_MOCK_NFT=${nftAddress}`);
  console.log(`POLYGON_ESCROW=${escrowAddress}`);
  console.log("");
  console.log("Demo NFTs ready:");
  tokenIds.forEach((id) => console.log(`  - Token #${id} in escrow`));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
