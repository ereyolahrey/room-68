// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LivingSpaceNFT.sol";

/// @title LendingPool - P2P lending with USDC and NFT collateral support
/// @notice Agents can lend USDC liquidity, borrow against USDC collateral or living space NFTs
contract LendingPool is Ownable, ReentrancyGuard {
    IERC20 public paymentToken;
    LivingSpaceNFT public spaceNFT;

    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public minCollateralRatioBps = 15000; // 150% collateral ratio
    uint256 public liquidationThresholdBps = 12000; // 120% triggers liquidation
    uint256 public baseInterestRateBps = 500; // 5% base annual rate
    uint256 public maxInterestRateBps = 3000; // 30% max annual rate
    uint256 public nftLtvBps = 5000; // 50% loan-to-value for NFT collateral

    struct LendOffer {
        uint256 id;
        address lender;
        uint256 amount;
        uint256 remainingAmount;
        uint256 interestRateBps;
        uint256 minDuration;
        uint256 maxDuration;
        bool active;
        uint256 createdAt;
    }

    struct Loan {
        uint256 id;
        uint256 offerId;
        address borrower;
        address lender;
        uint256 principal;
        uint256 collateral;      // R68 token collateral
        uint256 nftCollateral;   // NFT token ID (type(uint256).max if none)
        uint256 interestRateBps;
        uint256 startTime;
        uint256 duration;
        uint256 interestAccrued;
        bool repaid;
        bool liquidated;
    }

    mapping(uint256 => LendOffer) public offers;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256) public totalLent;
    mapping(address => uint256) public totalBorrowed;
    mapping(address => uint256) public collateralBalance;

    // NFT collateral tracking
    mapping(uint256 => bool) public nftLocked; // tokenId => is locked as collateral

    uint256 public nextOfferId;
    uint256 public nextLoanId;
    uint256 public totalPoolLiquidity;

    event OfferCreated(uint256 indexed offerId, address indexed lender, uint256 amount, uint256 interestRate);
    event OfferCancelled(uint256 indexed offerId);
    event LoanCreated(uint256 indexed loanId, uint256 indexed offerId, address borrower, uint256 principal, uint256 collateral);
    event NFTLoanCreated(uint256 indexed loanId, uint256 indexed offerId, address borrower, uint256 principal, uint256 nftTokenId);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 interest);
    event LoanLiquidated(uint256 indexed loanId, address liquidator, uint256 collateralSeized);
    event NFTLiquidated(uint256 indexed loanId, address liquidator, uint256 nftTokenId);
    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);

    constructor(address _paymentToken, address _spaceNFT) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        spaceNFT = LivingSpaceNFT(_spaceNFT);
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        collateralBalance[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        require(collateralBalance[msg.sender] >= amount, "Insufficient collateral");
        collateralBalance[msg.sender] -= amount;
        require(paymentToken.transfer(msg.sender, amount), "Transfer failed");
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function createOffer(
        uint256 amount,
        uint256 interestRateBps,
        uint256 minDurationDays,
        uint256 maxDurationDays
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(interestRateBps >= baseInterestRateBps && interestRateBps <= maxInterestRateBps, "Invalid rate");
        require(minDurationDays >= 1 && maxDurationDays <= 365, "Invalid duration");
        require(minDurationDays <= maxDurationDays, "Min > max duration");

        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 offerId = nextOfferId++;
        offers[offerId] = LendOffer({
            id: offerId,
            lender: msg.sender,
            amount: amount,
            remainingAmount: amount,
            interestRateBps: interestRateBps,
            minDuration: minDurationDays * 1 days,
            maxDuration: maxDurationDays * 1 days,
            active: true,
            createdAt: block.timestamp
        });

        totalLent[msg.sender] += amount;
        totalPoolLiquidity += amount;

        emit OfferCreated(offerId, msg.sender, amount, interestRateBps);
        return offerId;
    }

    function cancelOffer(uint256 offerId) external nonReentrant {
        LendOffer storage offer = offers[offerId];
        require(offer.lender == msg.sender, "Not the lender");
        require(offer.active, "Offer not active");

        offer.active = false;
        uint256 remaining = offer.remainingAmount;
        offer.remainingAmount = 0;

        totalLent[msg.sender] -= remaining;
        totalPoolLiquidity -= remaining;

        require(paymentToken.transfer(msg.sender, remaining), "Transfer failed");
        emit OfferCancelled(offerId);
    }

    /// @notice Borrow with R68 token collateral
    function borrow(uint256 offerId, uint256 amount, uint256 durationDays) external nonReentrant returns (uint256) {
        LendOffer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(amount > 0 && amount <= offer.remainingAmount, "Invalid amount");

        uint256 duration = durationDays * 1 days;
        require(duration >= offer.minDuration && duration <= offer.maxDuration, "Invalid duration");

        uint256 requiredCollateral = (amount * minCollateralRatioBps) / BASIS_POINTS;
        require(collateralBalance[msg.sender] >= requiredCollateral, "Insufficient collateral");

        collateralBalance[msg.sender] -= requiredCollateral;

        offer.remainingAmount -= amount;
        if (offer.remainingAmount == 0) {
            offer.active = false;
        }

        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            id: loanId,
            offerId: offerId,
            borrower: msg.sender,
            lender: offer.lender,
            principal: amount,
            collateral: requiredCollateral,
            nftCollateral: type(uint256).max,
            interestRateBps: offer.interestRateBps,
            startTime: block.timestamp,
            duration: duration,
            interestAccrued: 0,
            repaid: false,
            liquidated: false
        });

        totalBorrowed[msg.sender] += amount;
        totalPoolLiquidity -= amount;

        require(paymentToken.transfer(msg.sender, amount), "Transfer failed");

        emit LoanCreated(loanId, offerId, msg.sender, amount, requiredCollateral);
        return loanId;
    }

    /// @notice Borrow using a living space NFT as collateral (50% LTV of space value)
    function borrowWithNFT(uint256 offerId, uint256 nftTokenId, uint256 durationDays) external nonReentrant returns (uint256) {
        LendOffer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(spaceNFT.ownerOf(nftTokenId) == msg.sender, "Not NFT owner");
        require(!nftLocked[nftTokenId], "NFT already locked");

        LivingSpaceNFT.LivingSpace memory space = spaceNFT.getSpace(nftTokenId);
        uint256 maxBorrow = (space.value * nftLtvBps) / BASIS_POINTS;
        require(maxBorrow > 0 && maxBorrow <= offer.remainingAmount, "NFT value insufficient or exceeds offer");

        uint256 duration = durationDays * 1 days;
        require(duration >= offer.minDuration && duration <= offer.maxDuration, "Invalid duration");

        // Lock the NFT
        spaceNFT.transferFrom(msg.sender, address(this), nftTokenId);
        spaceNFT.setSpaceStatus(nftTokenId, LivingSpaceNFT.SpaceStatus.Collateralized);
        nftLocked[nftTokenId] = true;

        offer.remainingAmount -= maxBorrow;
        if (offer.remainingAmount == 0) {
            offer.active = false;
        }

        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            id: loanId,
            offerId: offerId,
            borrower: msg.sender,
            lender: offer.lender,
            principal: maxBorrow,
            collateral: 0,
            nftCollateral: nftTokenId,
            interestRateBps: offer.interestRateBps,
            startTime: block.timestamp,
            duration: duration,
            interestAccrued: 0,
            repaid: false,
            liquidated: false
        });

        totalBorrowed[msg.sender] += maxBorrow;
        totalPoolLiquidity -= maxBorrow;

        require(paymentToken.transfer(msg.sender, maxBorrow), "Transfer failed");

        emit NFTLoanCreated(loanId, offerId, msg.sender, maxBorrow, nftTokenId);
        return loanId;
    }

    function calculateInterest(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (loan.repaid || loan.liquidated) return 0;

        uint256 elapsed = block.timestamp - loan.startTime;
        return (loan.principal * loan.interestRateBps * elapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not the borrower");
        require(!loan.repaid && !loan.liquidated, "Loan inactive");

        uint256 interest = calculateInterest(loanId);
        uint256 totalRepayment = loan.principal + interest;

        loan.repaid = true;
        loan.interestAccrued = interest;

        require(paymentToken.transferFrom(msg.sender, address(this), totalRepayment), "Repayment failed");

        // Return collateral
        if (loan.nftCollateral != type(uint256).max) {
            // Return NFT
            nftLocked[loan.nftCollateral] = false;
            spaceNFT.setSpaceStatus(loan.nftCollateral, LivingSpaceNFT.SpaceStatus.Occupied);
            spaceNFT.transferFrom(address(this), msg.sender, loan.nftCollateral);
        } else {
            // Return R68 collateral
            require(paymentToken.transfer(msg.sender, loan.collateral), "Collateral return failed");
        }

        require(paymentToken.transfer(loan.lender, totalRepayment), "Lender payment failed");

        totalBorrowed[msg.sender] -= loan.principal;
        totalPoolLiquidity += loan.principal;

        emit LoanRepaid(loanId, loan.principal, interest);
    }

    function liquidate(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.repaid && !loan.liquidated, "Loan inactive");

        uint256 interest = calculateInterest(loanId);
        uint256 totalDebt = loan.principal + interest;

        bool expired = block.timestamp > loan.startTime + loan.duration;

        if (loan.nftCollateral != type(uint256).max) {
            // NFT-backed loan: only liquidate if expired
            require(expired, "NFT loan not expired");

            loan.liquidated = true;
            loan.interestAccrued = interest;

            // Lender gets the NFT
            nftLocked[loan.nftCollateral] = false;
            spaceNFT.setSpaceStatus(loan.nftCollateral, LivingSpaceNFT.SpaceStatus.Available);
            spaceNFT.transferFrom(address(this), loan.lender, loan.nftCollateral);

            emit NFTLiquidated(loanId, msg.sender, loan.nftCollateral);
        } else {
            // R68-backed loan
            bool underCollateralized = (loan.collateral * BASIS_POINTS) / totalDebt < liquidationThresholdBps;
            require(expired || underCollateralized, "Not liquidatable");

            loan.liquidated = true;
            loan.interestAccrued = interest;

            uint256 liquidatorBonus = (loan.collateral * 500) / BASIS_POINTS;
            uint256 lenderShare = loan.collateral - liquidatorBonus;

            require(paymentToken.transfer(msg.sender, liquidatorBonus), "Bonus failed");
            require(paymentToken.transfer(loan.lender, lenderShare), "Lender share failed");

            emit LoanLiquidated(loanId, msg.sender, loan.collateral);
        }

        totalBorrowed[loan.borrower] -= loan.principal;
    }

    function utilizationRate() external view returns (uint256) {
        if (totalPoolLiquidity == 0) return 0;
        uint256 totalBorrowedAmount = 0;
        for (uint256 i = 0; i < nextLoanId; i++) {
            if (!loans[i].repaid && !loans[i].liquidated) {
                totalBorrowedAmount += loans[i].principal;
            }
        }
        return (totalBorrowedAmount * BASIS_POINTS) / (totalPoolLiquidity + totalBorrowedAmount);
    }

    function updateParameters(
        uint256 _minCollateralRatioBps,
        uint256 _liquidationThresholdBps,
        uint256 _baseInterestRateBps,
        uint256 _maxInterestRateBps
    ) external onlyOwner {
        require(_minCollateralRatioBps > _liquidationThresholdBps, "Invalid collateral params");
        require(_baseInterestRateBps < _maxInterestRateBps, "Invalid rate params");
        minCollateralRatioBps = _minCollateralRatioBps;
        liquidationThresholdBps = _liquidationThresholdBps;
        baseInterestRateBps = _baseInterestRateBps;
        maxInterestRateBps = _maxInterestRateBps;
    }
}
