// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TournamentEscrow is Ownable, ReentrancyGuard {
    struct Tournament {
        uint256 id;
        address creator;
        string name;
        string description;
        string gameId;
        uint8 tournamentType; // 0 = single elimination, 1 = double elimination
        uint256 maxParticipants;
        uint256 createdAt;
        uint256 startTime;
        uint256 registrationEndTime;
        bool isActive;

        // Reward info
        address rewardTokenAddress;  // address(0) for native token (RON)
        uint256 totalRewardAmount;

        // Positions and rewards
        uint256[] positionRewardAmounts;  // Reward amount for each position
        mapping(uint256 => address) winners;  // Position -> Winner address
        mapping(uint256 => bool) claimed;     // Position -> Claimed status
    }

    mapping(uint256 => Tournament) public tournaments;
    uint256 public nextTournamentId = 1;

    event TournamentCreated(uint256 indexed tournamentId, address indexed creator, string name);
    event WinnerDeclared(uint256 indexed tournamentId, uint256 position, address winner);
    event RewardClaimed(uint256 indexed tournamentId, uint256 position, address winner, uint256 amount);
    event TournamentCancelled(uint256 indexed tournamentId);

    // Create a tournament with escrowed rewards
    function createTournament(
        string memory name,
        string memory description,
        string memory gameId,
        uint8 tournamentType,
        uint256 maxParticipants,
        uint256 registrationEndTime,
        uint256 startTime,
        address rewardTokenAddress,
        uint256[] memory positionRewardAmounts
    ) external payable nonReentrant returns (uint256) {
        require(positionRewardAmounts.length > 0, "No positions provided");

        uint256 totalReward = 0;
        for (uint256 i = 0; i < positionRewardAmounts.length; i++) {
            totalReward += positionRewardAmounts[i];
        }

        // Handle token or native currency
        if (rewardTokenAddress == address(0)) {
            // Native token (RON)
            require(msg.value == totalReward, "Incorrect reward amount sent");
        } else {
            // ERC20 token
            require(msg.value == 0, "Don't send RON with token tournaments");
            IERC20 token = IERC20(rewardTokenAddress);
            require(token.transferFrom(msg.sender, address(this), totalReward), "Token transfer failed");
        }

        uint256 tournamentId = nextTournamentId++;
        Tournament storage tournament = tournaments[tournamentId];
        tournament.id = tournamentId;
        tournament.creator = msg.sender;
        tournament.name = name;
        tournament.description = description;
        tournament.gameId = gameId;
        tournament.tournamentType = tournamentType;
        tournament.maxParticipants = maxParticipants;
        tournament.createdAt = block.timestamp;
        tournament.startTime = startTime;
        tournament.registrationEndTime = registrationEndTime;
        tournament.isActive = true;
        tournament.rewardTokenAddress = rewardTokenAddress;
        tournament.totalRewardAmount = totalReward;

        // Store position rewards
        for (uint256 i = 0; i < positionRewardAmounts.length; i++) {
            tournament.positionRewardAmounts.push(positionRewardAmounts[i]);
        }

        emit TournamentCreated(tournamentId, msg.sender, name);
        return tournamentId;
    }

    // Tournament creator declares winners
    function declareWinner(uint256 tournamentId, uint256 position, address winner) external {
        Tournament storage tournament = tournaments[tournamentId];
        require(msg.sender == tournament.creator, "Not tournament creator");
        require(tournament.isActive, "Tournament not active");
        require(position < tournament.positionRewardAmounts.length, "Invalid position");
        require(!tournament.claimed[position], "Position already claimed");

        tournament.winners[position] = winner;

        emit WinnerDeclared(tournamentId, position, winner);
    }

    // Winners claim their rewards
    function claimReward(uint256 tournamentId, uint256 position) external nonReentrant {
        Tournament storage tournament = tournaments[tournamentId];
        require(tournament.isActive, "Tournament not active");
        require(position < tournament.positionRewardAmounts.length, "Invalid position");
        require(!tournament.claimed[position], "Position already claimed");
        require(tournament.winners[position] == msg.sender, "Not the winner");

        tournament.claimed[position] = true;

        // Transfer reward
        uint256 rewardAmount = tournament.positionRewardAmounts[position];
        if (tournament.rewardTokenAddress == address(0)) {
            // Native token (RON)
            payable(msg.sender).transfer(rewardAmount);
        } else {
            // ERC20 token
            IERC20 token = IERC20(tournament.rewardTokenAddress);
            require(token.transfer(msg.sender, rewardAmount), "Token transfer failed");
        }

        emit RewardClaimed(tournamentId, position, msg.sender, rewardAmount);
    }

    // Emergency function for creator to cancel tournament and reclaim funds
    function cancelTournament(uint256 tournamentId) external nonReentrant {
        Tournament storage tournament = tournaments[tournamentId];
        require(msg.sender == tournament.creator, "Not tournament creator");
        require(tournament.isActive, "Tournament not active");

        tournament.isActive = false;

        // Calculate unclaimed rewards
        uint256 unclaimedAmount = 0;
        for (uint256 i = 0; i < tournament.positionRewardAmounts.length; i++) {
            if (!tournament.claimed[i]) {
                unclaimedAmount += tournament.positionRewardAmounts[i];
            }
        }

        // Return unclaimed rewards to creator
        if (unclaimedAmount > 0) {
            if (tournament.rewardTokenAddress == address(0)) {
                // Native token (RON)
                payable(tournament.creator).transfer(unclaimedAmount);
            } else {
                // ERC20 token
                IERC20 token = IERC20(tournament.rewardTokenAddress);
                require(token.transfer(tournament.creator, unclaimedAmount), "Token transfer failed");
            }
        }

        emit TournamentCancelled(tournamentId);
    }

    // View functions
    function getTournamentInfo(uint256 tournamentId) external view returns (
        address creator,
        string memory name,
        string memory description,
        string memory gameId,
        uint8 tournamentType,
        uint256 maxParticipants,
        uint256 createdAt,
        uint256 startTime,
        uint256 registrationEndTime,
        bool isActive,
        address rewardTokenAddress,
        uint256 totalRewardAmount,
        uint256 positionCount
    ) {
        Tournament storage tournament = tournaments[tournamentId];
        return (
            tournament.creator,
            tournament.name,
            tournament.description,
            tournament.gameId,
            tournament.tournamentType,
            tournament.maxParticipants,
            tournament.createdAt,
            tournament.startTime,
            tournament.registrationEndTime,
            tournament.isActive,
            tournament.rewardTokenAddress,
            tournament.totalRewardAmount,
            tournament.positionRewardAmounts.length
        );
    }

    function getPositionInfo(uint256 tournamentId, uint256 position) external view returns (
        uint256 rewardAmount,
        address winner,
        bool claimed
    ) {
        Tournament storage tournament = tournaments[tournamentId];
        require(position < tournament.positionRewardAmounts.length, "Invalid position");

        return (
            tournament.positionRewardAmounts[position],
            tournament.winners[position],
            tournament.claimed[position]
        );
    }

    function getPositionRewardAmounts(uint256 tournamentId) external view returns (uint256[] memory) {
        return tournaments[tournamentId].positionRewardAmounts;
    }
}
