// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title WeaponEscrow
 * @notice Escrow contract for NFTs that can be released via ZetaChain cross-chain calls
 * @dev NFTs are deposited by sellers and released to buyers when triggered by ZetaChain Gateway
 */
contract WeaponEscrow is IERC721Receiver {
    /// @notice The Polygon Gateway address - only this can release NFTs
    address public immutable polygonGateway;

    /// @notice Tracking to prevent replay attacks
    mapping(bytes32 => bool) public processedDeals;

    /// @notice Escrow state: nft => tokenId => seller address
    mapping(address => mapping(uint256 => address)) public escrowedBy;

    /// @notice Emitted when an NFT is deposited into escrow
    event NFTDeposited(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed seller
    );

    /// @notice Emitted when an NFT is released from escrow to a buyer
    event NFTReleased(
        address indexed nft,
        uint256 indexed tokenId,
        address indexed buyer,
        bytes32 dealId
    );

    /// @notice Constructor
    /// @param _polygonGateway The Polygon Gateway address
    constructor(address _polygonGateway) {
        polygonGateway = _polygonGateway;
    }

    /**
     * @notice Seller deposits NFT into escrow
     * @param nft The NFT contract address
     * @param tokenId The token ID to deposit
     */
    function deposit(address nft, uint256 tokenId) external {
        require(escrowedBy[nft][tokenId] == address(0), "Already escrowed");
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        escrowedBy[nft][tokenId] = msg.sender;
        emit NFTDeposited(nft, tokenId, msg.sender);
    }

    /**
     * @notice Release NFT to buyer - called via ZetaChain arbitrary call
     * @dev msg.sender will be Polygon Gateway when called cross-chain
     * @param buyer The address to receive the NFT
     * @param nft The NFT contract address
     * @param tokenId The token ID to transfer
     * @param dealId Unique deal identifier to prevent replay
     */
    function release(
        address buyer,
        address nft,
        uint256 tokenId,
        bytes32 dealId
    ) external {
        // Security: Only Polygon Gateway can call (for arbitrary call mode)
        require(msg.sender == polygonGateway, "Only gateway");

        // Prevent replay attacks
        require(!processedDeals[dealId], "Deal already processed");
        processedDeals[dealId] = true;

        // Verify NFT is escrowed
        require(escrowedBy[nft][tokenId] != address(0), "Not escrowed");

        // Transfer NFT to buyer
        IERC721(nft).transferFrom(address(this), buyer, tokenId);

        // Clear escrow state
        delete escrowedBy[nft][tokenId];

        emit NFTReleased(nft, tokenId, buyer, dealId);
    }

    /**
     * @notice Required to receive ERC721 tokens via safeTransferFrom
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
