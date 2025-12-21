/**
 * NFT Deploy API - One-click mint + escrow deposit
 *
 * POST /api/products/deploy
 *
 * Supports multiple EVM chains. Currently implemented: Polygon Amoy
 * Extensible to: Base Sepolia, Ethereum Sepolia, Arbitrum, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// Contract ABIs (minimal, works across all EVM chains)
const NFT_ABI = [
  "function mint(address to, uint256 tokenId) external",
  "function approve(address to, uint256 tokenId) external",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
];

const ESCROW_ABI = [
  "function deposit(address nftContract, uint256 tokenId) external",
  "function escrowedBy(address nftContract, uint256 tokenId) view returns (address)",
];

// Chain-specific configurations
// Add new chains by adding entries here
interface ChainConfig {
  name: string;
  rpcUrl: string;
  nftContract: string;
  escrowContract: string;
  deployerKey?: string;
  enabled: boolean;
  gasToken: string;
}

function getChainConfigs(): Record<string, ChainConfig> {
  return {
    polygon: {
      name: "Polygon Amoy",
      rpcUrl: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
      nftContract: process.env.POLYGON_MOCK_WEAPON_NFT || "0xE0EFF1C50040d7Fbcd56F5f0fcFCBad751c07c57",
      escrowContract: process.env.POLYGON_WEAPON_ESCROW || "0xC51ad62e3B794f9A9Caa349dec6C5c997c133922",
      deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
      enabled: true,
      gasToken: "MATIC",
    },
    base: {
      name: "Base Sepolia",
      rpcUrl: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      nftContract: process.env.BASE_MOCK_NFT || "",
      escrowContract: process.env.BASE_ESCROW || "",
      deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
      enabled: false, // Enable when contracts are deployed
      gasToken: "ETH",
    },
    ethereum: {
      name: "Ethereum Sepolia",
      rpcUrl: process.env.ETH_SEPOLIA_RPC || "https://rpc.sepolia.org",
      nftContract: process.env.ETH_MOCK_NFT || "",
      escrowContract: process.env.ETH_ESCROW || "",
      deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
      enabled: false, // Enable when contracts are deployed
      gasToken: "ETH",
    },
    arbitrum: {
      name: "Arbitrum Sepolia",
      rpcUrl: process.env.ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      nftContract: process.env.ARB_MOCK_NFT || "",
      escrowContract: process.env.ARB_ESCROW || "",
      deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
      enabled: false, // Enable when contracts are deployed
      gasToken: "ETH",
    },
    zetachain: {
      name: "ZetaChain Athens",
      rpcUrl: process.env.ZETA_ATHENS_RPC || "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
      nftContract: process.env.ZETA_MOCK_NFT || "",
      escrowContract: process.env.ZETA_ESCROW || "",
      deployerKey: process.env.DEPLOYER_PRIVATE_KEY,
      enabled: false, // Enable when contracts are deployed
      gasToken: "ZETA",
    },
  };
}

type SupportedChain = "polygon" | "base" | "ethereum" | "arbitrum" | "zetachain";

interface DeployRequest {
  chain: SupportedChain;
  sellerAddress: string;  // Address that will be the depositor
}

interface DeployResponse {
  ok: boolean;
  chain?: string;
  chainName?: string;
  tokenId?: number;
  nftContract?: string;
  escrowContract?: string;
  txHash?: string;
  error?: string;
}

// GET: Return supported chains and their status
export async function GET(): Promise<NextResponse> {
  const configs = getChainConfigs();

  const chains = Object.entries(configs).map(([id, config]) => ({
    id,
    name: config.name,
    enabled: config.enabled,
    gasToken: config.gasToken,
    hasContracts: Boolean(config.nftContract && config.escrowContract),
  }));

  return NextResponse.json({
    ok: true,
    chains,
    enabledChains: chains.filter(c => c.enabled).map(c => c.id),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse<DeployResponse>> {
  try {
    const body = await request.json() as DeployRequest;

    // Validate chain
    const configs = getChainConfigs();
    const chain = body.chain || "polygon";
    const chainConfig = configs[chain];

    if (!chainConfig) {
      const supportedChains = Object.keys(configs).join(", ");
      return NextResponse.json(
        { ok: false, error: `Unsupported chain: ${chain}. Supported: ${supportedChains}` },
        { status: 400 }
      );
    }

    if (!chainConfig.enabled) {
      return NextResponse.json(
        { ok: false, error: `Chain ${chainConfig.name} is not yet enabled. Coming soon!` },
        { status: 400 }
      );
    }

    // Validate seller address
    if (!body.sellerAddress || !ethers.isAddress(body.sellerAddress)) {
      return NextResponse.json(
        { ok: false, error: "Invalid seller address" },
        { status: 400 }
      );
    }

    // Check chain configuration
    if (!chainConfig.deployerKey) {
      return NextResponse.json(
        { ok: false, error: `Server not configured for ${chainConfig.name} deployment (missing deployer key)` },
        { status: 500 }
      );
    }

    if (!chainConfig.nftContract || !chainConfig.escrowContract) {
      return NextResponse.json(
        { ok: false, error: `Contracts not deployed on ${chainConfig.name} yet` },
        { status: 500 }
      );
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const deployerWallet = new ethers.Wallet(chainConfig.deployerKey, provider);

    console.log(`[Deploy][${chain}] Using deployer: ${deployerWallet.address}`);
    console.log(`[Deploy][${chain}] Seller address: ${body.sellerAddress}`);
    console.log(`[Deploy][${chain}] NFT contract: ${chainConfig.nftContract}`);
    console.log(`[Deploy][${chain}] Escrow contract: ${chainConfig.escrowContract}`);

    // Connect to contracts
    const nftContract = new ethers.Contract(chainConfig.nftContract, NFT_ABI, deployerWallet);
    const escrowContract = new ethers.Contract(chainConfig.escrowContract, ESCROW_ABI, deployerWallet);

    // Generate a unique token ID based on timestamp
    const tokenId = Math.floor(Date.now() / 1000) % 1000000000;
    console.log(`[Deploy][${chain}] Minting token ID: ${tokenId}`);

    // Step 1: Mint NFT to deployer (we need to approve and deposit)
    console.log(`[Deploy][${chain}] Step 1: Minting NFT...`);
    const mintTx = await nftContract.mint(deployerWallet.address, tokenId);
    await mintTx.wait();
    console.log(`[Deploy][${chain}] Minted NFT to deployer, tx: ${mintTx.hash}`);

    // Step 2: Approve escrow contract
    console.log(`[Deploy][${chain}] Step 2: Approving escrow...`);
    const approveTx = await nftContract.approve(chainConfig.escrowContract, tokenId);
    await approveTx.wait();
    console.log(`[Deploy][${chain}] Approved escrow, tx: ${approveTx.hash}`);

    // Step 3: Deposit to escrow
    console.log(`[Deploy][${chain}] Step 3: Depositing to escrow...`);
    const depositTx = await escrowContract.deposit(chainConfig.nftContract, tokenId);
    await depositTx.wait();
    console.log(`[Deploy][${chain}] Deposited to escrow, tx: ${depositTx.hash}`);

    // Verify deposit
    const escrower = await escrowContract.escrowedBy(chainConfig.nftContract, tokenId);
    console.log(`[Deploy][${chain}] NFT escrowed by: ${escrower}`);

    return NextResponse.json({
      ok: true,
      chain,
      chainName: chainConfig.name,
      tokenId,
      nftContract: chainConfig.nftContract,
      escrowContract: chainConfig.escrowContract,
      txHash: depositTx.hash,
    });

  } catch (error) {
    console.error("[Deploy] Error:", error);

    // Extract error message
    let errorMessage = "Deployment failed";
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check for common errors
      if (errorMessage.includes("insufficient funds")) {
        errorMessage = "Deployer wallet has insufficient gas. Please fund the deployer wallet.";
      } else if (errorMessage.includes("execution reverted")) {
        errorMessage = "Contract execution failed - check if deployer is NFT owner";
      } else if (errorMessage.includes("network")) {
        errorMessage = "Network connection failed - please try again";
      }
    }

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
