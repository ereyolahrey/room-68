// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LivingSpaceNFT.sol";

/// @title CompetitionManager - Agents compete for living spaces AND USDC liquidity
/// @notice Winners earn both a living space NFT + USDC liquidity from the prize pool
contract CompetitionManager is Ownable, ReentrancyGuard {
    IERC20 public paymentToken;
    LivingSpaceNFT public spaceNFT;

    enum CompetitionType { Chess, Crossword, Scrabble, Dancing, Music, MarketInsight }
    enum CompetitionStatus { Open, InProgress, Judging, Completed, Cancelled }

    /// @notice How the space reward is sourced
    enum SpaceRewardMode {
        MintNew,       // Mint a new space for the winner (if supply < 68)
        ExistingStaked // An existing space NFT is staked by the competition creator
    }

    struct Competition {
        uint256 id;
        CompetitionType competitionType;
        CompetitionStatus status;
        string name;
        string description;
        uint256 entryFee;
        uint256 prizePool;
        uint256 maxParticipants;
        uint256 participantCount;
        address judge;
        address winner;
        SpaceRewardMode rewardMode;
        uint256 stakedSpaceId;    // if ExistingStaked, the token ID
        LivingSpaceNFT.SpaceType mintSpaceType; // if MintNew, the type to mint
        uint256 mintSpaceValue;   // if MintNew, the R68 value
        uint256 startTime;
        uint256 endTime;
        uint256 createdAt;
    }

    mapping(uint256 => Competition) public competitions;
    mapping(uint256 => mapping(address => bool)) public isParticipant;
    mapping(uint256 => address[]) public participants;
    mapping(uint256 => mapping(address => uint256)) public scores;
    mapping(uint256 => mapping(address => string)) public submissions;

    uint256 public nextCompetitionId;
    uint256 public platformFeeBps = 500; // 5% of prize pool
    uint256 public constant MAX_FEE_BPS = 1500;

    event CompetitionCreated(uint256 indexed id, CompetitionType competitionType, string name, uint256 entryFee);
    event ParticipantJoined(uint256 indexed id, address indexed participant);
    event CompetitionStarted(uint256 indexed id);
    event ScoreSubmitted(uint256 indexed id, address indexed participant, uint256 score);
    event SolutionSubmitted(uint256 indexed id, address indexed participant);
    event WinnerDeclared(uint256 indexed id, address indexed winner, uint256 prize, uint256 spaceId);
    event CompetitionCancelled(uint256 indexed id);

    constructor(address _paymentToken, address _spaceNFT) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        spaceNFT = LivingSpaceNFT(_spaceNFT);
    }

    /// @notice Create a competition that mints a NEW space for the winner
    function createCompetitionMintReward(
        CompetitionType _type,
        string calldata _name,
        string calldata _description,
        uint256 _entryFee,
        uint256 _maxParticipants,
        address _judge,
        LivingSpaceNFT.SpaceType _spaceType,
        uint256 _spaceValue,
        uint256 _durationHours
    ) external onlyOwner returns (uint256) {
        require(_maxParticipants >= 2, "Min 2 participants");
        require(_entryFee > 0, "Entry fee required");

        if (_type == CompetitionType.Dancing || _type == CompetitionType.Music) {
            require(_judge != address(0), "Judge required");
        }

        uint256 compId = nextCompetitionId++;
        competitions[compId] = Competition({
            id: compId,
            competitionType: _type,
            status: CompetitionStatus.Open,
            name: _name,
            description: _description,
            entryFee: _entryFee,
            prizePool: 0,
            maxParticipants: _maxParticipants,
            participantCount: 0,
            judge: _judge,
            winner: address(0),
            rewardMode: SpaceRewardMode.MintNew,
            stakedSpaceId: 0,
            mintSpaceType: _spaceType,
            mintSpaceValue: _spaceValue,
            startTime: 0,
            endTime: _durationHours * 1 hours,
            createdAt: block.timestamp
        });

        emit CompetitionCreated(compId, _type, _name, _entryFee);
        return compId;
    }

    /// @notice Create a competition with an existing staked space as reward
    function createCompetitionStakedReward(
        CompetitionType _type,
        string calldata _name,
        string calldata _description,
        uint256 _entryFee,
        uint256 _maxParticipants,
        address _judge,
        uint256 _stakedSpaceId,
        uint256 _durationHours
    ) external onlyOwner returns (uint256) {
        require(_maxParticipants >= 2, "Min 2 participants");
        require(_entryFee > 0, "Entry fee required");

        if (_type == CompetitionType.Dancing || _type == CompetitionType.Music) {
            require(_judge != address(0), "Judge required");
        }

        // Transfer the staked space into the contract
        spaceNFT.transferFrom(msg.sender, address(this), _stakedSpaceId);
        spaceNFT.setSpaceStatus(_stakedSpaceId, LivingSpaceNFT.SpaceStatus.Locked);

        uint256 compId = nextCompetitionId++;
        LivingSpaceNFT.LivingSpace memory space = spaceNFT.getSpace(_stakedSpaceId);

        competitions[compId] = Competition({
            id: compId,
            competitionType: _type,
            status: CompetitionStatus.Open,
            name: _name,
            description: _description,
            entryFee: _entryFee,
            prizePool: 0,
            maxParticipants: _maxParticipants,
            participantCount: 0,
            judge: _judge,
            winner: address(0),
            rewardMode: SpaceRewardMode.ExistingStaked,
            stakedSpaceId: _stakedSpaceId,
            mintSpaceType: space.spaceType,
            mintSpaceValue: space.value,
            startTime: 0,
            endTime: _durationHours * 1 hours,
            createdAt: block.timestamp
        });

        emit CompetitionCreated(compId, _type, _name, _entryFee);
        return compId;
    }

    function joinCompetition(uint256 compId) external nonReentrant {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.Open, "Not open");
        require(!isParticipant[compId][msg.sender], "Already joined");
        require(comp.participantCount < comp.maxParticipants, "Competition full");
        require(msg.sender != comp.judge, "Judge cannot participate");

        require(paymentToken.transferFrom(msg.sender, address(this), comp.entryFee), "Fee payment failed");

        comp.prizePool += comp.entryFee;
        comp.participantCount++;
        isParticipant[compId][msg.sender] = true;
        participants[compId].push(msg.sender);

        emit ParticipantJoined(compId, msg.sender);
    }

    function startCompetition(uint256 compId) external {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.Open, "Not open");
        require(comp.participantCount >= 2, "Need at least 2 participants");
        require(msg.sender == owner() || comp.participantCount == comp.maxParticipants, "Not authorized");

        uint256 duration = comp.endTime;
        comp.startTime = block.timestamp;
        comp.endTime = block.timestamp + duration;
        comp.status = CompetitionStatus.InProgress;

        emit CompetitionStarted(compId);
    }

    function submitScore(uint256 compId, address participant, uint256 score) external {
        Competition storage comp = competitions[compId];
        require(
            comp.status == CompetitionStatus.InProgress || comp.status == CompetitionStatus.Judging,
            "Not active"
        );
        require(msg.sender == comp.judge || msg.sender == owner(), "Not authorized");
        require(isParticipant[compId][participant], "Not a participant");
        require(score <= 10000, "Score out of range");

        scores[compId][participant] = score;
        emit ScoreSubmitted(compId, participant, score);
    }

    function submitSolution(uint256 compId, string calldata solution) external {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.InProgress, "Not active");
        require(isParticipant[compId][msg.sender], "Not a participant");
        require(block.timestamp <= comp.endTime, "Competition ended");

        submissions[compId][msg.sender] = solution;
        emit SolutionSubmitted(compId, msg.sender);
    }

    function startJudging(uint256 compId) external {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.InProgress, "Not in progress");
        require(msg.sender == owner() || block.timestamp >= comp.endTime, "Not authorized");

        comp.status = CompetitionStatus.Judging;
    }

    /// @notice Declare winner — they get BOTH the living space AND liquidity prize
    function declareWinner(uint256 compId, address winner) external nonReentrant {
        Competition storage comp = competitions[compId];
        require(
            comp.status == CompetitionStatus.InProgress || comp.status == CompetitionStatus.Judging,
            "Not active"
        );
        require(msg.sender == comp.judge || msg.sender == owner(), "Not authorized");
        require(isParticipant[compId][winner], "Winner not a participant");

        comp.status = CompetitionStatus.Completed;
        comp.winner = winner;

        // 1. Distribute R68 liquidity prize
        uint256 fee = (comp.prizePool * platformFeeBps) / 10000;
        uint256 winnerPrize = comp.prizePool - fee;

        require(paymentToken.transfer(winner, winnerPrize), "Prize transfer failed");
        if (fee > 0) {
            require(paymentToken.transfer(owner(), fee), "Fee transfer failed");
        }

        // 2. Award living space
        uint256 spaceId;
        if (comp.rewardMode == SpaceRewardMode.ExistingStaked) {
            // Transfer the staked space to winner
            spaceNFT.transferFrom(address(this), winner, comp.stakedSpaceId);
            spaceNFT.setSpaceStatus(comp.stakedSpaceId, LivingSpaceNFT.SpaceStatus.Occupied);
            spaceId = comp.stakedSpaceId;
        } else {
            // Mint a new space for the winner (if supply allows)
            string memory spaceName = string.concat("Won: ", comp.name);
            spaceId = spaceNFT.mintSpace(
                winner,
                spaceName,
                comp.mintSpaceType,
                comp.mintSpaceValue,
                "ipfs://room68/competition-reward"
            );
        }

        emit WinnerDeclared(compId, winner, winnerPrize, spaceId);
    }

    function cancelCompetition(uint256 compId) external onlyOwner nonReentrant {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.Open || comp.status == CompetitionStatus.InProgress, "Cannot cancel");

        comp.status = CompetitionStatus.Cancelled;

        // Refund all participants
        address[] memory parts = participants[compId];
        for (uint256 i = 0; i < parts.length; i++) {
            require(paymentToken.transfer(parts[i], comp.entryFee), "Refund failed");
        }

        // Return staked space if applicable
        if (comp.rewardMode == SpaceRewardMode.ExistingStaked) {
            spaceNFT.transferFrom(address(this), owner(), comp.stakedSpaceId);
            spaceNFT.setSpaceStatus(comp.stakedSpaceId, LivingSpaceNFT.SpaceStatus.Available);
        }

        emit CompetitionCancelled(compId);
    }

    function getParticipants(uint256 compId) external view returns (address[] memory) {
        return participants[compId];
    }

    function getCompetition(uint256 compId) external view returns (Competition memory) {
        return competitions[compId];
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = _feeBps;
    }
}
