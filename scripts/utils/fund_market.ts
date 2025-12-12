import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Funding UniversalMarket with Polygon gas tokens...");
  console.log("Funder:", deployer.address);

  const marketAddress = process.env.ZETA_UNIVERSAL_MARKET;
  const polygonGasZRC20 = process.env.POLYGON_GAS_ZRC20;

  if (!marketAddress) {
    throw new Error("ZETA_UNIVERSAL_MARKET not set in environment");
  }
  if (!polygonGasZRC20) {
    throw new Error("POLYGON_GAS_ZRC20 not set in environment");
  }

  console.log("Market address:", marketAddress);
  console.log("Polygon Gas ZRC20:", polygonGasZRC20);

  // Connect to ZRC-20 contract
  const zrc20 = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
    ],
    polygonGasZRC20
  );

  // Get current balances
  const deployerBalance = await zrc20.balanceOf(deployer.address);
  const marketBalance = await zrc20.balanceOf(marketAddress);
  const decimals = await zrc20.decimals();
  const symbol = await zrc20.symbol();

  console.log(
    `\nDeployer ${symbol} balance: ${ethers.formatUnits(deployerBalance, decimals)}`
  );
  console.log(
    `Market ${symbol} balance: ${ethers.formatUnits(marketBalance, decimals)}`
  );

  // Transfer some gas tokens to market (0.1 units)
  const fundAmount = ethers.parseUnits("0.1", decimals);

  if (deployerBalance < fundAmount) {
    console.log(
      `\nWarning: Deployer has insufficient ${symbol} balance to fund market`
    );
    console.log("Please fund deployer account first");
    return;
  }

  console.log(
    `\nTransferring ${ethers.formatUnits(fundAmount, decimals)} ${symbol} to market...`
  );
  const tx = await zrc20.transfer(marketAddress, fundAmount);
  await tx.wait();
  console.log("Transfer successful! Tx:", tx.hash);

  // Verify new balance
  const newMarketBalance = await zrc20.balanceOf(marketAddress);
  console.log(
    `\nNew market ${symbol} balance: ${ethers.formatUnits(newMarketBalance, decimals)}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
