/**
 * Deal type definitions for cross-chain marketplace transactions
 */

import { ethers } from 'ethers';

/**
 * Deal struct - represents an agreed transaction between buyer and seller
 * This must match the Solidity struct in UniversalMarket.sol
 */
export interface Deal {
  /** Unique identifier for the deal (keccak256 hash) */
  dealId: string;
  
  /** Buyer's address - receives NFT on Polygon */
  buyer: string;
  
  /** Seller's Base address - receives USDC payment */
  sellerBase: string;
  
  /** WeaponEscrow contract address on Polygon */
  polygonEscrow: string;
  
  /** MockWeaponNFT contract address on Polygon */
  nft: string;
  
  /** Token ID of the NFT being purchased */
  tokenId: bigint;
  
  /** Agreed price in USDC (with 6 decimals, e.g., 80000000 = 80 USDC) */
  price: bigint;
  
  /** Unix timestamp deadline for the deal */
  deadline: bigint;
}

/**
 * Deal without the dealId - used before computing the ID
 */
export type DealWithoutId = Omit<Deal, 'dealId'>;

/**
 * Compute the unique dealId from deal parameters
 * Must match the Solidity computation in UniversalMarket.sol
 * 
 * @param deal - Deal parameters without dealId
 * @returns bytes32 hex string of the dealId
 */
export function computeDealId(deal: DealWithoutId): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  const encoded = abiCoder.encode(
    ['address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
    [
      deal.buyer,
      deal.sellerBase,
      deal.polygonEscrow,
      deal.nft,
      deal.tokenId,
      deal.price,
      deal.deadline
    ]
  );
  
  return ethers.keccak256(encoded);
}

/**
 * Create a complete Deal object with computed dealId
 * 
 * @param params - Deal parameters without dealId
 * @returns Complete Deal with computed dealId
 */
export function createDeal(params: DealWithoutId): Deal {
  const dealId = computeDealId(params);
  return {
    dealId,
    ...params
  };
}

/**
 * Encode a Deal struct for cross-chain messaging
 * 
 * @param deal - Complete Deal object
 * @returns ABI-encoded bytes for the payload
 */
export function encodeDealPayload(deal: Deal): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  return abiCoder.encode(
    [
      'tuple(bytes32 dealId, address buyer, address sellerBase, address polygonEscrow, address nft, uint256 tokenId, uint256 price, uint256 deadline)'
    ],
    [[
      deal.dealId,
      deal.buyer,
      deal.sellerBase,
      deal.polygonEscrow,
      deal.nft,
      deal.tokenId,
      deal.price,
      deal.deadline
    ]]
  );
}

/**
 * Decode a Deal from ABI-encoded bytes
 * 
 * @param payload - ABI-encoded bytes
 * @returns Decoded Deal object
 */
export function decodeDealPayload(payload: string): Deal {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  const decoded = abiCoder.decode(
    [
      'tuple(bytes32 dealId, address buyer, address sellerBase, address polygonEscrow, address nft, uint256 tokenId, uint256 price, uint256 deadline)'
    ],
    payload
  );
  
  const tuple = decoded[0];
  
  return {
    dealId: tuple.dealId,
    buyer: tuple.buyer,
    sellerBase: tuple.sellerBase,
    polygonEscrow: tuple.polygonEscrow,
    nft: tuple.nft,
    tokenId: tuple.tokenId,
    price: tuple.price,
    deadline: tuple.deadline
  };
}

/**
 * Format USDC amount for display
 * 
 * @param amount - Amount in smallest units (6 decimals)
 * @returns Formatted string like "80.00 USDC"
 */
export function formatUSDC(amount: bigint): string {
  return `${ethers.formatUnits(amount, 6)} USDC`;
}

/**
 * Parse USDC amount from string
 * 
 * @param amount - Amount as string (e.g., "80.00")
 * @returns Amount in smallest units (6 decimals)
 */
export function parseUSDC(amount: string): bigint {
  return ethers.parseUnits(amount, 6);
}
