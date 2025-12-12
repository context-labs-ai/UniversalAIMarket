import { ethers } from "hardhat";
import type { MockWeaponNFT, WeaponEscrow } from "../../typechain-types";

async function main() {
  const [deployer, , seller] = await ethers.getSigners();

  console.log("Deploying Polygon contracts...");
  console.log("Deployer:", deployer.address);
  console.log("Seller:", seller.address);

  // Deploy MockWeaponNFT
  const MockWeaponNFT = await ethers.getContractFactory("MockWeaponNFT");
  const nft = (await MockWeaponNFT.deploy()) as unknown as MockWeaponNFT;
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("MockWeaponNFT deployed to:", nftAddress);

  // Deploy WeaponEscrow
  const polygonGateway = process.env.POLYGON_GATEWAY_ADDRESS;
  if (!polygonGateway) {
    throw new Error("POLYGON_GATEWAY_ADDRESS not set in environment");
  }

  const WeaponEscrow = await ethers.getContractFactory("WeaponEscrow");
  const escrow = (await WeaponEscrow.deploy(
    polygonGateway
  )) as unknown as WeaponEscrow;
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("WeaponEscrow deployed to:", escrowAddress);

  // Mint NFT to seller
  const tokenId = 1;
  const mintTx = await nft.mint(seller.address, tokenId);
  await mintTx.wait();
  console.log(`Minted tokenId ${tokenId} to seller (${seller.address})`);

  // Seller approves and deposits to escrow
  const nftAsSeller = nft.connect(seller) as MockWeaponNFT;
  const approveTx = await nftAsSeller.approve(escrowAddress, tokenId);
  await approveTx.wait();
  console.log(`Seller approved escrow for tokenId ${tokenId}`);

  const escrowAsSeller = escrow.connect(seller) as WeaponEscrow;
  const depositTx = await escrowAsSeller.deposit(nftAddress, tokenId);
  await depositTx.wait();
  console.log(`NFT ${tokenId} deposited to escrow`);

  // Verify NFT is now owned by escrow
  const nftOwner = await nft.ownerOf(tokenId);
  console.log(`NFT ${tokenId} owner is now: ${nftOwner}`);

  // Output addresses for .env
  console.log("\n=== Add to .env ===");
  console.log(`POLYGON_MOCK_WEAPON_NFT=${nftAddress}`);
  console.log(`POLYGON_WEAPON_ESCROW=${escrowAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
