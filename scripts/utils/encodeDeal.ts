import { ethers } from "ethers";
import { Deal, computeDealId } from "../../types/Deal";

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
      "tuple(bytes32 dealId, address buyer, address sellerBase, address polygonEscrow, address nft, uint256 tokenId, uint256 price, uint256 deadline)",
    ],
    [
      [
        deal.dealId,
        deal.buyer,
        deal.sellerBase,
        deal.polygonEscrow,
        deal.nft,
        deal.tokenId,
        deal.price,
        deal.deadline,
      ],
    ]
  );
}

export { Deal, computeDealId };
