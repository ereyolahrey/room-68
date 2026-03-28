// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title LivingSpaceNFT - NFTs representing living spaces in Room 68
/// @notice Max 68 living spaces. Agents can own, trade, stack, rent, and use as collateral.
contract LivingSpaceNFT is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 68;

    IERC20 public paymentToken; // USDC on ARC Testnet

    enum SpaceType { Studio, Apartment, Penthouse, Mansion, Estate }
    enum SpaceStatus { Available, Occupied, Listed, Locked, Rented, Collateralized }

    struct LivingSpace {
        uint256 id;
        string name;
        SpaceType spaceType;
        SpaceStatus status;
        uint256 value;
        uint256 createdAt;
        string metadataURI;
    }

    struct RentalAgreement {
        uint256 tokenId;
        address landlord;
        address tenant;
        uint256 monthlyRent;     // R68 per 30-day period
        uint256 deposit;         // security deposit in R68
        uint256 startTime;
        uint256 endTime;
        uint256 lastRentPaid;
        bool active;
    }

    mapping(uint256 => LivingSpace) public spaces;
    mapping(address => bool) public authorizedMarkets;
    mapping(uint256 => RentalAgreement) public rentals;
    uint256 public nextRentalId;

    // Rental listings
    struct RentalListing {
        uint256 tokenId;
        address landlord;
        uint256 monthlyRent;
        uint256 deposit;
        uint256 minMonths;
        uint256 maxMonths;
        bool active;
    }
    mapping(uint256 => RentalListing) public rentalListings;
    uint256[] public activeRentalListingIds;
    mapping(uint256 => uint256) private rentalListingIndex;

    event SpaceMinted(uint256 indexed tokenId, address indexed to, SpaceType spaceType, uint256 value);
    event SpaceStatusChanged(uint256 indexed tokenId, SpaceStatus newStatus);
    event MarketAuthorized(address indexed market);
    event MarketDeauthorized(address indexed market);
    event SpaceListedForRent(uint256 indexed tokenId, uint256 monthlyRent, uint256 deposit);
    event SpaceRented(uint256 indexed rentalId, uint256 indexed tokenId, address landlord, address tenant);
    event RentPaid(uint256 indexed rentalId, address tenant, uint256 amount);
    event RentalEnded(uint256 indexed rentalId, uint256 indexed tokenId);

    modifier onlyAuthorized() {
        require(authorizedMarkets[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address _paymentToken) ERC721("Room 68 Living Space", "R68SPACE") Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
    }

    function authorizeMarket(address _market) external onlyOwner {
        authorizedMarkets[_market] = true;
        emit MarketAuthorized(_market);
    }

    function deauthorizeMarket(address _market) external onlyOwner {
        authorizedMarkets[_market] = false;
        emit MarketDeauthorized(_market);
    }

    function mintSpace(
        address to,
        string calldata name,
        SpaceType spaceType,
        uint256 value,
        string calldata metadataURI
    ) external onlyAuthorized returns (uint256) {
        require(_nextTokenId < MAX_SUPPLY, "All 68 spaces minted");
        uint256 tokenId = _nextTokenId++;

        spaces[tokenId] = LivingSpace({
            id: tokenId,
            name: name,
            spaceType: spaceType,
            status: SpaceStatus.Available,
            value: value,
            createdAt: block.timestamp,
            metadataURI: metadataURI
        });

        _safeMint(to, tokenId);
        emit SpaceMinted(tokenId, to, spaceType, value);
        return tokenId;
    }

    function setSpaceStatus(uint256 tokenId, SpaceStatus status) external onlyAuthorized {
        require(tokenId < _nextTokenId, "Space does not exist");
        spaces[tokenId].status = status;
        emit SpaceStatusChanged(tokenId, status);
    }

    /// @notice List a space for rent
    function listForRent(
        uint256 tokenId,
        uint256 monthlyRent,
        uint256 deposit,
        uint256 minMonths,
        uint256 maxMonths
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(spaces[tokenId].status == SpaceStatus.Available || spaces[tokenId].status == SpaceStatus.Occupied, "Cannot rent");
        require(monthlyRent > 0, "Rent must be > 0");
        require(minMonths >= 1 && maxMonths <= 12 && minMonths <= maxMonths, "Invalid duration");

        rentalListings[tokenId] = RentalListing({
            tokenId: tokenId,
            landlord: msg.sender,
            monthlyRent: monthlyRent,
            deposit: deposit,
            minMonths: minMonths,
            maxMonths: maxMonths,
            active: true
        });

        activeRentalListingIds.push(tokenId);
        rentalListingIndex[tokenId] = activeRentalListingIds.length - 1;

        emit SpaceListedForRent(tokenId, monthlyRent, deposit);
    }

    /// @notice Rent a listed space — pay deposit + first month upfront
    function rentSpace(uint256 tokenId, uint256 months) external nonReentrant {
        RentalListing storage listing = rentalListings[tokenId];
        require(listing.active, "Not listed for rent");
        require(months >= listing.minMonths && months <= listing.maxMonths, "Invalid duration");
        require(msg.sender != listing.landlord, "Cannot rent own space");

        require(paymentToken.transferFrom(msg.sender, address(this), listing.deposit), "Deposit failed");
        require(paymentToken.transferFrom(msg.sender, listing.landlord, listing.monthlyRent), "First rent failed");

        listing.active = false;
        _removeRentalListing(tokenId);

        uint256 rentalId = nextRentalId++;
        rentals[rentalId] = RentalAgreement({
            tokenId: tokenId,
            landlord: listing.landlord,
            tenant: msg.sender,
            monthlyRent: listing.monthlyRent,
            deposit: listing.deposit,
            startTime: block.timestamp,
            endTime: block.timestamp + (months * 30 days),
            lastRentPaid: block.timestamp,
            active: true
        });

        spaces[tokenId].status = SpaceStatus.Rented;
        emit SpaceRented(rentalId, tokenId, listing.landlord, msg.sender);
    }

    /// @notice Pay monthly rent
    function payRent(uint256 rentalId) external nonReentrant {
        RentalAgreement storage rental = rentals[rentalId];
        require(rental.active, "Rental not active");
        require(rental.tenant == msg.sender, "Not the tenant");
        require(block.timestamp <= rental.endTime, "Rental expired");

        require(paymentToken.transferFrom(msg.sender, rental.landlord, rental.monthlyRent), "Rent payment failed");
        rental.lastRentPaid = block.timestamp;

        emit RentPaid(rentalId, msg.sender, rental.monthlyRent);
    }

    /// @notice End a rental (by tenant after expiry, or by landlord if rent overdue >30 days)
    function endRental(uint256 rentalId) external nonReentrant {
        RentalAgreement storage rental = rentals[rentalId];
        require(rental.active, "Rental not active");

        bool isExpired = block.timestamp >= rental.endTime;
        bool isOverdue = block.timestamp > rental.lastRentPaid + 30 days;
        bool isTenant = msg.sender == rental.tenant;
        bool isLandlord = msg.sender == rental.landlord;

        require(
            (isTenant && isExpired) || (isLandlord && (isExpired || isOverdue)),
            "Cannot end rental yet"
        );

        rental.active = false;
        spaces[rental.tokenId].status = SpaceStatus.Occupied;

        // Return deposit to tenant (unless overdue — landlord keeps deposit)
        if (!isOverdue) {
            require(paymentToken.transfer(rental.tenant, rental.deposit), "Deposit return failed");
        } else {
            require(paymentToken.transfer(rental.landlord, rental.deposit), "Deposit forfeit failed");
        }

        emit RentalEnded(rentalId, rental.tokenId);
    }

    function getSpace(uint256 tokenId) external view returns (LivingSpace memory) {
        require(tokenId < _nextTokenId, "Space does not exist");
        return spaces[tokenId];
    }

    function totalSpaces() external view returns (uint256) {
        return _nextTokenId;
    }

    function remainingSpaces() external view returns (uint256) {
        return MAX_SUPPLY - _nextTokenId;
    }

    function getSpacesByOwner(address _owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(_owner);
        uint256[] memory tokenIds = new uint256[](balance);
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return tokenIds;
    }

    function getActiveRentalListings() external view returns (uint256[] memory) {
        return activeRentalListingIds;
    }

    function _removeRentalListing(uint256 tokenId) internal {
        uint256 index = rentalListingIndex[tokenId];
        uint256 lastIndex = activeRentalListingIds.length - 1;
        if (index != lastIndex) {
            uint256 lastTokenId = activeRentalListingIds[lastIndex];
            activeRentalListingIds[index] = lastTokenId;
            rentalListingIndex[lastTokenId] = index;
        }
        activeRentalListingIds.pop();
        delete rentalListingIndex[tokenId];
    }

    // Required overrides
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
