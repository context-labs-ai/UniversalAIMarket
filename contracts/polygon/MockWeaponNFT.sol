// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockWeaponNFT
 * @notice Simple ERC-721 NFT contract for game weapons
 * @dev Used for Phase 1 testing - represents a game item to be traded cross-chain
 */
contract MockWeaponNFT is ERC721, Ownable {
    constructor() ERC721("GameWeapon", "WEAPON") Ownable(msg.sender) {}

    /**
     * @notice Mint a new weapon NFT
     * @param to Address to receive the NFT
     * @param tokenId Token ID to mint
     */
    function mint(address to, uint256 tokenId) external onlyOwner {
        _mint(to, tokenId);
    }
}
