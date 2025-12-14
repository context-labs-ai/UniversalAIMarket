# Universal AI Market

> Cross-chain NFT Marketplace powered by ZetaChain

A decentralized marketplace that enables seamless cross-chain NFT trading. Buyers pay with USDC on Base, sellers receive payment on Base, and NFTs are delivered from Polygon - all orchestrated atomically through ZetaChain's Universal App.

## How It Works

```
                            CROSS-CHAIN SETTLEMENT FLOW

  BASE CHAIN                   ZETACHAIN                    POLYGON
  ----------                   ---------                    -------
      |                            |                            |
  [Buyer]                          |                      [WeaponEscrow]
      |                            |                        holds NFT
      | 1. depositAndCall          |                            |
      |    (80 USDC + Deal)        |                            |
      |--------------------------->|                            |
      |                            |                            |
      |                    [UniversalMarket]                    |
      |                      receives call                      |
      |                            |                            |
      |                            | 2. gateway.withdraw        |
      |<---------------------------|    (80 USDC to seller)     |
      |                            |                            |
  [Seller]                         | 3. gateway.call            |
  receives                         |--------------------------->|
  80 USDC                          |    release(buyer, nft)     |
      |                            |                            |
      |                            |                      [Buyer]
      |                            |                      receives
      |                            |                        NFT
```

### Settlement Flow

1. **Buyer initiates purchase** - Calls `depositAndCall` on Base Gateway with USDC payment and deal details
2. **ZetaChain orchestrates** - UniversalMarket receives the cross-chain message with the payment
3. **Seller gets paid** - UniversalMarket calls `gateway.withdraw` to send USDC to seller on Base
4. **NFT delivered** - UniversalMarket calls `gateway.call` to trigger NFT release on Polygon
5. **Atomic settlement** - Both payment and NFT transfer happen in one cross-chain transaction

## Smart Contracts

| Contract | Chain | Description |
|----------|-------|-------------|
| `UniversalMarket` | ZetaChain | Universal App that orchestrates cross-chain settlement |
| `WeaponEscrow` | Polygon | Holds NFTs in escrow, releases on cross-chain command |
| `MockWeaponNFT` | Polygon | ERC-721 NFT representing game items |

## Gas Fee Model

Cross-chain operations require gas fees on each destination chain. The marketplace supports three models:

| Model | Buyer Pays | Seller Receives | Marketplace |
|-------|-----------|-----------------|-------------|
| Buyer pays extra | Price + gas | Full price | No cost |
| Seller deduction | Price | Price - gas | No cost |
| Marketplace subsidizes | Price | Full price | Pays gas |

Current implementation uses the **marketplace subsidizes** model for best UX - the marketplace contract is pre-funded with gas tokens during deployment.

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm
- Foundry (for anvil)

### Installation

```bash
# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
pnpm install
```

### Run Locally

```bash
# Terminal 1: Start ZetaChain localnet
pnpm localnet:start

# Terminal 2: Deploy and run demo
pnpm deploy:local
pnpm demo:phase1
```

## Frontend Demo (Buyer Agent ↔ Seller Agent)

The Next.js app in `apps/web` is a hackathon-ready UI that shows:

- Buyer agent browsing stores/products
- Buyer ↔ seller agent negotiation with tool-call cards
- A full cross-chain timeline (Base Sepolia → Zeta Athens → Polygon Amoy)
- A single continuous Agent SSE stream (dialogue + tools + timeline)

### Run the frontend

```bash
cd apps/web
pnpm install
pnpm dev
```

Open http://localhost:3000 and click **Start Shopping** → **Run Settlement**.

- In the current Chinese UI: click **开始逛** to start the Agent flow.
- If `checkoutMode=confirm`, wait for **确认结算** and click it.
- If `checkoutMode=auto`, settlement starts automatically after the deal is prepared.

### Testnet mode (real transactions)

