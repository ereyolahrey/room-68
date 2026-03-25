// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Room68Token.sol";
import "./LivingSpaceNFT.sol";

/// @title CompetitionManager - Manages competitions where agents compete for living spaces and prizes
/// @notice Supports chess, crossword, scrabble, dancing, music, and market insight competitions
contract CompetitionManager is Ownable, ReentrancyGuard {
    Room68Token public r68Token;
    LivingSpaceNFT public spaceNFT;

    enum CompetitionType { Chess, Crossword, Scrabble, Dancing, Music, MarketInsight }
    enum CompetitionStatus { Open, InProgress, Judging, Completed, Cancelled }

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
        address judge;           // for subjective competitions (dancing, music)
        address winner;
        uint256 spaceReward;      // optional: living space NFT ID as reward (0 if none)
        uint256 startTime;
        uint256 endTime;
        uint256 createdAt;
    }

    mapping(uint256 => Competition) public competitions;
    mapping(uint256 => mapping(address => bool)) public isParticipant;
    mapping(uint256 => address[]) public participants;
    mapping(uint256 => mapping(address => uint256)) public scores;
    mapping(uint256 => mapping(address => string)) public submissions; // for market insight/puzzle solutions

    uint256 public nextCompetitionId;
    uint256 public platformFeeBps = 500; // 5% of prize pool goes to platform
    uint256 public constant MAX_FEE_BPS = 1500;

    event CompetitionCreated(uint256 indexed id, CompetitionType competitionType, string name, uint256 entryFee);
    event ParticipantJoined(uint256 indexed id, address indexed participant);
    event CompetitionStarted(uint256 indexed id);
    event ScoreSubmitted(uint256 indexed id, address indexed participant, uint256 score);
    event SolutionSubmitted(uint256 indexed id, address indexed participant);
    event WinnerDeclared(uint256 indexed id, address indexed winner, uint256 prize);
    event CompetitionCancelled(uint256 indexed id);

    constructor(address _r68Token, address _spaceNFT) Ownable(msg.sender) {
        r68Token = Room68Token(_r68Token);
        spaceNFT = LivingSpaceNFT(_spaceNFT);
    }

    /// @notice Create a new competition
    function createCompetition(
        CompetitionType _type,
        string calldata _name,
        string calldata _description,
        uint256 _entryFee,
        uint256 _maxParticipants,
        address _judge,
        uint256 _spaceReward,
        uint256 _durationHours
    ) external onlyOwner returns (uint256) {
        require(_maxParticipants >= 2, "Min 2 participants");
        require(_entryFee > 0, "Entry fee required");

        // For subjective competitions, a judge is required
        if (_type == CompetitionType.Dancing || _type == CompetitionType.Music) {
            require(_judge != address(0), "Judge required for this type");
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
            spaceReward: _spaceReward,
            startTime: 0,
            endTime: 0,
            createdAt: block.timestamp
        });

        // Store duration in endTime temporarily (will be set properly when started)
        competitions[compId].endTime = _durationHours * 1 hours;

        emit CompetitionCreated(compId, _type, _name, _entryFee);
        return compId;
    }

    /// @notice Join a competition by paying the entry fee
    function joinCompetition(uint256 compId) external nonReentrant {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.Open, "Not open");
        require(!isParticipant[compId][msg.sender], "Already joined");
        require(comp.participantCount < comp.maxParticipants, "Competition full");
        require(msg.sender != comp.judge, "Judge cannot participate");

        // Pay entry fee into prize pool
        require(r68Token.transferFrom(msg.sender, address(this), comp.entryFee), "Fee payment failed");

        comp.prizePool += comp.entryFee;
        comp.participantCount++;
        isParticipant[compId][msg.sender] = true;
        participants[compId].push(msg.sender);

        emit ParticipantJoined(compId, msg.sender);
    }

    /// @notice Start a competition (owner or when max participants reached)
    function startCompetition(uint256 compId) external {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.Open, "Not open");
        require(comp.participantCount >= 2, "Need at least 2 participants");
        require(msg.sender == owner() || comp.participantCount == comp.maxParticipants, "Not authorized");

        uint256 duration = comp.endTime; // stored duration
        comp.startTime = block.timestamp;
        comp.endTime = block.timestamp + duration;
        comp.status = CompetitionStatus.InProgress;

        emit CompetitionStarted(compId);
    }

    /// @notice Submit a score for a participant (by judge or automated system)
    function submitScore(uint256 compId, address participant, uint256 score) external {
        Competition storage comp = competitions[compId];
        require(
            comp.status == CompetitionStatus.InProgress || comp.status == CompetitionStatus.Judging,
            "Not active"
        );
        require(
            msg.sender == comp.judge || msg.sender == owner(),
            "Not authorized to score"
        );
        require(isParticipant[compId][participant], "Not a participant");
        require(score <= 10000, "Score out of range"); // 0-10000

        scores[compId][participant] = score;
        emit ScoreSubmitted(compId, participant, score);
    }

    /// @notice Submit a solution/answer (for puzzles, market insights)
    function submitSolution(uint256 compId, string calldata solution) external {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.InProgress, "Not active");
        require(isParticipant[compId][msg.sender], "Not a participant");
        require(block.timestamp <= comp.endTime, "Competition ended");

        submissions[compId][msg.sender] = solution;
        emit SolutionSubmitted(compId, msg.sender);
    }

    /// @notice Move competition to judging phase
    function startJudging(uint256 compId) external {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.InProgress, "Not in progress");
        require(msg.sender == owner() || block.timestamp >= comp.endTime, "Not authorized");

        comp.status = CompetitionStatus.Judging;
    }

    /// @notice Declare the winner and distribute prizes
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

        // Calculate prize distribution
        uint256 fee = (comp.prizePool * platformFeeBps) / 10000;
        uint256 winnerPrize = comp.prizePool - fee;

        // Transfer prize to winner
        require(r68Token.transfer(winner, winnerPrize), "Prize transfer failed");
        if (fee > 0) {
            require(r68Token.transfer(owner(), fee), "Fee transfer failed");
        }

        // Transfer space reward if any
        if (comp.spaceReward > 0) {
            try spaceNFT.transferFrom(address(this), winner, comp.spaceReward) {
                spaceNFT.setSpaceStatus(comp.spaceReward, LivingSpaceNFT.SpaceStatus.Occupied);
            } catch {
                // Space reward not available, prize still awarded
            }
        }

        emit WinnerDeclared(compId, winner, winnerPrize);
    }

    /// @notice Cancel a competition and refund entry fees
    function cancelCompetition(uint256 compId) external onlyOwner nonReentrant {
        Competition storage comp = competitions[compId];
        require(comp.status == CompetitionStatus.Open || comp.status == CompetitionStatus.InProgress, "Cannot cancel");

        comp.status = CompetitionStatus.Cancelled;

        // Refund all participants
        address[] memory parts = participants[compId];
        for (uint256 i = 0; i < parts.length; i++) {
            require(r68Token.transfer(parts[i], comp.entryFee), "Refund failed");
        }

        emit CompetitionCancelled(compId);
    }

    /// @notice Get participants list
    function getParticipants(uint256 compId) external view returns (address[] memory) {
        return participants[compId];
    }

    /// @notice Get competition details
    function getCompetition(uint256 compId) external view returns (Competition memory) {
        return competitions[compId];
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = _feeBps;
    }
}
