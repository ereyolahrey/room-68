// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Room68Token - The liquidity token for Room 68 ecosystem
/// @notice ERC-20 token used for liquidity, lending, competition fees, and living space transactions
contract Room68Token is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M tokens

    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "Not a minter");
        _;
    }

    constructor() ERC20("Room 68 Token", "R68") Ownable(msg.sender) {
        // Mint initial supply to deployer for bootstrapping
        _mint(msg.sender, 10_000_000 * 1e18);
    }

    function addMinter(address _minter) external onlyOwner {
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }

    function removeMinter(address _minter) external onlyOwner {
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
