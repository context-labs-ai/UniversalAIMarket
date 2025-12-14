import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPresent(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function safeAddressFromPrivateKey(privateKey: string | undefined) {
  if (!isPresent(privateKey)) return undefined;
  try {
    return new ethers.Wallet(privateKey!).address;
  } catch {
    return undefined;
  }
}

export async function GET() {
  const requiredForTestnet = [
    "BASE_GATEWAY_ADDRESS",
    "BASE_USDC_ADDRESS",
    "ZETA_UNIVERSAL_MARKET",
    "POLYGON_WEAPON_ESCROW",
    "POLYGON_MOCK_WEAPON_NFT",
    "BUYER_PRIVATE_KEY",
    "SELLER_PRIVATE_KEY",
  ] as const;

  const missing = requiredForTestnet.filter((key) => !isPresent(process.env[key]));

  const buyer = safeAddressFromPrivateKey(process.env.BUYER_PRIVATE_KEY);
  const seller = safeAddressFromPrivateKey(process.env.SELLER_PRIVATE_KEY);
  if (!buyer) missing.push("BUYER_PRIVATE_KEY");
  if (!seller) missing.push("SELLER_PRIVATE_KEY");

  const payload = {
    modeHint: missing.length === 0 ? ("testnet" as const) : ("simulate" as const),
    accounts: buyer && seller ? { buyer, seller } : undefined,
    contracts: {
      baseGateway: process.env.BASE_GATEWAY_ADDRESS,
      baseUSDC: process.env.BASE_USDC_ADDRESS,
      universalMarket: process.env.ZETA_UNIVERSAL_MARKET,
      polygonEscrow: process.env.POLYGON_WEAPON_ESCROW,
      polygonNFT: process.env.POLYGON_MOCK_WEAPON_NFT,
    },
    missing: Array.from(new Set(missing)),
  };

  return NextResponse.json(payload);
}

