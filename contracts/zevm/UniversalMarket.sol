// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@zetachain/protocol-contracts/contracts/zevm/interfaces/IGatewayZEVM.sol";
import "@zetachain/protocol-contracts/contracts/zevm/interfaces/IZRC20.sol";
import "@zetachain/protocol-contracts/contracts/zevm/interfaces/UniversalContract.sol";
import "@zetachain/protocol-contracts/contracts/Revert.sol";

/**
 * @title UniversalMarket
 * @notice ZetaChain Universal App for cross-chain NFT marketplace settlement
 * @dev Orchestrates payment to seller on Base and NFT delivery on Polygon
 */
contract UniversalMarket is Revertable {
    // === State ===
    IGatewayZEVM public immutable gateway;
    address public owner;

    /// @notice ZRC-20 gas token for Polygon outbound calls
    address public polygonGasZRC20;

    /// @notice Processed deals to prevent replay attacks
    mapping(bytes32 => bool) public processedDeals;

    // === Structs ===
    struct Deal {
        bytes32 dealId;
        address buyer;        // Buyer address (receives NFT on Polygon)
        address sellerBase;   // Seller receives payment on Base
        address polygonEscrow; // WeaponEscrow contract on Polygon
        address nft;          // NFT contract on Polygon
        uint256 tokenId;
        uint256 price;        // In USDC units (6 decimals)
        uint256 deadline;
    }

    // === Events ===
    event DealReceived(
        bytes32 indexed dealId,
        address indexed buyer,
        uint256 amount,
        address zrc20
    );
    event PaymentInitiated(
        bytes32 indexed dealId,
        address indexed seller,
        uint256 price
    );
    event ShipmentInitiated(
        bytes32 indexed dealId,
        address escrow,
        address nft,
        uint256 tokenId,
        uint256 gasUsed
    );
    event DealProcessed(bytes32 indexed dealId);

    // === Errors ===
    error Unauthorized();
    error OnlyOwner();
    error DealExpired();
    error InsufficientAmount();
    error DealAlreadyProcessed();
    error InsufficientGasToken();

    // === Modifiers ===
    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // === Constructor ===
    /// @notice Initialize UniversalMarket
    /// @param _gateway ZetaChain gateway address
    /// @param _polygonGasZRC20 ZRC-20 gas token for Polygon outbound calls
    constructor(address _gateway, address _polygonGasZRC20) {
        gateway = IGatewayZEVM(_gateway);
        polygonGasZRC20 = _polygonGasZRC20;
        owner = msg.sender;
    }

    // === Admin Functions ===
    /// @notice Update the Polygon gas ZRC-20 token address
    /// @param _polygonGasZRC20 New ZRC-20 gas token address
    function setPolygonGasZRC20(address _polygonGasZRC20) external onlyOwner {
        polygonGasZRC20 = _polygonGasZRC20;
    }

    // === Main Entry Point ===
    /// @notice Called by ZetaChain Gateway when buyer deposits on Base
    /// @param zrc20 The ZRC-20 token received (USDC.Base representation)
    /// @param amount Amount received
    /// @param message Encoded Deal struct
    function onCall(
        MessageContext calldata,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external onlyGateway {
        // Decode the deal
        Deal memory deal = abi.decode(message, (Deal));

        // Validations
        if (block.timestamp > deal.deadline) revert DealExpired();
        if (amount < deal.price) revert InsufficientAmount();
        if (processedDeals[deal.dealId]) revert DealAlreadyProcessed();

        // Mark as processed
        processedDeals[deal.dealId] = true;

        emit DealReceived(deal.dealId, deal.buyer, amount, zrc20);

        // Get gas token and fee for withdraw to Base
        (address gasZRC20, uint256 gasFee) = IZRC20(zrc20).withdrawGasFee();

        // Check if we have enough gas tokens for the withdrawal
        uint256 ourGasBalance = IZRC20(gasZRC20).balanceOf(address(this));
        if (ourGasBalance < gasFee) revert InsufficientGasToken();

        // === Step 1: Pay seller on Base ===
        if (amount > 0) {
            _withdrawToBase(zrc20, gasZRC20, deal.sellerBase, amount);
            emit PaymentInitiated(deal.dealId, deal.sellerBase, amount);
        }

        // === Step 2: Trigger NFT shipment on Polygon ===
        _triggerNFTShipment(deal);

        emit DealProcessed(deal.dealId);
    }

    /// @notice Withdraw ZRC-20 to Base chain
    /// @param zrc20 ZRC-20 token address (the token being withdrawn)
    /// @param gasZRC20 Gas token address (for paying gas fees)
    /// @param receiver Receiver address on Base
    /// @param amount Amount to withdraw
    function _withdrawToBase(
        address zrc20,
        address gasZRC20,
        address receiver,
        uint256 amount
    ) internal {
        // Approve gateway to spend the withdrawal token
        IZRC20(zrc20).approve(address(gateway), type(uint256).max);

        // Approve gateway to spend gas tokens (might be different from zrc20)
        IZRC20(gasZRC20).approve(address(gateway), type(uint256).max);

        // Prepare receiver as bytes
        bytes memory receiverBytes = abi.encodePacked(receiver);

        // Withdraw to Base
        gateway.withdraw(
            receiverBytes,
            amount,
            zrc20,
            RevertOptions({
                revertAddress: address(this),
                callOnRevert: false,
                abortAddress: address(0),
                revertMessage: "",
                onRevertGasLimit: 0
            })
        );
    }

    /// @notice Trigger NFT release on Polygon via cross-chain call
    /// @param deal Deal information
    function _triggerNFTShipment(Deal memory deal) internal {
        // Gas limit for the cross-chain call (200k is enough for NFT release)
        uint256 callGasLimit = 200000;

        // Get gas fee for Polygon call with MATCHING gas limit
        // IMPORTANT: Must use withdrawGasFeeWithGasLimit to match what gateway.call() uses internally
        (, uint256 polygonGasFee) = IZRC20(polygonGasZRC20).withdrawGasFeeWithGasLimit(callGasLimit);

        // Ensure contract has enough gas tokens
        uint256 gasBalance = IZRC20(polygonGasZRC20).balanceOf(address(this));
        if (gasBalance < polygonGasFee) revert InsufficientGasToken();

        // Approve gateway to spend gas tokens
        IZRC20(polygonGasZRC20).approve(address(gateway), type(uint256).max);

        // Encode the call to WeaponEscrow.release(buyer, nft, tokenId, dealId)
        bytes memory callData = abi.encodeWithSignature(
            "release(address,address,uint256,bytes32)",
            deal.buyer,
            deal.nft,
            deal.tokenId,
            deal.dealId
        );

        // Prepare escrow address as bytes
        bytes memory escrowBytes = abi.encodePacked(deal.polygonEscrow);

        // Call Polygon escrow (arbitrary call mode)
        gateway.call(
            escrowBytes,
            polygonGasZRC20,
            callData,
            CallOptions({gasLimit: callGasLimit, isArbitraryCall: true}),
            RevertOptions({
                revertAddress: address(this),
                callOnRevert: false,
                abortAddress: address(0),
                revertMessage: "",
                onRevertGasLimit: 0
            })
        );

        emit ShipmentInitiated(
            deal.dealId,
            deal.polygonEscrow,
            deal.nft,
            deal.tokenId,
            polygonGasFee
        );
    }

    /// @notice Handle reverts from cross-chain calls
    /// @param context Revert context from the gateway
    function onRevert(RevertContext calldata context) external onlyGateway {
        // Future: implement recovery logic (refunds, etc.)
    }

    /// @notice Allow contract to receive native gas tokens
    receive() external payable {}
}
