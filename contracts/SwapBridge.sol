// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SwapBridge - Token swapping and bridging hub for Room 68
/// @notice Facilitates USDC/EURC swaps and tracks cross-chain bridge operations
contract SwapBridge is Ownable, ReentrancyGuard {

    uint256 public swapFeeBps = 30; // 0.3% swap fee
    uint256 public constant MAX_FEE_BPS = 500;

    // Supported external token tracking (bridged assets)
    struct BridgedToken {
        string symbol;
        address tokenAddress;
        bool active;
        uint256 totalBridgedIn;
        uint256 totalBridgedOut;
    }

    struct SwapOrder {
        uint256 id;
        address maker;
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 toAmount;
        bool filled;
        bool cancelled;
        uint256 createdAt;
    }

    struct BridgeRequest {
        uint256 id;
        address user;
        string fromChain;
        string toChain;
        address tokenAddress;
        uint256 amount;
        string status; // "pending", "completed", "failed"
        uint256 createdAt;
    }

    mapping(address => BridgedToken) public bridgedTokens;
    mapping(uint256 => SwapOrder) public swapOrders;
    mapping(uint256 => BridgeRequest) public bridgeRequests;
    address[] public supportedTokens;

    uint256 public nextSwapOrderId;
    uint256 public nextBridgeRequestId;

    event TokenRegistered(address indexed tokenAddress, string symbol);
    event SwapOrderCreated(uint256 indexed orderId, address indexed maker, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount);
    event SwapOrderFilled(uint256 indexed orderId, address indexed taker);
    event SwapOrderCancelled(uint256 indexed orderId);
    event BridgeInitiated(uint256 indexed requestId, address indexed user, string fromChain, string toChain, uint256 amount);
    event BridgeCompleted(uint256 indexed requestId);

    constructor() Ownable(msg.sender) {}

    /// @notice Register a supported bridged token
    function registerToken(address tokenAddress, string calldata symbol) external onlyOwner {
        require(!bridgedTokens[tokenAddress].active, "Already registered");
        bridgedTokens[tokenAddress] = BridgedToken({
            symbol: symbol,
            tokenAddress: tokenAddress,
            active: true,
            totalBridgedIn: 0,
            totalBridgedOut: 0
        });
        supportedTokens.push(tokenAddress);
        emit TokenRegistered(tokenAddress, symbol);
    }

    /// @notice Create a swap order (limit order style)
    function createSwapOrder(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    ) external nonReentrant returns (uint256) {
        require(fromAmount > 0 && toAmount > 0, "Invalid amounts");
        require(fromToken != toToken, "Same token");

        // Transfer from-tokens from maker to contract
        require(
            IERC20(fromToken).transferFrom(msg.sender, address(this), fromAmount),
            "Transfer failed"
        );

        uint256 orderId = nextSwapOrderId++;
        swapOrders[orderId] = SwapOrder({
            id: orderId,
            maker: msg.sender,
            fromToken: fromToken,
            toToken: toToken,
            fromAmount: fromAmount,
            toAmount: toAmount,
            filled: false,
            cancelled: false,
            createdAt: block.timestamp
        });

        emit SwapOrderCreated(orderId, msg.sender, fromToken, toToken, fromAmount, toAmount);
        return orderId;
    }

    /// @notice Fill a swap order (taker pays toAmount, receives fromAmount minus fee)
    function fillSwapOrder(uint256 orderId) external nonReentrant {
        SwapOrder storage order = swapOrders[orderId];
        require(!order.filled && !order.cancelled, "Order inactive");
        require(msg.sender != order.maker, "Cannot fill own order");

        order.filled = true;

        // Taker sends toToken to maker
        require(
            IERC20(order.toToken).transferFrom(msg.sender, order.maker, order.toAmount),
            "Taker payment failed"
        );

        // Send fromToken to taker (minus fee)
        uint256 fee = (order.fromAmount * swapFeeBps) / 10000;
        uint256 takerReceives = order.fromAmount - fee;

        require(IERC20(order.fromToken).transfer(msg.sender, takerReceives), "Transfer to taker failed");
        if (fee > 0) {
            require(IERC20(order.fromToken).transfer(owner(), fee), "Fee transfer failed");
        }

        emit SwapOrderFilled(orderId, msg.sender);
    }

    /// @notice Cancel a swap order and reclaim tokens
    function cancelSwapOrder(uint256 orderId) external nonReentrant {
        SwapOrder storage order = swapOrders[orderId];
        require(order.maker == msg.sender, "Not the maker");
        require(!order.filled && !order.cancelled, "Order inactive");

        order.cancelled = true;
        require(IERC20(order.fromToken).transfer(msg.sender, order.fromAmount), "Refund failed");

        emit SwapOrderCancelled(orderId);
    }

    /// @notice Initiate a bridge request (off-chain fulfillment via ARC CCTP)
    function initiateBridge(
        string calldata fromChain,
        string calldata toChain,
        address tokenAddress,
        uint256 amount
    ) external nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");

        // Lock tokens for bridging
        require(
            IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        uint256 requestId = nextBridgeRequestId++;
        bridgeRequests[requestId] = BridgeRequest({
            id: requestId,
            user: msg.sender,
            fromChain: fromChain,
            toChain: toChain,
            tokenAddress: tokenAddress,
            amount: amount,
            status: "pending",
            createdAt: block.timestamp
        });

        if (bridgedTokens[tokenAddress].active) {
            bridgedTokens[tokenAddress].totalBridgedOut += amount;
        }

        emit BridgeInitiated(requestId, msg.sender, fromChain, toChain, amount);
        return requestId;
    }

    /// @notice Complete a bridge request (called by bridge relayer/owner)
    function completeBridge(uint256 requestId) external onlyOwner {
        BridgeRequest storage req = bridgeRequests[requestId];
        require(
            keccak256(bytes(req.status)) == keccak256(bytes("pending")),
            "Not pending"
        );
        req.status = "completed";
        emit BridgeCompleted(requestId);
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function setSwapFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        swapFeeBps = _feeBps;
    }
}
