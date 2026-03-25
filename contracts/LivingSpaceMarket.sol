// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Room68Token.sol";
import "./LivingSpaceNFT.sol";

/// @title LivingSpaceMarket - Marketplace for buying, selling, and bidding on living spaces
/// @notice Agents can list spaces for sale, buy outright, or make down payments with proof of reserves
contract LivingSpaceMarket is Ownable, ReentrancyGuard {
    Room68Token public r68Token;
    LivingSpaceNFT public spaceNFT;

    uint256 public platformFeeBps = 250; // 2.5% fee
    uint256 public constant MAX_FEE_BPS = 1000; // 10% max

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
        uint256 listedAt;
    }

    struct DownPayment {
        uint256 tokenId;
        address buyer;
        uint256 totalPrice;
        uint256 amountPaid;
        uint256 deadline;
        bool completed;
        bool defaulted;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => DownPayment) public downPayments;
    uint256 public nextDownPaymentId;

    // Track all active listing token IDs
    uint256[] public activeListingIds;
    mapping(uint256 => uint256) private listingIndex; // tokenId => index in activeListingIds

    event SpaceListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event SpaceDelisted(uint256 indexed tokenId);
    event SpaceSold(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event DownPaymentCreated(uint256 indexed dpId, uint256 indexed tokenId, address buyer, uint256 totalPrice, uint256 initialPayment);
    event DownPaymentInstallment(uint256 indexed dpId, uint256 amount, uint256 totalPaid);
    event DownPaymentCompleted(uint256 indexed dpId, uint256 indexed tokenId, address buyer);
    event DownPaymentDefaulted(uint256 indexed dpId, uint256 indexed tokenId);

    constructor(address _r68Token, address _spaceNFT) Ownable(msg.sender) {
        r68Token = Room68Token(_r68Token);
        spaceNFT = LivingSpaceNFT(_spaceNFT);
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = _feeBps;
    }

    /// @notice List a living space for sale
    function listSpace(uint256 tokenId, uint256 price) external nonReentrant {
        require(spaceNFT.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be > 0");
        require(!listings[tokenId].active, "Already listed");

        // Transfer NFT to market for escrow
        spaceNFT.transferFrom(msg.sender, address(this), tokenId);
        spaceNFT.setSpaceStatus(tokenId, LivingSpaceNFT.SpaceStatus.Listed);

        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true,
            listedAt: block.timestamp
        });

        activeListingIds.push(tokenId);
        listingIndex[tokenId] = activeListingIds.length - 1;

        emit SpaceListed(tokenId, msg.sender, price);
    }

    /// @notice Cancel a listing and reclaim the NFT
    function delistSpace(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;
        spaceNFT.setSpaceStatus(tokenId, LivingSpaceNFT.SpaceStatus.Available);
        spaceNFT.transferFrom(address(this), msg.sender, tokenId);

        _removeActiveListing(tokenId);
        emit SpaceDelisted(tokenId);
    }

    /// @notice Buy a listed space outright
    function buySpace(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");

        uint256 price = listing.price;
        uint256 fee = (price * platformFeeBps) / 10000;
        uint256 sellerProceeds = price - fee;

        listing.active = false;

        // Transfer payment
        require(r68Token.transferFrom(msg.sender, listing.seller, sellerProceeds), "Payment failed");
        if (fee > 0) {
            require(r68Token.transferFrom(msg.sender, owner(), fee), "Fee transfer failed");
        }

        // Transfer NFT to buyer
        spaceNFT.setSpaceStatus(tokenId, LivingSpaceNFT.SpaceStatus.Occupied);
        spaceNFT.transferFrom(address(this), msg.sender, tokenId);

        _removeActiveListing(tokenId);
        emit SpaceSold(tokenId, msg.sender, price);
    }

    /// @notice Start a down payment plan (minimum 20% down, proof of reserves via token balance)
    function startDownPayment(uint256 tokenId, uint256 initialPayment, uint256 deadlineDays) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(deadlineDays >= 7 && deadlineDays <= 90, "Deadline 7-90 days");

        uint256 minDown = listing.price / 5; // 20% minimum
        require(initialPayment >= minDown, "Min 20% down payment");

        // Proof of reserves: buyer must hold at least 50% of total price
        require(r68Token.balanceOf(msg.sender) >= listing.price / 2, "Insufficient reserves");

        listing.active = false;
        spaceNFT.setSpaceStatus(tokenId, LivingSpaceNFT.SpaceStatus.Locked);

        // Take initial payment
        uint256 fee = (initialPayment * platformFeeBps) / 10000;
        require(r68Token.transferFrom(msg.sender, listing.seller, initialPayment - fee), "Payment failed");
        if (fee > 0) {
            require(r68Token.transferFrom(msg.sender, owner(), fee), "Fee failed");
        }

        uint256 dpId = nextDownPaymentId++;
        downPayments[dpId] = DownPayment({
            tokenId: tokenId,
            buyer: msg.sender,
            totalPrice: listing.price,
            amountPaid: initialPayment,
            deadline: block.timestamp + (deadlineDays * 1 days),
            completed: false,
            defaulted: false
        });

        _removeActiveListing(tokenId);
        emit DownPaymentCreated(dpId, tokenId, msg.sender, listing.price, initialPayment);
    }

    /// @notice Make an installment payment on a down payment plan
    function payInstallment(uint256 dpId, uint256 amount) external nonReentrant {
        DownPayment storage dp = downPayments[dpId];
        require(dp.buyer == msg.sender, "Not the buyer");
        require(!dp.completed && !dp.defaulted, "DP inactive");
        require(block.timestamp <= dp.deadline, "Past deadline");
        require(amount > 0, "Amount must be > 0");

        uint256 remaining = dp.totalPrice - dp.amountPaid;
        uint256 payment = amount > remaining ? remaining : amount;

        uint256 fee = (payment * platformFeeBps) / 10000;
        require(r68Token.transferFrom(msg.sender, listings[dp.tokenId].seller, payment - fee), "Payment failed");
        if (fee > 0) {
            require(r68Token.transferFrom(msg.sender, owner(), fee), "Fee failed");
        }

        dp.amountPaid += payment;
        emit DownPaymentInstallment(dpId, payment, dp.amountPaid);

        // If fully paid, transfer NFT
        if (dp.amountPaid >= dp.totalPrice) {
            dp.completed = true;
            spaceNFT.setSpaceStatus(dp.tokenId, LivingSpaceNFT.SpaceStatus.Occupied);
            spaceNFT.transferFrom(address(this), msg.sender, dp.tokenId);
            emit DownPaymentCompleted(dpId, dp.tokenId, msg.sender);
        }
    }

    /// @notice Mark a down payment as defaulted (callable by seller after deadline)
    function claimDefault(uint256 dpId) external nonReentrant {
        DownPayment storage dp = downPayments[dpId];
        require(!dp.completed && !dp.defaulted, "DP inactive");
        require(block.timestamp > dp.deadline, "Deadline not passed");
        require(listings[dp.tokenId].seller == msg.sender, "Not the seller");

        dp.defaulted = true;
        spaceNFT.setSpaceStatus(dp.tokenId, LivingSpaceNFT.SpaceStatus.Available);
        spaceNFT.transferFrom(address(this), msg.sender, dp.tokenId);
        emit DownPaymentDefaulted(dpId, dp.tokenId);
    }

    function getActiveListings() external view returns (uint256[] memory) {
        return activeListingIds;
    }

    function _removeActiveListing(uint256 tokenId) internal {
        uint256 index = listingIndex[tokenId];
        uint256 lastIndex = activeListingIds.length - 1;
        if (index != lastIndex) {
            uint256 lastTokenId = activeListingIds[lastIndex];
            activeListingIds[index] = lastTokenId;
            listingIndex[lastTokenId] = index;
        }
        activeListingIds.pop();
        delete listingIndex[tokenId];
    }
}
