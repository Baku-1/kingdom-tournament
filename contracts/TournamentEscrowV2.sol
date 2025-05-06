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
 * Changes: Added entry fee refund on cancellation, removed tournamentType,
 * limited winner positions, removed auto fee distribution.
 */
contract TournamentEscrowV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // UPGRADEABLE LIBRARY USAGE
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // --- CONSTANTS ---
    // Tournament types (Constants are fine, even if type removed from struct)
    // uint8 public constant TOURNAMENT_TYPE_SINGLE_ELIMINATION = 0; // Example if needed elsewhere
    // uint8 public constant TOURNAMENT_TYPE_DOUBLE_ELIMINATION = 1; // Example if needed elsewhere

    // Platform fee percentage
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 250; // 2.5% = 250 / 10000
    uint256 public constant PERCENTAGE_BASE = 10000; // 100% = 10000

    // Minimum time requirements
    uint256 public constant MIN_REGISTRATION_PERIOD = 1 hours;

    // Maximum winner positions allowed
    uint256 public constant MAX_WINNER_POSITIONS = 10;

    // --- STRUCTS ---
    struct Tournament {
        uint256 id;
        address creator;
        string name;
        string description;
        string gameId;
        // uint8 tournamentType; // Removed as requested
        uint256 maxParticipants;
        uint256 createdAt;
        uint256 startTime;
        uint256 registrationEndTime;
        bool isActive; // Becomes false on cancellation

        // Reward info
        address rewardTokenAddress;  // address(0) for native token (e.g., RON, ETH)
        uint256 totalRewardAmount;

        // Entry fee info
        bool hasEntryFee;
        address entryFeeTokenAddress; // address(0) for native token
        uint256 entryFeeAmount;
        bool feesDistributed;         // Track if fees have been distributed

        // Positions and rewards
        uint256[] positionRewardAmounts;  // Reward amount for each position (max length MAX_WINNER_POSITIONS)
        mapping(uint256 => address) winners;  // Position -> Winner address
        mapping(uint256 => bool) claimed;     // Position -> Claimed status

        // Participants
        uint256 participantCount;
        mapping(address => bool) participants; // Tracks registration status
    }

    // --- STATE VARIABLES ---
    mapping(uint256 => Tournament) public tournaments;
    uint256 public nextTournamentId;

    // Tracks entry fees paid by participants for potential refund
    mapping(uint256 => mapping(address => uint256)) public entryFeesPaid;

    // Platform fees collected (Potentially unused for entry fees now, see withdrawPlatformFees note)
    mapping(address => uint256) public platformFees;

    // --- EVENTS ---
    event TournamentCreated(uint256 indexed tournamentId, address indexed creator, string name);
    event ParticipantRegistered(uint256 indexed tournamentId, address indexed participant);
    event WinnerDeclared(uint256 indexed tournamentId, uint256 position, address winner);
    event RewardClaimed(uint256 indexed tournamentId, uint256 position, address winner, uint256 amount);
    event TournamentCancelled(uint256 indexed tournamentId);
    event EntryFeesDistributed(uint256 indexed tournamentId, address indexed creator, uint256 creatorAmount, uint256 platformFeeAmount); // Renamed from Collected & AutoDistributed
    event PlatformFeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event EntryFeeRefunded(uint256 indexed tournamentId, address indexed participant, uint256 amount); // New event for refunds


    // --- INITIALIZATION ---
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        nextTournamentId = 1;
    }

    // --- UUPS UPGRADE AUTHORIZATION ---
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    // --- MODIFIERS ---
    modifier tournamentExists(uint256 tournamentId) {
        require(tournaments[tournamentId].id == tournamentId, "Tournament does not exist");
        _;
    }

    modifier tournamentActive(uint256 tournamentId) {
        require(tournaments[tournamentId].isActive, "Tournament not active");
        _;
    }

    modifier onlyTournamentCreator(uint256 tournamentId) {
        require(_msgSender() == tournaments[tournamentId].creator, "Not tournament creator");
        _;
    }

    // --- CORE LOGIC ---

    /**
     * @dev Internal function to create a tournament
     */
    function _createTournament(
        string memory name,
        string memory description,
        string memory gameId,
        // uint8 tournamentType, // Removed
        uint256 maxParticipants,
        uint256 registrationEndTime,
        uint256 startTime,
        address rewardTokenAddress,
        uint256[] memory positionRewardAmounts,
        address msgSender,
        uint256 msgValue
    ) internal returns (uint256) {
        // Validations
        require(bytes(name).length > 0, "Name cannot be empty");
        // require(tournamentType <= TOURNAMENT_TYPE_DOUBLE_ELIMINATION, "Invalid tournament type"); // Removed
        require(positionRewardAmounts.length > 0, "No positions provided");
        require(positionRewardAmounts.length <= MAX_WINNER_POSITIONS, "Exceeds max winner positions"); // Added limit check
        require(registrationEndTime > block.timestamp, "Registration end time must be in the future");
        require(startTime > registrationEndTime, "Start time must be after registration end time");
        require(startTime - registrationEndTime >= MIN_REGISTRATION_PERIOD, "Registration period too short");

        uint256 totalReward = 0;
        for (uint256 i = 0; i < positionRewardAmounts.length; i++) {
            require(positionRewardAmounts[i] > 0, "Reward amount must be positive"); // Added check for zero rewards
            totalReward += positionRewardAmounts[i];
        }
        require(totalReward > 0, "Total reward must be positive"); // Ensure total reward isn't zero

        // Handle reward escrow
        if (rewardTokenAddress == address(0)) {
            require(msgValue == totalReward, "Incorrect native reward amount sent");
        } else {
            require(msgValue == 0, "Do not send native currency with token rewards");
            uint256 codeSize;
            address tokenAddr = rewardTokenAddress;
            assembly { codeSize := extcodesize(tokenAddr) }
            require(codeSize > 0, "Reward token address is not a contract");

            IERC20Upgradeable token = IERC20Upgradeable(rewardTokenAddress);
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransferFrom(msgSender, address(this), totalReward);
            uint256 balanceAfter = token.balanceOf(address(this));
            require(balanceAfter - balanceBefore == totalReward, "Reward token transfer amount mismatch");
        }

        // Create tournament
        uint256 tournamentId = nextTournamentId++;
        Tournament storage tournament = tournaments[tournamentId];
        tournament.id = tournamentId;
        tournament.creator = msgSender;
        tournament.name = name;
        tournament.description = description;
        tournament.gameId = gameId;
        // tournament.tournamentType = tournamentType; // Removed
        tournament.maxParticipants = maxParticipants;
        tournament.createdAt = block.timestamp;
        tournament.startTime = startTime;
        tournament.registrationEndTime = registrationEndTime;
        tournament.isActive = true; // Active on creation
        tournament.rewardTokenAddress = rewardTokenAddress;
        tournament.totalRewardAmount = totalReward;
        tournament.hasEntryFee = false; // Default, overridden if fee added
        tournament.feesDistributed = true; // True if no entry fee

        // Store position rewards
        tournament.positionRewardAmounts = positionRewardAmounts; // Assign directly

        emit TournamentCreated(tournamentId, msgSender, name);
        return tournamentId;
    }

    /**
     * @dev Create a tournament with escrowed rewards (no entry fee)
     */
    function createTournament(
        string memory name,
        string memory description,
        string memory gameId,
        // uint8 tournamentType, // Removed
        uint256 maxParticipants,
        uint256 registrationEndTime,
        uint256 startTime,
        address rewardTokenAddress,
        uint256[] memory positionRewardAmounts
    ) external payable virtual nonReentrant returns (uint256) {
        return _createTournament(
            name,
            description,
            gameId,
            // tournamentType, // Removed
            maxParticipants,
            registrationEndTime,
            startTime,
            rewardTokenAddress,
            positionRewardAmounts,
            _msgSender(),
            msg.value
        );
    }

     /**
     * @dev Create a tournament with entry fee
     */
    function createTournamentWithEntryFee(
        string memory name,
        string memory description,
        string memory gameId,
        // uint8 tournamentType, // Removed
        uint256 maxParticipants,
        uint256 registrationEndTime,
        uint256 startTime,
        address rewardTokenAddress,
        uint256[] memory positionRewardAmounts,
        address entryFeeTokenAddress,
        uint256 entryFeeAmount
    ) external payable virtual nonReentrant returns (uint256) {
        require(entryFeeAmount > 0, "Entry fee must be positive"); // Add check for zero entry fee

        // Check entry fee token contract validity if not native
        if (entryFeeTokenAddress != address(0)) {
             uint256 codeSize;
             address tokenAddr = entryFeeTokenAddress;
             assembly { codeSize := extcodesize(tokenAddr) }
             require(codeSize > 0, "Entry fee token address is not a contract");
        }

        // Create the base tournament (escrows rewards)
        uint256 tournamentId = _createTournament(
            name,
            description,
            gameId,
            // tournamentType, // Removed
            maxParticipants,
            registrationEndTime,
            startTime,
            rewardTokenAddress,
            positionRewardAmounts,
            _msgSender(),
            msg.value // This should only contain reward value
        );

        // Add entry fee information
        Tournament storage tournament = tournaments[tournamentId];
        tournament.hasEntryFee = true;
        tournament.entryFeeTokenAddress = entryFeeTokenAddress;
        tournament.entryFeeAmount = entryFeeAmount;
        tournament.feesDistributed = false; // Fees are pending distribution

        return tournamentId;
    }

    /**
     * @dev Register for a tournament without entry fee
     */
    function registerForTournament(uint256 tournamentId)
        external
        virtual
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(block.timestamp <= tournament.registrationEndTime, "Registration period ended");
        require(!tournament.hasEntryFee, "Tournament requires entry fee");

        address sender = _msgSender();
        require(!tournament.participants[sender], "Already registered");

        if (tournament.maxParticipants > 0) {
            require(tournament.participantCount < tournament.maxParticipants, "Tournament is full");
        }

        tournament.participants[sender] = true;
        tournament.participantCount++;
        emit ParticipantRegistered(tournamentId, sender);
    }

    /**
     * @dev Register for a tournament with entry fee. Fees are held in the contract.
     */
    function registerWithEntryFee(uint256 tournamentId)
        external
        payable
        virtual
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(block.timestamp <= tournament.registrationEndTime, "Registration period ended");
        require(tournament.hasEntryFee, "Tournament does not have entry fee");

        address sender = _msgSender();
        require(!tournament.participants[sender], "Already registered");

        if (tournament.maxParticipants > 0) {
            require(tournament.participantCount < tournament.maxParticipants, "Tournament is full");
        }

        // Handle entry fee payment TO THIS CONTRACT
        if (tournament.entryFeeTokenAddress == address(0)) {
            require(msg.value == tournament.entryFeeAmount, "Incorrect native entry fee amount");
            // Native currency is now held by the contract
        } else {
            require(msg.value == 0, "Do not send native currency with token entry fee");
            IERC20Upgradeable token = IERC20Upgradeable(tournament.entryFeeTokenAddress);
            // Transfer fee FROM sender TO this contract
            token.safeTransferFrom(sender, address(this), tournament.entryFeeAmount);
        }

        // Record fee paid for potential refund
        entryFeesPaid[tournamentId][sender] = tournament.entryFeeAmount;

        // Register participant
        tournament.participants[sender] = true;
        tournament.participantCount++;
        emit ParticipantRegistered(tournamentId, sender);

        // Removed auto-distribution logic
    }

    /**
     * @dev Internal function to distribute collected entry fees FROM the contract balance.
     * Should only be called after registration ends and if tournament is active.
     */
    function _distributeEntryFees(Tournament storage tournament, uint256 tournamentId) internal {
        // Ensure fees haven't been distributed and the tournament wasn't cancelled
        require(!tournament.feesDistributed, "Fees already distributed");
        require(tournament.isActive, "Cannot distribute fees for cancelled tournament");
        require(tournament.hasEntryFee, "Tournament has no entry fee"); // Sanity check

        uint256 totalEntryFees = tournament.participantCount * tournament.entryFeeAmount;
        if (totalEntryFees == 0) {
            tournament.feesDistributed = true; // Mark distributed even if zero fees
            return;
        }

        // Calculate amounts
        uint256 platformFeeAmount = (totalEntryFees * PLATFORM_FEE_PERCENTAGE) / PERCENTAGE_BASE;
        uint256 creatorAmount = totalEntryFees - platformFeeAmount;
        address ownerAddress = owner();

        // Transfer amounts FROM this contract's balance
        if (tournament.entryFeeTokenAddress == address(0)) {
            // Native currency transfer
            require(address(this).balance >= totalEntryFees, "Insufficient contract balance for native fee distribution");
            (bool successCreator,) = payable(tournament.creator).call{value: creatorAmount}("");
            require(successCreator, "Native fee transfer to creator failed");
            (bool successOwner,) = payable(ownerAddress).call{value: platformFeeAmount}("");
            require(successOwner, "Native fee transfer to owner failed");
        } else {
            // ERC20 token transfer
            IERC20Upgradeable token = IERC20Upgradeable(tournament.entryFeeTokenAddress);
            require(token.balanceOf(address(this)) >= totalEntryFees, "Insufficient contract balance for token fee distribution");
            token.safeTransfer(tournament.creator, creatorAmount);
            token.safeTransfer(ownerAddress, platformFeeAmount);
        }

        // Mark fees as distributed
        tournament.feesDistributed = true;

        emit EntryFeesDistributed(tournamentId, tournament.creator, creatorAmount, platformFeeAmount);
    }

    /**
     * @dev Distribute entry fees after registration ends. Can be called by anyone.
     */
    function distributeEntryFees(uint256 tournamentId)
        external
        virtual
        nonReentrant
        tournamentExists(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        // Check if registration period has ended
        require(block.timestamp > tournament.registrationEndTime, "Registration period not ended yet");
        // No need to check start time strictly, just ensure it's active and fees aren't distributed

        // Distribute fees (internal function contains necessary checks)
        _distributeEntryFees(tournament, tournamentId);
    }

    /**
     * @dev Withdraw platform fees collected in the separate `platformFees` mapping.
     * Note: This mapping is NOT populated by the entry fee distribution logic.
     * Its purpose needs clarification or it might be removed in future upgrades.
     */
    function withdrawPlatformFees(address tokenAddress) external virtual onlyOwner nonReentrant {
        uint256 amount = platformFees[tokenAddress];
        require(amount > 0, "No fees to withdraw from this mapping");
        platformFees[tokenAddress] = 0;
        address ownerAddress = owner();

        if (tokenAddress == address(0)) {
            (bool successOwner,) = payable(ownerAddress).call{value: amount}("");
            require(successOwner, "Native transfer failed");
        } else {
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
        require(position < tournament.positionRewardAmounts.length, "Invalid position index"); // Index vs Position
        require(!tournament.claimed[position], "Position already claimed");
        require(winner != address(0), "Winner cannot be zero address");
        require(block.timestamp >= tournament.startTime, "Tournament has not started yet");
        // Check if winner is a registered participant (optional, maybe non-participants can win?)
        if (tournament.participantCount > 0) {
             require(tournament.participants[winner], "Winner is not a registered participant");
        }
        tournament.winners[position] = winner;
        emit WinnerDeclared(tournamentId, position + 1, winner); // Emit 1-based position
    }

    /**
     * @dev Tournament creator declares a winner (0-based index for position)
     */
    function declareWinner(uint256 tournamentId, uint256 position, address winner)
        external
        virtual
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
        onlyTournamentCreator(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        _declareWinner(tournament, tournamentId, position, winner);
    }

    /**
     * @dev Declare multiple winners at once (0-based indices for positions)
     */
    function declareWinners(uint256 tournamentId, uint256[] memory positions, address[] memory winners)
        external
        virtual
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
     * @dev Winners claim their rewards (0-based index for position)
     */
    function claimReward(uint256 tournamentId, uint256 position)
        external
        virtual
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(position < tournament.positionRewardAmounts.length, "Invalid position index");
        require(!tournament.claimed[position], "Position already claimed");

        address sender = _msgSender();
        require(tournament.winners[position] == sender, "Not the winner for this position");

        tournament.claimed[position] = true;
        uint256 rewardAmount = tournament.positionRewardAmounts[position];

        // Transfer reward FROM contract balance
        if (tournament.rewardTokenAddress == address(0)) {
             require(address(this).balance >= rewardAmount, "Insufficient contract balance for native reward");
             (bool successSend,) = payable(sender).call{value: rewardAmount}("");
             require(successSend, "Native reward transfer failed");
        } else {
            IERC20Upgradeable token = IERC20Upgradeable(tournament.rewardTokenAddress);
            require(token.balanceOf(address(this)) >= rewardAmount, "Insufficient contract balance for token reward");
            token.safeTransfer(sender, rewardAmount);
        }
        emit RewardClaimed(tournamentId, position + 1, sender, rewardAmount); // Emit 1-based position
    }

    /**
     * @dev Emergency function for creator to cancel tournament.
     * Allows participants to claim entry fee refunds if fees were not distributed.
     * Returns unclaimed rewards to the creator.
     */
    function cancelTournament(uint256 tournamentId)
        external
        virtual
        nonReentrant
        tournamentExists(tournamentId)
        tournamentActive(tournamentId) // Can only cancel active tournaments
        onlyTournamentCreator(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];

        // Mark as inactive FIRST. This prevents fee distribution and allows refunds.
        tournament.isActive = false;

        // Entry fees are now handled by claimEntryFeeRefund if !feesDistributed

        // Calculate and return unclaimed REWARDS to creator
        uint256 unclaimedRewardAmount = 0;
        for (uint256 i = 0; i < tournament.positionRewardAmounts.length; i++) {
            // Only count reward if winner was declared but not claimed
            // If winner wasn't declared, the reward remains for the creator
            if (tournament.winners[i] != address(0) && !tournament.claimed[i]) {
                 unclaimedRewardAmount += tournament.positionRewardAmounts[i];
            } else if (tournament.winners[i] == address(0)) {
                 // If no winner declared for a position, creator gets it back
                 unclaimedRewardAmount += tournament.positionRewardAmounts[i];
            }
        }

        if (unclaimedRewardAmount > 0) {
            address creator = tournament.creator; // Cache storage read
            if (tournament.rewardTokenAddress == address(0)) {
                 require(address(this).balance >= unclaimedRewardAmount, "Insufficient contract balance for native reward refund");
                 (bool successSend,) = payable(creator).call{value: unclaimedRewardAmount}("");
                 require(successSend, "Native reward refund to creator failed");
            } else {
                IERC20Upgradeable token = IERC20Upgradeable(tournament.rewardTokenAddress);
                require(token.balanceOf(address(this)) >= unclaimedRewardAmount, "Insufficient contract balance for token reward refund");
                token.safeTransfer(creator, unclaimedRewardAmount);
            }
        }

        emit TournamentCancelled(tournamentId);
    }

    /**
     * @dev Allows a participant to claim back their entry fee if the tournament
     * was cancelled before fees were distributed.
     */
    function claimEntryFeeRefund(uint256 tournamentId)
        external
        virtual
        nonReentrant
        tournamentExists(tournamentId)
    {
        Tournament storage tournament = tournaments[tournamentId];

        // Check conditions for refund eligibility
        require(!tournament.isActive, "Tournament not cancelled");
        require(tournament.hasEntryFee, "Tournament has no entry fee");
        require(!tournament.feesDistributed, "Fees already distributed (cannot refund)");

        address sender = _msgSender();
        uint256 feeAmount = entryFeesPaid[tournamentId][sender];

        require(feeAmount > 0, "No entry fee paid or already refunded");
        // require(tournament.participants[sender], "Not a registered participant"); // Redundant check? entryFeesPaid implies registration

        // Prevent double refund
        entryFeesPaid[tournamentId][sender] = 0;

        // Transfer fee back FROM contract balance
        if (tournament.entryFeeTokenAddress == address(0)) {
            require(address(this).balance >= feeAmount, "Insufficient contract balance for native refund");
            (bool successSend,) = payable(sender).call{value: feeAmount}("");
            require(successSend, "Native entry fee refund failed");
        } else {
            IERC20Upgradeable token = IERC20Upgradeable(tournament.entryFeeTokenAddress);
            require(token.balanceOf(address(this)) >= feeAmount, "Insufficient contract balance for token refund");
            token.safeTransfer(sender, feeAmount);
        }

        emit EntryFeeRefunded(tournamentId, sender, feeAmount);
    }


    // --- GETTER FUNCTIONS ---

    function getTournamentInfo(uint256 tournamentId)
        external
        view
        virtual
        tournamentExists(tournamentId)
        returns (
            address creator,
            string memory name,
            string memory description,
            string memory gameId,
            // uint8 tournamentType, // Removed
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
            // tournament.tournamentType, // Removed
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
        virtual
        tournamentExists(tournamentId)
        returns (
            uint256 rewardAmount,
            address winner,
            bool claimed
        )
    {
        Tournament storage tournament = tournaments[tournamentId];
        require(position < tournament.positionRewardAmounts.length, "Invalid position index");
        return (
            tournament.positionRewardAmounts[position],
            tournament.winners[position],
            tournament.claimed[position]
        );
    }

     function getPositionRewardAmounts(uint256 tournamentId)
        external
        view
        virtual
        tournamentExists(tournamentId)
        returns (uint256[] memory)
    {
        return tournaments[tournamentId].positionRewardAmounts;
    }

    function isParticipantRegistered(uint256 tournamentId, address participant)
        external
        view
        virtual
        tournamentExists(tournamentId)
        returns (bool)
    {
        return tournaments[tournamentId].participants[participant];
    }

    // --- Helper View Functions ---

    /**
     * @dev Check the entry fee amount paid by a specific participant for a tournament.
     * Returns 0 if no fee was paid or if it has been refunded.
     */
    function getEntryFeePaid(uint256 tournamentId, address participant)
        external
        view
        virtual
        tournamentExists(tournamentId)
        returns (uint256)
    {
         return entryFeesPaid[tournamentId][participant];
    }


    // --- Storage Gap ---
    // Gap added for upgrade safety
    uint256[49] private __gap;
}
```

**Key Changes Implemented:**

* **Refund Logic:**
    * Added `entryFeesPaid` mapping to track payments.
    * `registerWithEntryFee` now stores the fee amount in `entryFeesPaid` and ensures the contract holds the funds.
    * Added `claimEntryFeeRefund` function allowing participants to withdraw their fee if `!isActive` and `!feesDistributed`.
    * Added `EntryFeeRefunded` event.
    * `cancelTournament` now simply sets `isActive = false`, enabling the pull refund mechanism. It also clarifies logic for returning unclaimed rewards.
    * `_distributeEntryFees` checks `isActive` and transfers from the contract's balance.
* **Fee Distribution Trigger:** Removed the auto-distribution block from `registerWithEntryFee`. Relies on the external `distributeEntryFees` call. Renamed fee distribution event for clarity.
* **`tournamentType` Removed:** Deleted from `Tournament` struct, `_createTournament`, `createTournament`, `createTournamentWithEntryFee`, and `getTournamentInfo`.
* **Winner Limit:** Added `require(positionRewardAmounts.length <= MAX_WINNER_POSITIONS, "Exceeds max winner positions");` in `_createTournament`. Defined `MAX_WINNER_POSITIONS` constant.
* **`withdrawPlatformFees`:** Left functionally the same, but added comments clarifying its likely disconnection from entry fees in the current flow.
* **Minor Fixes/Improvements:** Added checks for zero reward/entry fee amounts, clarified event emissions (1-based positions), used low-level calls for native transfers with balance checks. Added `getEntryFeePaid` view function.

This version addresses the specific points raised while maintaining the upgradeable structure. Remember to test these changes thoroughly, including the cancellation and refund scenarios, before deployme
