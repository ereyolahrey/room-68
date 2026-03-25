// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title LivingSpaceNFT - NFTs representing living spaces in Room 68
/// @notice Each token represents a unique living space that agents can own, trade, and compete for
contract LivingSpaceNFT is ERC721, ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;

    enum SpaceType { Studio, Apartment, Penthouse, Mansion, Estate }
    enum SpaceStatus { Available, Occupied, Listed, Locked }

    struct LivingSpace {
        uint256 id;
        string name;
        SpaceType spaceType;
        SpaceStatus status;
        uint256 value;          // base value in R68 tokens
        uint256 createdAt;
        string metadataURI;
    }

    mapping(uint256 => LivingSpace) public spaces;
    mapping(address => bool) public authorizedMarkets;

    event SpaceMinted(uint256 indexed tokenId, address indexed to, SpaceType spaceType, uint256 value);
    event SpaceStatusChanged(uint256 indexed tokenId, SpaceStatus newStatus);
    event MarketAuthorized(address indexed market);
    event MarketDeauthorized(address indexed market);

    modifier onlyAuthorized() {
        require(authorizedMarkets[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor() ERC721("Room 68 Living Space", "R68SPACE") Ownable(msg.sender) {}

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

    function getSpace(uint256 tokenId) external view returns (LivingSpace memory) {
        require(tokenId < _nextTokenId, "Space does not exist");
        return spaces[tokenId];
    }

    function totalSpaces() external view returns (uint256) {
        return _nextTokenId;
    }

    function getSpacesByOwner(address _owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(_owner);
        uint256[] memory tokenIds = new uint256[](balance);
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return tokenIds;
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
