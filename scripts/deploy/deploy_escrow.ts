import { ethers } from "hardhat";

/**
 * Deploy UniversalEscrow to any EVM chain
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy_escrow.ts --network polygon_amoy
 *   npx hardhat run scripts/deploy/deploy_escrow.ts --network base_sepolia
 *   npx hardhat run scripts/deploy/deploy_escrow.ts --network sepolia
 *
 * Required env vars:
 *   - GATEWAY_ADDRESS: The ZetaChain Gateway address for the target chain
 *     (or use chain-specific vars like POLYGON_GATEWAY_ADDRESS)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=== Deploying UniversalEscrow ===");
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  // Get gateway address from env (support multiple naming conventions)
  const gatewayAddress =
    process.env.GATEWAY_ADDRESS ||
    process.env.POLYGON_GATEWAY_ADDRESS ||
    process.env.BASE_GATEWAY_ADDRESS ||
    process.env.ETH_GATEWAY_ADDRESS;

  if (!gatewayAddress) {
    console.error("\nError: Gateway address not set!");
    console.error("Please set one of these env vars:");
    console.error("  - GATEWAY_ADDRESS");
    console.error("  - POLYGON_GATEWAY_ADDRESS");
    console.error("  - BASE_GATEWAY_ADDRESS");
    console.error("\nCommon testnet gateway addresses:");
    console.error("  Polygon Amoy:     0x0c487a766110c85d301d96e33579c5b317fa4995");
    console.error("  Base Sepolia:     0x0c487a766110c85d301d96e33579c5b317fa4995");
    process.exit(1);
  }

  console.log(`Gateway: ${gatewayAddress}`);
  console.log("");

  // Deploy UniversalEscrow
  const UniversalEscrow = await ethers.getContractFactory("UniversalEscrow");
  const escrow = await UniversalEscrow.deploy(gatewayAddress);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();

  console.log("UniversalEscrow deployed to:", escrowAddress);
  console.log("");
  console.log("=== Add to .env ===");
  console.log(`POLYGON_ESCROW=${escrowAddress}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Approve your NFT for the escrow contract");
  console.log("2. Call escrow.deposit(nftAddress, tokenId) to escrow your NFT");
  console.log("3. Your NFT is now ready for cross-chain trading!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
