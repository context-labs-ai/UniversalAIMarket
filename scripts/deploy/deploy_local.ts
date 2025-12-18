import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { MockWeaponNFT, UniversalEscrow } from "../../typechain-types";

interface LocalnetAddress {
  chain: string;
  type: string;
  address: string;
}

interface LocalnetConfig {
  pid: number;
  addresses: LocalnetAddress[];
}

function loadLocalnetConfig(): LocalnetConfig {
  const localnetPath = path.join(process.cwd(), "localnet.json");
  if (!fs.existsSync(localnetPath)) {
    throw new Error(
      "localnet.json not found. Please run 'pnpm localnet:start' first."
    );
  }
  return JSON.parse(fs.readFileSync(localnetPath, "utf-8"));
}

function getAddress(config: LocalnetConfig, type: string): string {
  const entry = config.addresses.find((a) => a.type === type);
  if (!entry) {
    throw new Error(`Address for type '${type}' not found in localnet.json`);
  }
  return entry.address;
}

async function main() {
  console.log("=== Deploying to ZetaChain Localnet ===\n");

  // Load localnet configuration
  const localnetConfig = loadLocalnetConfig();
  console.log("Loaded localnet.json");

  // Get addresses from localnet
  const gatewayEVM = getAddress(localnetConfig, "gatewayEVM");
  const gatewayZEVM = getAddress(localnetConfig, "gatewayZEVM");
  // In localnet, we use ETH ZRC-20 as gas token for "Polygon" (simulated by BNB chain)
  const polygonGasZRC20 = getAddress(localnetConfig, "ZRC-20 ETH on 5");
  const usdcERC20 = getAddress(localnetConfig, "ERC-20 USDC");

  console.log("\nLocalnet addresses:");
  console.log("  Gateway EVM:", gatewayEVM);
  console.log("  Gateway ZEVM:", gatewayZEVM);
  console.log("  Polygon Gas ZRC-20:", polygonGasZRC20);
  console.log("  USDC ERC-20:", usdcERC20);

  const [deployer, buyer, seller] = await ethers.getSigners();

  console.log("\nAccounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  Buyer:", buyer.address);
  console.log("  Seller:", seller.address);

  // === Step 1: Deploy MockWeaponNFT ===
  console.log("\n--- Deploying MockWeaponNFT ---");
  const MockWeaponNFT = await ethers.getContractFactory("MockWeaponNFT");
  const nft = (await MockWeaponNFT.deploy()) as unknown as MockWeaponNFT;
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("MockWeaponNFT deployed to:", nftAddress);

  // === Step 2: Deploy UniversalEscrow ===
  console.log("\n--- Deploying UniversalEscrow ---");
  const UniversalEscrow = await ethers.getContractFactory("UniversalEscrow");
  // In localnet, gatewayEVM is used for all EVM chains
  const escrow = (await UniversalEscrow.deploy(
    gatewayEVM
  )) as unknown as UniversalEscrow;
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("UniversalEscrow deployed to:", escrowAddress);

  // === Step 3: Deploy UniversalMarket ===
  console.log("\n--- Deploying UniversalMarket ---");
  const UniversalMarket = await ethers.getContractFactory("UniversalMarket");
  // Pass both gateway and gas token addresses
  const market = await UniversalMarket.deploy(gatewayZEVM, polygonGasZRC20);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("UniversalMarket deployed to:", marketAddress);

  // === Step 4: Mint NFTs to seller ===
  console.log("\n--- Setting up NFT ---");
  const tokenIds = [1, 7];

  const nftAsSeller = nft.connect(seller) as MockWeaponNFT;
  const escrowAsSeller = escrow.connect(seller) as UniversalEscrow;

  for (const tokenId of tokenIds) {
    const mintTx = await nft.mint(seller.address, tokenId);
    await mintTx.wait();
    console.log(`Minted tokenId ${tokenId} to seller (${seller.address})`);

    // === Step 5: Seller deposits NFT to escrow ===
    const approveTx = await nftAsSeller.approve(escrowAddress, tokenId);
    await approveTx.wait();
    console.log(`Seller approved escrow for tokenId ${tokenId}`);

    const depositTx = await escrowAsSeller.deposit(nftAddress, tokenId);
    await depositTx.wait();
    console.log(`NFT ${tokenId} deposited to escrow`);

    // Verify NFT is now owned by escrow
    const nftOwner = await nft.ownerOf(tokenId);
    console.log(`NFT ${tokenId} owner is now: ${nftOwner}`);
  }

  // === Step 6: Fund UniversalMarket with gas tokens ===
  console.log("\n--- Funding UniversalMarket ---");

  // Fund with Polygon gas tokens (for NFT shipment)
  const polygonZRC20 = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)",
      "function decimals() view returns (uint8)",
    ],
    polygonGasZRC20
  );

  const deployerPolygonGasBalance = await polygonZRC20.balanceOf(deployer.address);
  const polygonDecimals = await polygonZRC20.decimals();
  console.log(
    `Deployer Polygon gas token balance: ${ethers.formatUnits(deployerPolygonGasBalance, polygonDecimals)}`
  );

  if (deployerPolygonGasBalance > 0n) {
    const fundAmount = deployerPolygonGasBalance / 10n; // Transfer 10% of balance
    const transferTx = await polygonZRC20.transfer(marketAddress, fundAmount);
    await transferTx.wait();
    console.log(
      `Transferred ${ethers.formatUnits(fundAmount, polygonDecimals)} Polygon gas tokens to market`
    );
  } else {
    console.log(
      "Warning: Deployer has no Polygon gas tokens. Market may fail on NFT shipment."
    );
  }

  // Fund with Base gas tokens (for withdraw to seller)
  // In localnet, Base uses ETH as gas, which is the same ZRC-20 as Polygon gas
  // But let's check what the USDC ZRC-20 reports as its gas token
  // Note: In localnet, ethereum chain is chain ID 5, so it's "ZRC-20 USDC on 5"
  const usdcZRC20Address = getAddress(localnetConfig, "ZRC-20 USDC on 5");
  console.log(`\nUSDC ZRC-20 address: ${usdcZRC20Address}`);

  const usdcZRC20 = await ethers.getContractAt(
    [
      "function withdrawGasFee() view returns (address, uint256)",
    ],
    usdcZRC20Address
  );

  try {
    const [baseGasZRC20, baseGasFee] = await usdcZRC20.withdrawGasFee();
    console.log(`Base gas token (from USDC): ${baseGasZRC20}`);
    console.log(`Base gas fee: ${baseGasFee}`);

    // Fund with Base gas tokens if different from Polygon
    if (baseGasZRC20.toLowerCase() !== polygonGasZRC20.toLowerCase()) {
      const baseZRC20 = await ethers.getContractAt(
        [
          "function balanceOf(address) view returns (uint256)",
          "function transfer(address, uint256) returns (bool)",
          "function decimals() view returns (uint8)",
        ],
        baseGasZRC20
      );

      const deployerBaseGasBalance = await baseZRC20.balanceOf(deployer.address);
      const baseDecimals = await baseZRC20.decimals();
      console.log(
        `Deployer Base gas token balance: ${ethers.formatUnits(deployerBaseGasBalance, baseDecimals)}`
      );

      if (deployerBaseGasBalance > 0n) {
        const fundAmount = deployerBaseGasBalance / 10n;
        const transferTx = await baseZRC20.transfer(marketAddress, fundAmount);
        await transferTx.wait();
        console.log(
          `Transferred ${ethers.formatUnits(fundAmount, baseDecimals)} Base gas tokens to market`
        );
      }
    } else {
      console.log("Base and Polygon use the same gas token - already funded");
    }
  } catch (e) {
    console.log("Could not query gas token from USDC ZRC-20:", e);
  }

  // === Output Summary ===
  console.log("\n=== Deployment Complete ===\n");
  console.log("Contract Addresses:");
  console.log(`  POLYGON_MOCK_NFT=${nftAddress}`);
  console.log(`  POLYGON_ESCROW=${escrowAddress}`);
  console.log(`  ZETA_UNIVERSAL_MARKET=${marketAddress}`);

  console.log("\nLocalnet Addresses (from localnet.json):");
  console.log(`  BASE_GATEWAY_ADDRESS=${gatewayEVM}`);
  console.log(`  BASE_USDC_ADDRESS=${usdcERC20}`);
  console.log(`  ZETA_GATEWAY_ZEVM_ADDRESS=${gatewayZEVM}`);
  console.log(`  POLYGON_GAS_ZRC20=${polygonGasZRC20}`);

  // Save deployed addresses to a file for demo script
  const deployedAddresses = {
    // Deployed contracts
    POLYGON_MOCK_NFT: nftAddress,
    POLYGON_ESCROW: escrowAddress,
    ZETA_UNIVERSAL_MARKET: marketAddress,
    // Localnet addresses
    BASE_GATEWAY_ADDRESS: gatewayEVM,
    POLYGON_GATEWAY_ADDRESS: gatewayEVM,
    BASE_USDC_ADDRESS: usdcERC20,
    ZETA_GATEWAY_ZEVM_ADDRESS: gatewayZEVM,
    POLYGON_GAS_ZRC20: polygonGasZRC20,
    // RPC URLs for demo
    BASE_RPC: "http://localhost:8545",
    POLYGON_RPC: "http://localhost:8545",
    ZETA_RPC: "http://localhost:8545",
  };

  const deployedPath = path.join(process.cwd(), "deployed.json");
  fs.writeFileSync(deployedPath, JSON.stringify(deployedAddresses, null, 2));
  console.log(`\nSaved deployed addresses to: ${deployedPath}`);

  console.log("\n=== Ready for Demo ===");
  console.log("Run: pnpm demo:phase1");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
