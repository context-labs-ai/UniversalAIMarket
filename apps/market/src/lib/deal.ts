import { ethers } from "ethers";

export interface Deal {
  dealId: string;
  buyer: string;
  sellerBase: string;
  polygonEscrow: string;
  nft: string;
  tokenId: bigint;
  price: bigint;
  deadline: bigint;
}

export type DealWithoutId = Omit<Deal, "dealId">;

export function computeDealId(deal: DealWithoutId) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["address", "address", "address", "address", "uint256", "uint256", "uint256"],
    [
      deal.buyer,
      deal.sellerBase,
      deal.polygonEscrow,
      deal.nft,
      deal.tokenId,
      deal.price,
      deal.deadline,
    ]
  );
  return ethers.keccak256(encoded);
}

export function createDeal(params: DealWithoutId): Deal {
  const dealId = computeDealId(params);
  return { dealId, ...params };
}

export function encodeDealPayload(deal: Deal) {
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

