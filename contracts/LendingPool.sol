// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Room68Token.sol";

/// @title LendingPool - Peer-to-peer lending and borrowing of R68 tokens
/// @notice Agents can lend liquidity to earn interest or borrow against collateral
contract LendingPool is Ownable, ReentrancyGuard {
    Room68Token public r68Token;

    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public minCollateralRatioBps = 15000; // 150% collateral ratio
    uint256 public liquidationThresholdBps = 12000; // 120% triggers liquidation
    uint256 public baseInterestRateBps = 500; // 5% base annual rate
    uint256 public maxInterestRateBps = 3000; // 30% max annual rate

    struct LendOffer {
        uint256 id;
        address lender;
        uint256 amount;
        uint256 remainingAmount;
        uint256 interestRateBps; // annual interest in basis points
        uint256 minDuration;     // minimum loan duration in seconds
        uint256 maxDuration;     // maximum loan duration in seconds
        bool active;
        uint256 createdAt;
    }

    struct Loan {
        uint256 id;
        uint256 offerId;
        address borrower;
        address lender;
        uint256 principal;
        uint256 collateral;
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

    uint256 public nextOfferId;
    uint256 public nextLoanId;
    uint256 public totalPoolLiquidity;

    event OfferCreated(uint256 indexed offerId, address indexed lender, uint256 amount, uint256 interestRate);
    event OfferCancelled(uint256 indexed offerId);
    event LoanCreated(uint256 indexed loanId, uint256 indexed offerId, address borrower, uint256 principal, uint256 collateral);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 interest);
    event LoanLiquidated(uint256 indexed loanId, address liquidator, uint256 collateralSeized);
    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);

    constructor(address _r68Token) Ownable(msg.sender) {
        r68Token = Room68Token(_r68Token);
    }

    /// @notice Deposit collateral for future borrowing
    function depositCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(r68Token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        collateralBalance[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Withdraw unused collateral
    function withdrawCollateral(uint256 amount) external nonReentrant {
        require(collateralBalance[msg.sender] >= amount, "Insufficient collateral");
        collateralBalance[msg.sender] -= amount;
        require(r68Token.transfer(msg.sender, amount), "Transfer failed");
        emit CollateralWithdrawn(msg.sender, amount);
    }

    /// @notice Create a lending offer
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

        require(r68Token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

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

    /// @notice Cancel an active lending offer and reclaim remaining funds
    function cancelOffer(uint256 offerId) external nonReentrant {
        LendOffer storage offer = offers[offerId];
        require(offer.lender == msg.sender, "Not the lender");
        require(offer.active, "Offer not active");

        offer.active = false;
        uint256 remaining = offer.remainingAmount;
        offer.remainingAmount = 0;

        totalLent[msg.sender] -= remaining;
        totalPoolLiquidity -= remaining;

        require(r68Token.transfer(msg.sender, remaining), "Transfer failed");
        emit OfferCancelled(offerId);
    }

    /// @notice Borrow from a lending offer — collateral must already be deposited
    function borrow(uint256 offerId, uint256 amount, uint256 durationDays) external nonReentrant returns (uint256) {
        LendOffer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(amount > 0 && amount <= offer.remainingAmount, "Invalid amount");

        uint256 duration = durationDays * 1 days;
        require(duration >= offer.minDuration && duration <= offer.maxDuration, "Invalid duration");

        // Check collateral requirement
        uint256 requiredCollateral = (amount * minCollateralRatioBps) / BASIS_POINTS;
        require(collateralBalance[msg.sender] >= requiredCollateral, "Insufficient collateral");

        // Lock collateral
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
            interestRateBps: offer.interestRateBps,
            startTime: block.timestamp,
            duration: duration,
            interestAccrued: 0,
            repaid: false,
            liquidated: false
        });

        totalBorrowed[msg.sender] += amount;
        totalPoolLiquidity -= amount;

        // Transfer borrowed amount to borrower
        require(r68Token.transfer(msg.sender, amount), "Transfer failed");

        emit LoanCreated(loanId, offerId, msg.sender, amount, requiredCollateral);
        return loanId;
    }

    /// @notice Calculate accrued interest on a loan
    function calculateInterest(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (loan.repaid || loan.liquidated) return 0;

        uint256 elapsed = block.timestamp - loan.startTime;
        return (loan.principal * loan.interestRateBps * elapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);
    }

    /// @notice Repay a loan (principal + interest)
    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not the borrower");
        require(!loan.repaid && !loan.liquidated, "Loan inactive");

        uint256 interest = calculateInterest(loanId);
        uint256 totalRepayment = loan.principal + interest;

        loan.repaid = true;
        loan.interestAccrued = interest;

        // Take repayment from borrower
        require(r68Token.transferFrom(msg.sender, address(this), totalRepayment), "Repayment failed");

        // Return collateral to borrower
        require(r68Token.transfer(msg.sender, loan.collateral), "Collateral return failed");

        // Send principal + interest to lender
        require(r68Token.transfer(loan.lender, totalRepayment), "Lender payment failed");

        totalBorrowed[msg.sender] -= loan.principal;
        totalPoolLiquidity += loan.principal;

        emit LoanRepaid(loanId, loan.principal, interest);
    }

    /// @notice Liquidate an under-collateralized or expired loan
    function liquidate(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.repaid && !loan.liquidated, "Loan inactive");

        uint256 interest = calculateInterest(loanId);
        uint256 totalDebt = loan.principal + interest;

        // Allow liquidation if: expired OR under-collateralized
        bool expired = block.timestamp > loan.startTime + loan.duration;
        bool underCollateralized = (loan.collateral * BASIS_POINTS) / totalDebt < liquidationThresholdBps;

        require(expired || underCollateralized, "Not liquidatable");

        loan.liquidated = true;
        loan.interestAccrued = interest;

        // Liquidator gets a 5% bonus from collateral
        uint256 liquidatorBonus = (loan.collateral * 500) / BASIS_POINTS;
        uint256 lenderShare = loan.collateral - liquidatorBonus;

        require(r68Token.transfer(msg.sender, liquidatorBonus), "Bonus failed");
        require(r68Token.transfer(loan.lender, lenderShare), "Lender share failed");

        totalBorrowed[loan.borrower] -= loan.principal;

        emit LoanLiquidated(loanId, msg.sender, loan.collateral);
    }

    /// @notice Get the utilization rate of the pool
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