1. Deploy contracts: `pnpm deploy:all:testnet`
2. Create `apps/web/.env.local` with:
   - `BASE_GATEWAY_ADDRESS`, `BASE_USDC_ADDRESS`, `ZETA_UNIVERSAL_MARKET`
   - `POLYGON_WEAPON_ESCROW`, `POLYGON_MOCK_WEAPON_NFT`
   - `BUYER_PRIVATE_KEY`, `SELLER_PRIVATE_KEY`
   - Optional RPC overrides: `BASE_SEPOLIA_RPC`, `POLYGON_AMOY_RPC`, `ZETA_ATHENS_RPC`

If env/testnet funding is missing, the UI also supports **Simulation** mode.

### External Agent (LangChain) integration

The UI can proxy an external local Agent via SSE, while keeping the same judge-friendly UI:

- Built-in demo: `GET /api/agent/stream?engine=builtin`
- Proxy mode: `GET /api/agent/stream?engine=proxy&upstream=http://localhost:8080/api/agent/stream`
- Tools for your Agent to call: `POST /api/agent/tool`

There is a starter LangChain agent service under `apps/agent`:

- Install: `pnpm -C apps/agent install`
- Run: `pnpm agent:dev`

### Standalone Market site (apps/market)

For the “agent-friendly e-commerce” idea, there is also a standalone market website under `apps/market` (default port **3001**):

- Run: `pnpm -C apps/market install` then `pnpm market:dev`
- Discovery: `GET http://localhost:3001/.well-known/universal-ai-market.json`

### Expected Output

```
=== Cross-Chain Settlement Demo ===

USDC Balances:
  Buyer:  1000000.0 -> 999920.0 USDC
  Seller: 0.0 -> 80.0 USDC

NFT Ownership:
  Token #1: Escrow -> Buyer

=== Verification ===
[PASS] Buyer spent exactly 80.0 USDC
[PASS] Seller received 80.0 USDC
[PASS] NFT successfully transferred to buyer
```

## Project Structure

```
├── contracts/
│   ├── zevm/
│   │   └── UniversalMarket.sol      # ZetaChain Universal App
│   └── polygon/
│       ├── MockWeaponNFT.sol        # ERC-721 game item
│       └── WeaponEscrow.sol         # NFT escrow contract
├── scripts/
│   ├── deploy/
│   │   └── deploy_local.ts          # Localnet deployment
│   └── demo/
│       └── phase1_demo.ts           # E2E demo script
├── deployed.json                     # Contract addresses (auto-generated)
└── hardhat.config.ts
```

## Technical Details

### Deal Structure

```solidity
struct Deal {
    bytes32 dealId;        // Unique deal identifier
    address buyer;         // Buyer address (receives NFT on Polygon)
    address sellerBase;    // Seller address (receives payment on Base)
    address polygonEscrow; // Escrow contract on Polygon
    address nft;           // NFT contract address
    uint256 tokenId;       // NFT token ID
    uint256 price;         // Price in USDC (6 decimals)
    uint256 deadline;      // Deal expiration timestamp
}
```

### Cross-Chain Gas Handling

The UniversalMarket contract handles gas fees for outbound cross-chain calls:

```solidity
// For gateway.call(), must use matching gas limit for fee calculation
uint256 callGasLimit = 400000;
(, uint256 gasFee) = IZRC20(gasZRC20).withdrawGasFeeWithGasLimit(callGasLimit);
IZRC20(gasZRC20).approve(address(gateway), type(uint256).max);
gateway.call(..., CallOptions({gasLimit: callGasLimit, ...}));
```

Key insight: The gateway internally recalculates gas fees using `withdrawGasFeeWithGasLimit(callOptions.gasLimit)`. Your pre-calculated fee must match, or you'll get `LowAllowance` errors.

## Resources

- [ZetaChain Universal Apps](https://www.zetachain.com/docs/developers/chains/zetachain)
- [Gateway depositAndCall](https://www.zetachain.com/docs/developers/chains/evm/)
- [Cross-chain Calls Tutorial](https://www.zetachain.com/docs/developers/tutorials/call)

## License

MIT
