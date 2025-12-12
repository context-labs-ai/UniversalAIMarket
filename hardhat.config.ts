import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@zetachain/localnet/tasks";
import * as dotenv from "dotenv";

dotenv.config();

// Default private keys for testing (DO NOT USE IN PRODUCTION)
const DEFAULT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  networks: {
    // === Localnet Networks ===
    // ZetaChain localnet v4 uses a single anvil instance on port 8545
    // All chains (ZetaChain, Ethereum, BNB) share this endpoint
    localhost: {
      url: "http://localhost:8545",
      chainId: 31337,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.BUYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.SELLER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
      ],
    },
    // Aliases for clarity - all point to same localnet
    localEthereum: {
      url: "http://localhost:8545",
      chainId: 31337,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.BUYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.SELLER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
      ],
    },
    localBnb: {
      url: "http://localhost:8545",
      chainId: 31337,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.BUYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.SELLER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
      ],
    },
    localZeta: {
      url: "http://localhost:8545",
      chainId: 31337,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.BUYER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
        process.env.SELLER_PRIVATE_KEY || DEFAULT_PRIVATE_KEY,
      ],
    },
    
    // === Testnet Networks ===
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      chainId: 84532,
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY, process.env.BUYER_PRIVATE_KEY!, process.env.SELLER_PRIVATE_KEY!]
        : [],
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY, process.env.BUYER_PRIVATE_KEY!, process.env.SELLER_PRIVATE_KEY!]
        : [],
    },
    zetaAthens: {
      url: process.env.ZETA_ATHENS_RPC || "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
      chainId: 7001,
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY, process.env.BUYER_PRIVATE_KEY!, process.env.SELLER_PRIVATE_KEY!]
        : [],
    },
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
