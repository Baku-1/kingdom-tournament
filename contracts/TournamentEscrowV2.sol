// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TournamentEscrowV2
 * @dev Improved version of TournamentEscrow with additional validations and features
 */
contract TournamentEscrowV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Tournament types
    uint8 public constant TOURNAMENT_TYPE_SINGLE_ELIMINATION = 0;
    uint8 public constant TOURNAMENT_TYPE_DOUBLE_ELIMINATION = 1;

    // Platform fee percentage (2.5%)
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 250; // 2.5% = 250 / 10000
    uint256 public constant PERCENTAGE_BASE = 10000; // 100% = 10000

    // Minimum time requirements
    uint256 public constant MIN_REGISTRATION_PERIOD = 1 hours;

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

        // Entry fee info
        bool hasEntryFee;
        address entryFeeTokenAddress; // address(0) for native token (RON)
        uint256 entryFeeAmount;
        bool feesDistributed;         // Track if fees have been distributed

        // Positions and rewards
        uint256[] positionRewardAmounts;  // Reward amount for each position
        mapping(uint256 => address) winners;  // Position -> Winner address
        mapping(uint256 => bool) claimed;     // Position -> Claimed status

        // Participants
        uint256 participantCount;
        mapping(address => bool) participants;
    }

    mapping(uint256 => Tournament) public tournaments;
    uint256 public nextTournamentId = 1;

    // Platform fees collected
    mapping(address => uint256) public platformFees;

    // Events
    event TournamentCreated(uint256 indexed tournamentId, address indexed creator, string name);
    event ParticipantRegistered(uint256 indexed tournamentId, address indexed participant);
    event WinnerDeclared(uint256 indexed tournamentId, uint256 position, address winner);
    event RewardClaimed(uint256 indexed tournamentId, uint256 position, address winner, uint256 amount);
    event TournamentCancelled(uint256 indexed tournamentId);
    event EntryFeesCollected(uint256 indexed tournamentId, address indexed creator, uint256 amount);
    event PlatformFeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event EntryFeesAutoDistributed(uint256 indexed tournamentId, address indexed creator, uint256 amount);
    event PlatformFeesAutoDistributed(uint256 indexed tournamentId, address indexed token, address indexed recipient, uint256 amount);

    /**
     * @dev Modifier to check if tournament exists and is active
     * @param tournamentId The ID of the tournament
     */
    modifier tournamentExists(uint256 tournamentId) {
        require(tournaments[tournamentId].id == tournamentId, "Tournament does not exist");
        _;
    }

    /**
     * @dev Modifier to check if tournament is active
     * @param tournamentId The ID of the tournament
     */
    modifier tournamentActive(uint256 tournamentId) {
        require(tournaments[tournamentId].isActive, "Tournament not active");
        _;
    }

    /**
     * @dev Modifier to check if sender is the tournament creator
     * @param tournamentId The ID of the tournament
     */
    modifier onlyTournamentCreator(uint256 tournamentId) {
        require(msg.sender == tournaments[tournamentId].creator, "Not tournament creator");
        _;
    }

    /**
     * @dev Internal function to create a tournament
     * @param name Tournament name
     * @param description Tournament description
     * @param gameId Game identifier
     * @param tournamentType Type of tournament (0=single elimination, 1=double elimination)
     * @param maxParticipants Maximum number of participants (0 for unlimited)
     * @param registrationEndTime Time when registration ends
     * @param startTime Time when tournament starts
     * @param rewardTokenAddress Address of reward token (address(0) for native token)
     * @param positionRewardAmounts Reward amounts for each position
     * @param msgSender Address of the tournament creator
     * @param msgValue Amount of native tokens sent with the transaction
     * @return tournamentId The ID of the created tournament
     */
    function _createTournament(
        string memory name,
        string memory description,
        string memory gameId,
        uint8 tournamentType,
        uint256 maxParticipants,
        uint256 registrationEndTime,
        uint256 startTime,
        address rewardTokenAddress,
        uint256[] memory positionRewardAmounts,
        address msgSender,
        uint256 msgValue
    ) internal returns (uint256) {
        // Validate inputs
        require(bytes(name).length > 0, "Name cannot be empty");
        require(tournamentType <= TOURNAMENT_TYPE_DOUBLE_ELIMINATION, "Invalid tournament type");
        require(positionRewardAmounts.length > 0, "No positions provided");
        require(registrationEndTime > block.timestamp, "Registration end time must be in the future");
        require(startTime > registrationEndTime, "Start time must be after registration end time");
        require(startTime - registrationEndTime >= MIN_REGISTRATION_PERIOD, "Registration period too short");

        uint256 totalReward = 0;
        for (uint256 i = 0; i < positionRewardAmounts.length; i++) {
            totalReward += positionRewardAmounts[i];
        }

        // Handle token or native currency
        if (rewardTokenAddress == address(0)) {
            // Native token (RON)
            require(msgValue == totalReward, "Incorrect reward amount sent");
        } else {
            // ERC20 token
            require(msgValue == 0, "Don't send RON with token tournaments");

            // Check if token contract exists
            uint256 codeSize;
            assembly {
                codeSize := extcodesize(rewardTokenAddress)
            }
            require(codeSize > 0, "Token address is not a contract");

            // Transfer tokens to this contract
            IERC20 token = IERC20(rewardTokenAddress);
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransferFrom(msgSender, address(this), totalReward);
            uint256 balanceAfter = token.balanceOf(address(this));
            require(balanceAfter - balanceBefore == totalReward, "Token transfer amount mismatch");
        }

        uint256 tournamentId = nextTournamentId++;
        Tournament storage tournament = tournaments[tournamentId];
        tournament.id = tournamentId;
        tournament.creator = msgSender;
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
        tournament.hasEntryFee = false;
        tournament.feesDistributed = true; // No fees to distribute for tournaments without entry fee

        // Store position rewards
        for (uint256 i = 0; i < positionRewardAmounts.length; i++) {
            tournament.positionRewardAmounts.push(positionRewardAmounts[i]);
        }

        emit TournamentCreated(tournamentId, msgSender, name);
        return tournamentId;
    }

    /**
     * @dev Create a tournament with escrowed rewards
     * @param name Tournament name
     * @param description Tournament description
     * @param gameId Game identifier
     * @param tournamentType Type of tournament (0=single elimination, 1=double elimination)
     * @param maxParticipants Maximum number of participants (0 for unlimited)
     * @param registrationEndTime Time when registration ends
     * @param startTime Time when tournament starts
     * @param rewardTokenAddress Address of reward token (address(0) for native token)
     * @param positionRewardAmounts Reward amounts for each position
     * @return tournamentId The ID of the created tournament
     */
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
        return _createTournament(
            name,
            description,
            gameId,
            tournamentType,
            maxParticipants,
            registrationEndTime,
            startTime,
            rewardTokenAddress,
            positionRewardAmounts,
            msg.sender,
            msg.value
        );
    }

    /**
     * @dev Create a tournament with entry fee
     * @param name Tournament name
     * @param description Tournament description
     * @param gameId Game identifier
     * @param tournamentType Type of tournament (0=single elimination, 1=double elimination)
     * @param maxParticipants Maximum number of participants (0 for unlimited)
     * @param registrationEndTime Time when registration ends
     * @param startTime Time when tournament starts
     * @param rewardTokenAddress Address of reward token (address(0) for native token)
     * @param positionRewardAmounts Reward amounts for each position
     * @param entryFeeTokenAddress Address of entry fee token (address(0) for native token)
     * @param entryFeeAmount Amount of entry fee
     * @return tournamentId The ID of the created tournament
     */
    function createTournamentWithEntryFee(
        string memory name,
        string memory description,
        string memory gameId,
        uint8 tournamentType,
        uint256 maxParticipants,
        uint256 registrationEndTime,
        uint256 startTime,
        address rewardTokenAddress,
        uint256[] memory positionRewardAmounts,
        address entryFeeTokenAddress,
        uint256 entryFeeAmount
    ) external payable nonReentrant returns (uint256) {
        // Create the tournament first
        uint256 tournamentId = _createTournament(
            name,
            description,
            gameId,
            tournamentType,
            maxParticipants,
            registrationEndTime,
            startTime,
            rewardTokenAddress,
            positionRewardAmounts,
            msg.sender,
            msg.value
        );

        // Add entry fee information
        Tournament storage tournament = tournaments[tournamentId];
        tournament.hasEntryFee = true;
        tournament.entryFeeTokenAddress = entryFeeTokenAddress;
        tournament.entryFeeAmount = entryFeeAmount;
        tournament.feesDistributed = false; // Initialize as not distributed

        return tournamentId;
    }

    /**
     * @dev Register for a tournament without entry fee
     * @param tournamentId The ID of the tournament
     */
    function registerForTournament(uint256 tournamentId)
        external
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];

        // Check registration period
        require(block.timestamp <= tournament.registrationEndTime, "Registration period ended");

        // Check if tournament has entry fee
        require(!tournament.hasEntryFee, "Tournament requires entry fee");

        // Check if already registered
        require(!tournament.participants[msg.sender], "Already registered");

        // Check max participants
        if (tournament.maxParticipants > 0) {
            require(tournament.participantCount < tournament.maxParticipants, "Tournament is full");
        }

        // Register participant
        tournament.participants[msg.sender] = true;
        tournament.participantCount++;

        emit ParticipantRegistered(tournamentId, msg.sender);
    }

    /**
     * @dev Register for a tournament with entry fee
     * @param tournamentId The ID of the tournament
     */
    function registerWithEntryFee(uint256 tournamentId)
        external
        payable
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];

        // Check registration period
        require(block.timestamp <= tournament.registrationEndTime, "Registration period ended");

        // Check if tournament has entry fee
        require(tournament.hasEntryFee, "Tournament does not have entry fee");

        // Check if already registered
        require(!tournament.participants[msg.sender], "Already registered");

        // Check max participants
        if (tournament.maxParticipants > 0) {
            require(tournament.participantCount < tournament.maxParticipants, "Tournament is full");
        }

        // Handle entry fee
        if (tournament.entryFeeTokenAddress == address(0)) {
            // Native token (RON)
            require(msg.value == tournament.entryFeeAmount, "Incorrect entry fee amount");
        } else {
            // ERC20 token
            require(msg.value == 0, "Don't send RON with token entry fee");

            // Transfer tokens to this contract
            IERC20 token = IERC20(tournament.entryFeeTokenAddress);
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), tournament.entryFeeAmount);
            uint256 balanceAfter = token.balanceOf(address(this));
            require(balanceAfter - balanceBefore == tournament.entryFeeAmount, "Token transfer amount mismatch");
        }

        // Register participant
        tournament.participants[msg.sender] = true;
        tournament.participantCount++;

        emit ParticipantRegistered(tournamentId, msg.sender);

        // Check if this is the last registration before the deadline
        // If we're very close to the registration end time (within 1 hour), auto-distribute fees
        if (!tournament.feesDistributed &&
            (block.timestamp + 1 hours >= tournament.registrationEndTime ||
             (tournament.maxParticipants > 0 && tournament.participantCount == tournament.maxParticipants))) {

            // Distribute fees automatically
            (uint256 creatorAmount, uint256 platformFeeAmount) = _distributeEntryFees(tournament, tournamentId);

            if (creatorAmount > 0) {
                emit EntryFeesAutoDistributed(tournamentId, tournament.creator, creatorAmount);
                emit PlatformFeesAutoDistributed(tournamentId, tournament.entryFeeTokenAddress, owner(), platformFeeAmount);
            }
        }
    }

    /**
     * @dev Internal function to distribute entry fees
     * @param tournament Tournament storage reference
     * @param tournamentId The ID of the tournament
     * @return creatorAmount The amount distributed to the creator
     * @return platformFeeAmount The amount distributed to the platform owner
     */
    function _distributeEntryFees(Tournament storage tournament, uint256 tournamentId) internal returns (uint256, uint256) {
        // Skip if fees already distributed or tournament doesn't have entry fee
        if (tournament.feesDistributed || !tournament.hasEntryFee) {
            return (0, 0);
        }

        // Calculate total entry fees
        uint256 totalEntryFees = tournament.participantCount * tournament.entryFeeAmount;

        // Skip if no entry fees to distribute
        if (totalEntryFees == 0) {
            tournament.feesDistributed = true;
            return (0, 0);
        }

        // Calculate platform fee and creator amount
        uint256 platformFeeAmount = (totalEntryFees * PLATFORM_FEE_PERCENTAGE) / PERCENTAGE_BASE;
        uint256 creatorAmount = totalEntryFees - platformFeeAmount;

        address ownerAddress = owner();

        // Transfer creator amount and platform fees directly
        if (tournament.entryFeeTokenAddress == address(0)) {
            // Native token (RON)
            payable(tournament.creator).transfer(creatorAmount);
            payable(ownerAddress).transfer(platformFeeAmount);
        } else {
            // ERC20 token
            IERC20 token = IERC20(tournament.entryFeeTokenAddress);
            token.safeTransfer(tournament.creator, creatorAmount);
            token.safeTransfer(ownerAddress, platformFeeAmount);
        }

        // Mark fees as distributed
        tournament.feesDistributed = true;

        return (creatorAmount, platformFeeAmount);
    }

    /**
     * @dev Automatically distribute entry fees when registration ends
     * @param tournamentId The ID of the tournament
     */
    function distributeEntryFees(uint256 tournamentId)
        external
        nonReentrant
        tournamentExists(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];

        // Check if registration period has ended and tournament is about to start
        require(block.timestamp > tournament.registrationEndTime, "Registration period not ended yet");
        require(block.timestamp <= tournament.startTime, "Tournament has already started");

        // Distribute fees
        (uint256 creatorAmount, uint256 platformFeeAmount) = _distributeEntryFees(tournament, tournamentId);

        if (creatorAmount > 0) {
            emit EntryFeesAutoDistributed(tournamentId, tournament.creator, creatorAmount);
            emit PlatformFeesAutoDistributed(tournamentId, tournament.entryFeeTokenAddress, owner(), platformFeeAmount);
        }
    }

    /**
     * @dev Claim entry fees for a tournament (manual method, still available)
     * @param tournamentId The ID of the tournament
     */
    function claimEntryFees(uint256 tournamentId)
        external
        nonReentrant
        tournamentExists(tournamentId)
        onlyTournamentCreator(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];

        // Check if tournament has entry fee
        require(tournament.hasEntryFee, "Tournament does not have entry fee");

        // Check if fees have already been distributed
        require(!tournament.feesDistributed, "Fees already distributed");

        // Distribute fees
        (uint256 creatorAmount, uint256 platformFeeAmount) = _distributeEntryFees(tournament, tournamentId);

        if (creatorAmount > 0) {
            emit EntryFeesCollected(tournamentId, tournament.creator, creatorAmount);
            emit PlatformFeesAutoDistributed(tournamentId, tournament.entryFeeTokenAddress, owner(), platformFeeAmount);
        }
    }

    /**
     * @dev Withdraw platform fees
     * @notice This function is mostly for legacy purposes or for withdrawing fees from tournaments
     * created before the auto-distribution feature was implemented. New tournaments will automatically
     * distribute platform fees directly to the owner when registration ends.
     * @param tokenAddress Address of the token to withdraw
     */
    function withdrawPlatformFees(address tokenAddress) external onlyOwner nonReentrant {
        uint256 amount = platformFees[tokenAddress];
        require(amount > 0, "No fees to withdraw");

        // Reset platform fees
        platformFees[tokenAddress] = 0;

        // Transfer fees to owner
        if (tokenAddress == address(0)) {
            // Native token (RON)
            payable(owner()).transfer(amount);
        } else {
            // ERC20 token
            IERC20 token = IERC20(tokenAddress);
            token.safeTransfer(owner(), amount);
        }

        emit PlatformFeesWithdrawn(tokenAddress, owner(), amount);
    }

    /**
     * @dev Internal function to declare a winner
     * @param tournament Tournament storage reference
     * @param tournamentId The ID of the tournament
     * @param position Position to declare winner for
     * @param winner Address of the winner
     */
    function _declareWinner(
        Tournament storage tournament,
        uint256 tournamentId,
        uint256 position,
        address winner
    ) internal {
        require(position < tournament.positionRewardAmounts.length, "Invalid position");
        require(!tournament.claimed[position], "Position already claimed");
        require(winner != address(0), "Winner cannot be zero address");

        // Check if tournament has started
        require(block.timestamp >= tournament.startTime, "Tournament has not started yet");

        // Check if winner is a registered participant
        if (tournament.participantCount > 0) {
            require(tournament.participants[winner], "Winner is not a registered participant");
        }

        tournament.winners[position] = winner;

        emit WinnerDeclared(tournamentId, position, winner);
    }

    /**
     * @dev Tournament creator declares a winner
     * @param tournamentId The ID of the tournament
     * @param position Position to declare winner for
     * @param winner Address of the winner
     */
    function declareWinner(uint256 tournamentId, uint256 position, address winner)
        external
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
        onlyTournamentCreator(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        _declareWinner(tournament, tournamentId, position, winner);
    }

    /**
     * @dev Declare multiple winners at once
     * @param tournamentId The ID of the tournament
     * @param positions Array of positions
     * @param winners Array of winner addresses
     */
    function declareWinners(uint256 tournamentId, uint256[] memory positions, address[] memory winners)
        external
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
        onlyTournamentCreator(tournamentId)
    {
        require(positions.length == winners.length, "Arrays length mismatch");

        Tournament storage tournament = tournaments[tournamentId];
        for (uint256 i = 0; i < positions.length; i++) {
            _declareWinner(tournament, tournamentId, positions[i], winners[i]);
        }
    }

    /**
     * @dev Winners claim their rewards
     * @param tournamentId The ID of the tournament
     * @param position Position to claim reward for
     */
    function claimReward(uint256 tournamentId, uint256 position)
        external
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
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
            token.safeTransfer(msg.sender, rewardAmount);
        }

        emit RewardClaimed(tournamentId, position, msg.sender, rewardAmount);
    }

    /**
     * @dev Emergency function for creator to cancel tournament and reclaim funds
     * @param tournamentId The ID of the tournament
     */
    function cancelTournament(uint256 tournamentId)
        external
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
        onlyTournamentCreator(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
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
                token.safeTransfer(tournament.creator, unclaimedAmount);
            }
        }

        emit TournamentCancelled(tournamentId);
    }

    /**
     * @dev Get tournament information
     * @param tournamentId The ID of the tournament
     */
    function getTournamentInfo(uint256 tournamentId)
        external
        view
        tournamentExists(tournamentId)
        returns (
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
            uint256 positionCount,
            bool hasEntryFee,
            address entryFeeTokenAddress,
            uint256 entryFeeAmount,
            bool feesDistributed,
            uint256 participantCount
        )
    {
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
            tournament.positionRewardAmounts.length,
            tournament.hasEntryFee,
            tournament.entryFeeTokenAddress,
            tournament.entryFeeAmount,
            tournament.feesDistributed,
            tournament.participantCount
        );
    }

    /**
     * @dev Get position information
     * @param tournamentId The ID of the tournament
     * @param position Position to get information for
     */
    function getPositionInfo(uint256 tournamentId, uint256 position)
        external
        view
        tournamentExists(tournamentId)
        returns (
            uint256 rewardAmount,
            address winner,
            bool claimed
        )
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(position < tournament.positionRewardAmounts.length, "Invalid position");

        return (
            tournament.positionRewardAmounts[position],
            tournament.winners[position],
            tournament.claimed[position]
        );
    }

    /**
     * @dev Get position reward amounts
     * @param tournamentId The ID of the tournament
     */
    function getPositionRewardAmounts(uint256 tournamentId)
        external
        view
        tournamentExists(tournamentId)
        returns (uint256[] memory)
    {
        return tournaments[tournamentId].positionRewardAmounts;
    }

    /**
     * @dev Check if an address is registered for a tournament
     * @param tournamentId The ID of the tournament
     * @param participant Address to check
     */
    function isParticipantRegistered(uint256 tournamentId, address participant)
        external
        view
        tournamentExists(tournamentId)
        returns (bool)
    {
        return tournaments[tournamentId].participants[participant];
    }

    /**
     * @dev Get the position of a winner
     * @param tournamentId The ID of the tournament
     * @param winnerAddress Address of the winner
     */
    function getWinnerPosition(uint256 tournamentId, address winnerAddress)
        external
        view
        tournamentExists(tournamentId)
        returns (uint256)
    {
        Tournament storage tournament = tournaments[tournamentId];

        for (uint256 i = 0; i < tournament.positionRewardAmounts.length; i++) {
            if (tournament.winners[i] == winnerAddress) {
                return i + 1; // Return 1-based position (1st, 2nd, 3rd, etc.)
            }
        }

        revert("Address is not a winner");
    }

    /**
     * @dev Check if a winner has claimed their reward
     * @param tournamentId The ID of the tournament
     * @param winnerAddress Address of the winner
     */
    function hasClaimedReward(uint256 tournamentId, address winnerAddress)
        external
        view
        tournamentExists(tournamentId)
        returns (bool)
    {
        Tournament storage tournament = tournaments[tournamentId];

        for (uint256 i = 0; i < tournament.positionRewardAmounts.length; i++) {
            if (tournament.winners[i] == winnerAddress) {
                return tournament.claimed[i];
            }
        }

        revert("Address is not a winner");
    }
}
