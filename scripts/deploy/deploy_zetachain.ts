import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying ZetaChain contracts...");
  console.log("Deployer:", deployer.address);

  const gatewayZEVM = process.env.ZETA_GATEWAY_ZEVM_ADDRESS;
  const polygonGasZRC20 = process.env.POLYGON_GAS_ZRC20;

  if (!gatewayZEVM) {
    throw new Error("ZETA_GATEWAY_ZEVM_ADDRESS not set in environment");
  }
  if (!polygonGasZRC20) {
    throw new Error("POLYGON_GAS_ZRC20 not set in environment");
  }

  console.log("Gateway ZEVM:", gatewayZEVM);
  console.log("Polygon Gas ZRC20:", polygonGasZRC20);

  // Deploy UniversalMarket
  const UniversalMarket = await ethers.getContractFactory("UniversalMarket");
  const market = await UniversalMarket.deploy(gatewayZEVM, polygonGasZRC20);
  await market.waitForDeployment();

  const marketAddress = await market.getAddress();
  console.log("UniversalMarket deployed to:", marketAddress);

  // Display gateway address
  const gatewayAddress = await market.gateway();
  console.log("Gateway address:", gatewayAddress);

  // Note about funding
  console.log(
    "\nNote: Fund UniversalMarket with POLYGON_GAS_ZRC20 for NFT shipment"
  );
  console.log(`Run: pnpm fund:market`);

  // Output
  console.log("\n=== Add to .env ===");
  console.log(`ZETA_UNIVERSAL_MARKET=${marketAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
