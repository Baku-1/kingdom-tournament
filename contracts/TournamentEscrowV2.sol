// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// UPGRADEABLE IMPORTS
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title TournamentEscrowV2 (Upgradeable)
 * @dev Upgradeable version of TournamentEscrowV2 using UUPS pattern.
 */
contract TournamentEscrowV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // UPGRADEABLE LIBRARY USAGE
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Tournament types (Constants are fine)
    uint8 public constant TOURNAMENT_TYPE_SINGLE_ELIMINATION = 0;
    uint8 public constant TOURNAMENT_TYPE_DOUBLE_ELIMINATION = 1;

    // Platform fee percentage (Constants are fine)
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 250; // 2.5% = 250 / 10000
    uint256 public constant PERCENTAGE_BASE = 10000; // 100% = 10000

    // Minimum time requirements (Constants are fine)
    uint256 public constant MIN_REGISTRATION_PERIOD = 1 hours;

    // Struct definition remains the same
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

    // Mappings remain the same
    mapping(uint256 => Tournament) public tournaments;

    // State variable - initialization moved to initializer
    uint256 public nextTournamentId;

    // Platform fees collected (Mapping remains the same)
    mapping(address => uint256) public platformFees;

    // Events remain the same
    event TournamentCreated(uint256 indexed tournamentId, address indexed creator, string name);
    event ParticipantRegistered(uint256 indexed tournamentId, address indexed participant);
    event WinnerDeclared(uint256 indexed tournamentId, uint256 position, address winner);
    event RewardClaimed(uint256 indexed tournamentId, uint256 position, address winner, uint256 amount);
    event TournamentCancelled(uint256 indexed tournamentId);
    event EntryFeesCollected(uint256 indexed tournamentId, address indexed creator, uint256 amount);
    event PlatformFeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event EntryFeesAutoDistributed(uint256 indexed tournamentId, address indexed creator, uint256 amount);
    event PlatformFeesAutoDistributed(uint256 indexed tournamentId, address indexed token, address indexed recipient, uint256 amount);

    // --- INITIALIZATION ---

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // Prevents implementation contract from being initialized
    }

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     * Called only once by the proxy contract upon deployment.
     */
    function initialize() public initializer {
        __Ownable_init(); // Initializes OwnableUpgradeable, setting msg.sender as owner
        __ReentrancyGuard_init(); // Initializes ReentrancyGuardUpgradeable
        __UUPSUpgradeable_init(); // Initializes UUPSUpgradeable

        // Initialize state variables previously initialized at declaration
        nextTournamentId = 1;
    }

    // --- UUPS UPGRADE AUTHORIZATION ---

    /**
     * @dev Authorizes the upgrade process. Only the owner can authorize an upgrade.
     * Required by UUPSUpgradeable.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner // Modifier from OwnableUpgradeable
    {}

    // --- MODIFIERS ---
    // Modifiers remain the same, relying on inherited contracts and mappings

    modifier tournamentExists(uint256 tournamentId) {
        require(tournaments[tournamentId].id == tournamentId, "Tournament does not exist");
        _;
    }

    modifier tournamentActive(uint256 tournamentId) {
        require(tournaments[tournamentId].isActive, "Tournament not active");
        _;
    }

    modifier onlyTournamentCreator(uint256 tournamentId) {
        require(msg.sender == tournaments[tournamentId].creator, "Not tournament creator");
        _;
    }

    // --- CORE LOGIC ---
    // Internal functions and external functions remain largely the same,
    // EXCEPT for updating type hints for IERC20.

    /**
     * @dev Internal function to create a tournament
     * (Updated IERC20 type hint)
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
        // Validations remain the same
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

        if (rewardTokenAddress == address(0)) {
            require(msgValue == totalReward, "Incorrect reward amount sent");
        } else {
            require(msgValue == 0, "Don't send RON with token tournaments");
            uint256 codeSize;
            address tokenAddr = rewardTokenAddress; // Assign to local variable for assembly
            assembly {
                codeSize := extcodesize(tokenAddr)
            }
            require(codeSize > 0, "Token address is not a contract");

            // *** UPDATED TYPE HINT ***
            IERC20Upgradeable token = IERC20Upgradeable(rewardTokenAddress);
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
        // ... rest of tournament setup remains the same ...
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
        tournament.feesDistributed = true;

        for (uint256 i = 0; i < positionRewardAmounts.length; i++) {
            tournament.positionRewardAmounts.push(positionRewardAmounts[i]);
        }

        emit TournamentCreated(tournamentId, msgSender, name);
        return tournamentId;
    }

    /**
     * @dev Create a tournament with escrowed rewards
     * (Uses nonReentrant from ReentrancyGuardUpgradeable)
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
    ) external payable virtual nonReentrant returns (uint256) { // Added 'virtual' for potential future overrides
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
            _msgSender(), // Use OZ upgradeable context-aware sender
            msg.value
        );
    }

     /**
     * @dev Create a tournament with entry fee
     * (Uses nonReentrant from ReentrancyGuardUpgradeable)
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
    ) external payable virtual nonReentrant returns (uint256) { // Added 'virtual'
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
             _msgSender(), // Use OZ upgradeable context-aware sender
            msg.value
        );

        Tournament storage tournament = tournaments[tournamentId];
        tournament.hasEntryFee = true;
        tournament.entryFeeTokenAddress = entryFeeTokenAddress;
        tournament.entryFeeAmount = entryFeeAmount;
        tournament.feesDistributed = false;

        return tournamentId;
    }

    /**
     * @dev Register for a tournament without entry fee
     * (Uses nonReentrant from ReentrancyGuardUpgradeable)
     */
    function registerForTournament(uint256 tournamentId)
        external
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(block.timestamp <= tournament.registrationEndTime, "Registration period ended");
        require(!tournament.hasEntryFee, "Tournament requires entry fee");
        // *** UPDATED SENDER ***
        require(!tournament.participants[_msgSender()], "Already registered");
        if (tournament.maxParticipants > 0) {
            require(tournament.participantCount < tournament.maxParticipants, "Tournament is full");
        }
        // *** UPDATED SENDER ***
        tournament.participants[_msgSender()] = true;
        tournament.participantCount++;
        // *** UPDATED SENDER ***
        emit ParticipantRegistered(tournamentId, _msgSender());
    }

    /**
     * @dev Register for a tournament with entry fee
     * (Uses nonReentrant, updated IERC20 type hint and sender)
     */
    function registerWithEntryFee(uint256 tournamentId)
        external
        payable
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(block.timestamp <= tournament.registrationEndTime, "Registration period ended");
        require(tournament.hasEntryFee, "Tournament does not have entry fee");
        // *** UPDATED SENDER ***
        address sender = _msgSender();
        require(!tournament.participants[sender], "Already registered");
        if (tournament.maxParticipants > 0) {
            require(tournament.participantCount < tournament.maxParticipants, "Tournament is full");
        }

        if (tournament.entryFeeTokenAddress == address(0)) {
            require(msg.value == tournament.entryFeeAmount, "Incorrect entry fee amount");
        } else {
            require(msg.value == 0, "Don't send RON with token entry fee");
            // *** UPDATED TYPE HINT ***
            IERC20Upgradeable token = IERC20Upgradeable(tournament.entryFeeTokenAddress);
            uint256 balanceBefore = token.balanceOf(address(this));
            // *** UPDATED SENDER ***
            token.safeTransferFrom(sender, address(this), tournament.entryFeeAmount);
            uint256 balanceAfter = token.balanceOf(address(this));
            require(balanceAfter - balanceBefore == tournament.entryFeeAmount, "Token transfer amount mismatch");
        }

        // *** UPDATED SENDER ***
        tournament.participants[sender] = true;
        tournament.participantCount++;
        // *** UPDATED SENDER ***
        emit ParticipantRegistered(tournamentId, sender);

        // Auto-distribution logic remains the same conceptually
        if (!tournament.feesDistributed &&
            (block.timestamp + 1 hours >= tournament.registrationEndTime ||
             (tournament.maxParticipants > 0 && tournament.participantCount == tournament.maxParticipants))) {
            (uint256 creatorAmount, uint256 platformFeeAmount) = _distributeEntryFees(tournament, tournamentId);
            if (creatorAmount > 0) {
                emit EntryFeesAutoDistributed(tournamentId, tournament.creator, creatorAmount);
                emit PlatformFeesAutoDistributed(tournamentId, tournament.entryFeeTokenAddress, owner(), platformFeeAmount);
            }
        }
    }

    /**
     * @dev Internal function to distribute entry fees
     * (Updated IERC20 type hint)
     */
    function _distributeEntryFees(Tournament storage tournament, uint256 tournamentId) internal returns (uint256, uint256) {
        if (tournament.feesDistributed || !tournament.hasEntryFee) {
            return (0, 0);
        }
        uint256 totalEntryFees = tournament.participantCount * tournament.entryFeeAmount;
        if (totalEntryFees == 0) {
            tournament.feesDistributed = true;
            return (0, 0);
        }

        uint256 platformFeeAmount = (totalEntryFees * PLATFORM_FEE_PERCENTAGE) / PERCENTAGE_BASE;
        uint256 creatorAmount = totalEntryFees - platformFeeAmount;
        address ownerAddress = owner(); // From OwnableUpgradeable

        if (tournament.entryFeeTokenAddress == address(0)) {
            // Use SafeERC20Upgradeable's call patterns for consistency if desired, or keep native transfer
             (bool successCreator,) = payable(tournament.creator).call{value: creatorAmount}("");
             require(successCreator, "Native transfer failed");
             (bool successOwner,) = payable(ownerAddress).call{value: platformFeeAmount}("");
             require(successOwner, "Native transfer failed");
            // Or stick to .transfer() if preferred and gas stipend is sufficient
            // payable(tournament.creator).transfer(creatorAmount);
            // payable(ownerAddress).transfer(platformFeeAmount);
        } else {
            // *** UPDATED TYPE HINT ***
            IERC20Upgradeable token = IERC20Upgradeable(tournament.entryFeeTokenAddress);
            token.safeTransfer(tournament.creator, creatorAmount);
            token.safeTransfer(ownerAddress, platformFeeAmount);
        }

        tournament.feesDistributed = true;
        return (creatorAmount, platformFeeAmount);
    }

    /**
     * @dev Automatically distribute entry fees when registration ends
     * (Uses nonReentrant from ReentrancyGuardUpgradeable)
     */
    function distributeEntryFees(uint256 tournamentId)
        external
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(block.timestamp > tournament.registrationEndTime, "Registration period not ended yet");
        require(block.timestamp <= tournament.startTime, "Tournament has already started");

        (uint256 creatorAmount, uint256 platformFeeAmount) = _distributeEntryFees(tournament, tournamentId);
        if (creatorAmount > 0) {
            emit EntryFeesAutoDistributed(tournamentId, tournament.creator, creatorAmount);
            emit PlatformFeesAutoDistributed(tournamentId, tournament.entryFeeTokenAddress, owner(), platformFeeAmount);
        }
    }

    /**
     * @dev Claim entry fees for a tournament (manual method)
     * (Uses nonReentrant and onlyOwner from inherited contracts)
     */
    function claimEntryFees(uint256 tournamentId)
        external
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
        onlyTournamentCreator(tournamentId) // Modifier remains the same
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(tournament.hasEntryFee, "Tournament does not have entry fee");
        require(!tournament.feesDistributed, "Fees already distributed");

        (uint256 creatorAmount, uint256 platformFeeAmount) = _distributeEntryFees(tournament, tournamentId);
        if (creatorAmount > 0) {
            emit EntryFeesCollected(tournamentId, tournament.creator, creatorAmount);
            emit PlatformFeesAutoDistributed(tournamentId, tournament.entryFeeTokenAddress, owner(), platformFeeAmount);
        }
    }

    /**
     * @dev Withdraw platform fees
     * (Uses onlyOwner and nonReentrant from inherited contracts, updated IERC20 type hint)
     */
    function withdrawPlatformFees(address tokenAddress) external virtual onlyOwner nonReentrant { // Added 'virtual'
        // Note: This function interacts with the separate platformFees mapping,
        // which is NOT populated by the automatic _distributeEntryFees function.
        // _distributeEntryFees sends platform fees directly to the owner.
        // This function might be redundant or intended for other fee sources not shown.
        // If kept, ensure platformFees mapping is populated somehow.
        uint256 amount = platformFees[tokenAddress];
        require(amount > 0, "No fees to withdraw");
        platformFees[tokenAddress] = 0;
        address ownerAddress = owner(); // From OwnableUpgradeable

        if (tokenAddress == address(0)) {
            (bool successOwner,) = payable(ownerAddress).call{value: amount}("");
            require(successOwner, "Native transfer failed");
            // payable(owner()).transfer(amount);
        } else {
            // *** UPDATED TYPE HINT ***
            IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
            token.safeTransfer(ownerAddress, amount);
        }
        emit PlatformFeesWithdrawn(tokenAddress, ownerAddress, amount);
    }

    /**
     * @dev Internal function to declare a winner
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
        require(block.timestamp >= tournament.startTime, "Tournament has not started yet");
        if (tournament.participantCount > 0) {
            require(tournament.participants[winner], "Winner is not a registered participant");
        }
        tournament.winners[position] = winner;
        emit WinnerDeclared(tournamentId, position, winner);
    }

    /**
     * @dev Tournament creator declares a winner
     * (Uses nonReentrant from ReentrancyGuardUpgradeable)
     */
    function declareWinner(uint256 tournamentId, uint256 position, address winner)
        external
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
        onlyTournamentCreator(tournamentId) // Modifier remains the same
    {
        Tournament storage tournament = tournaments[tournamentId];
        _declareWinner(tournament, tournamentId, position, winner);
    }

    /**
     * @dev Declare multiple winners at once
     * (Uses nonReentrant from ReentrancyGuardUpgradeable)
     */
    function declareWinners(uint256 tournamentId, uint256[] memory positions, address[] memory winners)
        external
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
        onlyTournamentCreator(tournamentId) // Modifier remains the same
    {
        require(positions.length == winners.length, "Arrays length mismatch");
        Tournament storage tournament = tournaments[tournamentId];
        for (uint256 i = 0; i < positions.length; i++) {
            _declareWinner(tournament, tournamentId, positions[i], winners[i]);
        }
    }

    /**
     * @dev Winners claim their rewards
     * (Uses nonReentrant, updated IERC20 type hint and sender)
     */
    function claimReward(uint256 tournamentId, uint256 position)
        external
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(position < tournament.positionRewardAmounts.length, "Invalid position");
        require(!tournament.claimed[position], "Position already claimed");
        // *** UPDATED SENDER ***
        address sender = _msgSender();
        require(tournament.winners[position] == sender, "Not the winner");

        tournament.claimed[position] = true;
        uint256 rewardAmount = tournament.positionRewardAmounts[position];

        if (tournament.rewardTokenAddress == address(0)) {
             (bool successSend,) = payable(sender).call{value: rewardAmount}("");
             require(successSend, "Native transfer failed");
            // payable(sender).transfer(rewardAmount);
        } else {
            // *** UPDATED TYPE HINT ***
            IERC20Upgradeable token = IERC20Upgradeable(tournament.rewardTokenAddress);
            token.safeTransfer(sender, rewardAmount);
        }
        emit RewardClaimed(tournamentId, position, sender, rewardAmount);
    }

    /**
     * @dev Emergency function for creator to cancel tournament and reclaim funds
     * (Uses nonReentrant, updated IERC20 type hint)
     */
    function cancelTournament(uint256 tournamentId)
        external
        virtual // Added 'virtual'
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
        onlyTournamentCreator(tournamentId) // Modifier remains the same
    {
        Tournament storage tournament = tournaments[tournamentId];
        tournament.isActive = false;

        uint256 unclaimedAmount = 0;
        for (uint256 i = 0; i < tournament.positionRewardAmounts.length; i++) {
            if (!tournament.claimed[i]) {
                unclaimedAmount += tournament.positionRewardAmounts[i];
            }
        }

        if (unclaimedAmount > 0) {
            if (tournament.rewardTokenAddress == address(0)) {
                 (bool successSend,) = payable(tournament.creator).call{value: unclaimedAmount}("");
                 require(successSend, "Native transfer failed");
                // payable(tournament.creator).transfer(unclaimedAmount);
            } else {
                // *** UPDATED TYPE HINT ***
                IERC20Upgradeable token = IERC20Upgradeable(tournament.rewardTokenAddress);
                token.safeTransfer(tournament.creator, unclaimedAmount);
            }
        }
        emit TournamentCancelled(tournamentId);
    }

    // --- GETTER FUNCTIONS ---
    // View functions generally don't need changes for basic upgradeability

    function getTournamentInfo(uint256 tournamentId)
        external
        view
        virtual // Added 'virtual'
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
        // Logic remains the same
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

    function getPositionInfo(uint256 tournamentId, uint256 position)
        external
        view
        virtual // Added 'virtual'
        tournamentExists(tournamentId)
        returns (
            uint256 rewardAmount,
            address winner,
            bool claimed
        )
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(position < tournament.positionRewardAmounts.length, "Invalid position");
        // Logic remains the same
        return (
            tournament.positionRewardAmounts[position],
            tournament.winners[position],
            tournament.claimed[position]
        );
    }

     function getPositionRewardAmounts(uint256 tournamentId)
        external
        view
        virtual // Added 'virtual'
        tournamentExists(tournamentId)
        returns (uint256[] memory)
    {
        // Logic remains the same
        return tournaments[tournamentId].positionRewardAmounts;
    }

    function isParticipantRegistered(uint256 tournamentId, address participant)
        external
        view
        virtual // Added 'virtual'
        tournamentExists(tournamentId)
        returns (bool)
    {
        // Logic remains the same
        return tournaments[tournamentId].participants[participant];
    }

    function getWinnerPosition(uint256 tournamentId, address winnerAddress)
        external
        view
        virtual // Added 'virtual'
        tournamentExists(tournamentId)
        returns (uint256)
    {
        Tournament storage tournament = tournaments[tournamentId];
        // Logic remains the same
        for (uint256 i = 0; i < tournament.positionRewardAmounts.length; i++) {
            if (tournament.winners[i] == winnerAddress) {
                return i + 1; // 1-based position
            }
        }
        revert("Address is not a winner");
    }

    function hasClaimedReward(uint256 tournamentId, address winnerAddress)
        external
        view
        virtual // Added 'virtual'
        tournamentExists(tournamentId)
        returns (bool)
    {
        Tournament storage tournament = tournaments[tournamentId];
        // Logic remains the same
        for (uint256 i = 0; i < tournament.positionRewardAmounts.length; i++) {
            if (tournament.winners[i] == winnerAddress) {
                return tournament.claimed[i];
            }
        }
        revert("Address is not a winner");
    }

    // Gap added for upgrade safety (prevents new variables from colliding with parent contracts)
    // See: https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#storage-gaps
    uint256[49] private __gap;
}
