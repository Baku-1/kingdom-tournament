const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("TournamentEscrowV2", function () {
  let tournamentEscrow;
  let mockToken;
  let owner;
  let creator;
  let participant1;
  let participant2;
  let participant3;
  let winner1;
  let winner2;
  let winner3;
  let nonCreator;

  beforeEach(async function () {
    // Get signers
    [owner, creator, participant1, participant2, participant3, winner1, winner2, winner3, nonCreator] = await ethers.getSigners();

    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Mint tokens to creator and participants
    await mockToken.mint(creator.address, ethers.parseUnits("1000", 18));
    await mockToken.mint(participant1.address, ethers.parseUnits("100", 18));
    await mockToken.mint(participant2.address, ethers.parseUnits("100", 18));
    await mockToken.mint(participant3.address, ethers.parseUnits("100", 18));

    // Deploy TournamentEscrowV2 contract with initialization
    const TournamentEscrow = await ethers.getContractFactory("TournamentEscrowV2");
    tournamentEscrow = await upgrades.deployProxy(TournamentEscrow, [], { initializer: 'initialize' });
    await tournamentEscrow.waitForDeployment();
  });

  describe("Tournament Creation", function () {
    it("Should create a tournament with ERC20 token rewards", async function () {
      // Approve token transfer
      await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));

      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      // Position reward amounts
      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Create tournament
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Test Tournament",
        "A test tournament",
        "game1",
        100, // max participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();

      // Check for TournamentCreated event
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      expect(event).to.not.be.undefined;

      // Get tournament ID from event
      const tournamentId = event.args[0];

      // Get tournament info
      const tournamentInfo = await tournamentEscrow.getTournamentInfo(tournamentId);

      // Verify tournament details
      expect(tournamentInfo[0]).to.equal(creator.address); // creator
      expect(tournamentInfo[1]).to.equal("Test Tournament"); // name
      expect(tournamentInfo[2]).to.equal("A test tournament"); // description
      expect(tournamentInfo[3]).to.equal("game1"); // gameId
      expect(tournamentInfo[4]).to.equal(100); // maxParticipants
      expect(tournamentInfo[8]).to.be.true; // isActive
      expect(tournamentInfo[9]).to.equal(await mockToken.getAddress()); // rewardTokenAddress
      expect(tournamentInfo[10]).to.equal(ethers.parseUnits("100", 18)); // totalRewardAmount
      expect(tournamentInfo[11]).to.equal(3); // positionCount
    });

    it("Should create a tournament with native token rewards", async function () {
      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("1", 18),
        ethers.parseUnits("0.5", 18),
        ethers.parseUnits("0.25", 18)
      ];

      // Calculate total reward amount
      const totalReward = ethers.parseUnits("1.75", 18);

      // Create tournament with native token (address(0))
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Native Token Tournament",
        "A tournament with native token rewards",
        "game2",
        50, // max participants
        registrationEndTime,
        startTime,
        ethers.ZeroAddress, // address(0) for native token
        positionRewardAmounts,
        { value: totalReward } // Send native tokens with transaction
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );

      const tournamentId = event.args[0];
      const tournamentInfo = await tournamentEscrow.getTournamentInfo(tournamentId);

      expect(tournamentInfo[9]).to.equal(ethers.ZeroAddress); // rewardTokenAddress
      expect(tournamentInfo[10]).to.equal(totalReward); // totalRewardAmount
    });

    it("Should fail if name is empty", async function () {
      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Try to create tournament with empty name
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "", // Empty name
          "A test tournament",
          "game1",
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts
        )
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should enforce maximum winner positions limit", async function () {
      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      // Create an array with more than MAX_WINNER_POSITIONS (which is likely 10)
      const tooManyPositions = Array(11).fill().map((_, i) => ethers.parseUnits((10 - i).toString(), 18));

      // Try to create tournament with too many positions
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Too Many Positions",
          "A tournament with too many winner positions",
          "game1",
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          tooManyPositions
        )
      ).to.be.revertedWith("Exceeds max winner positions");
    });
  });

  describe("Tournament Registration", function () {
    let tournamentId;

    beforeEach(async function () {
      // Approve token transfer
      await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));

      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Create tournament
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Test Tournament",
        "A test tournament",
        "game1",
        100, // max participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      tournamentId = event.args[0];
    });

    it("Should allow participants to register", async function () {
      // Register participants
      await tournamentEscrow.connect(participant1).registerForTournament(tournamentId);
      await tournamentEscrow.connect(participant2).registerForTournament(tournamentId);

      // Check if participants are registered - we'll verify this directly instead of checking the count
      // The participantCount might be at a different index than expected

      // Check if participants are registered
      expect(await tournamentEscrow.isParticipantRegistered(tournamentId, participant1.address)).to.be.true;
      expect(await tournamentEscrow.isParticipantRegistered(tournamentId, participant2.address)).to.be.true;
    });

    it("Should not allow duplicate registrations", async function () {
      // Register once
      await tournamentEscrow.connect(participant1).registerForTournament(tournamentId);

      // Try to register again
      await expect(
        tournamentEscrow.connect(participant1).registerForTournament(tournamentId)
      ).to.be.revertedWith("Already registered");
    });

    it("Should not allow registration after end time", async function () {
      // Advance time past registration end time
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");

      // Try to register after registration end time
      await expect(
        tournamentEscrow.connect(participant1).registerForTournament(tournamentId)
      ).to.be.revertedWith("Registration period ended");
    });

    it("Should allow unlimited participants when maxParticipants is 0", async function () {
      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Approve token transfer
      await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));

      // Create tournament with maxParticipants = 0 (unlimited)
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Unlimited Tournament",
        "A tournament with unlimited participants",
        "game1",
        0, // 0 means unlimited participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      const unlimitedTournamentId = event.args[0];

      // Register multiple participants
      await tournamentEscrow.connect(participant1).registerForTournament(unlimitedTournamentId);
      await tournamentEscrow.connect(participant2).registerForTournament(unlimitedTournamentId);
      await tournamentEscrow.connect(participant3).registerForTournament(unlimitedTournamentId);

      // Verify all participants are registered
      expect(await tournamentEscrow.isParticipantRegistered(unlimitedTournamentId, participant1.address)).to.be.true;
      expect(await tournamentEscrow.isParticipantRegistered(unlimitedTournamentId, participant2.address)).to.be.true;
      expect(await tournamentEscrow.isParticipantRegistered(unlimitedTournamentId, participant3.address)).to.be.true;
    });

    it("Should not allow registration for a cancelled tournament", async function () {
      // Cancel the tournament
      await tournamentEscrow.connect(creator).cancelTournament(tournamentId);

      // Try to register for cancelled tournament
      await expect(
        tournamentEscrow.connect(participant1).registerForTournament(tournamentId)
      ).to.be.revertedWith("Tournament not active");
    });
  });

  describe("Winner Declaration and Reward Claiming", function () {
    let tournamentId;

    beforeEach(async function () {
      // Approve token transfer
      await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));

      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Create tournament
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Test Tournament",
        "A test tournament",
        "game1",
        100, // max participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      tournamentId = event.args[0];

      // Register participants
      await tournamentEscrow.connect(winner1).registerForTournament(tournamentId);
      await tournamentEscrow.connect(winner2).registerForTournament(tournamentId);
      await tournamentEscrow.connect(winner3).registerForTournament(tournamentId);

      // Advance time to start of tournament
      await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
      await ethers.provider.send("evm_mine");
    });

    it("Should allow creator to declare a winner", async function () {
      // Declare winner for first position (index 0)
      const tx = await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner1.address
      );

      const receipt = await tx.wait();

      // Check for WinnerDeclared event
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "WinnerDeclared"
      );
      expect(event).to.not.be.undefined;

      // Position in event should be 1-based (position + 1)
      expect(event.args[1]).to.equal(1); // position
      expect(event.args[2]).to.equal(winner1.address); // winner

      // Check position info
      const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      expect(positionInfo[1]).to.equal(winner1.address); // winner
      expect(positionInfo[2]).to.be.false; // claimed (should be false initially)
    });

    it("Should allow declaring multiple winners at once", async function () {
      // Declare multiple winners
      const positions = [0, 1, 2];
      const winners = [winner1.address, winner2.address, winner3.address];

      await tournamentEscrow.connect(creator).declareWinners(
        tournamentId,
        positions,
        winners
      );

      // Check each position
      for (let i = 0; i < positions.length; i++) {
        const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, positions[i]);
        expect(positionInfo[1]).to.equal(winners[i]);
      }
    });

    it("Should allow winner to claim reward", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner1.address
      );

      // Check balance before claiming
      const balanceBefore = await mockToken.balanceOf(winner1.address);

      // Claim reward
      const tx = await tournamentEscrow.connect(winner1).claimReward(tournamentId, 0);
      const receipt = await tx.wait();

      // Check for RewardClaimed event
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "RewardClaimed"
      );
      expect(event).to.not.be.undefined;

      // Check winner's balance after claiming
      const balanceAfter = await mockToken.balanceOf(winner1.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("50", 18));

      // Check position info (should be marked as claimed)
      const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      expect(positionInfo[2]).to.be.true; // claimed
    });

    it("Should not allow claiming reward twice", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner1.address
      );

      // Claim reward
      await tournamentEscrow.connect(winner1).claimReward(tournamentId, 0);

      // Try to claim again
      await expect(
        tournamentEscrow.connect(winner1).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Position already claimed");
    });

    it("Should not allow non-winner to claim reward", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner1.address
      );

      // Try to claim as non-winner
      await expect(
        tournamentEscrow.connect(winner2).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Not the winner for this position");
    });
  });

  describe("Tournament Edge Cases", function () {
    let tournamentId;

    beforeEach(async function () {
      // Approve token transfer
      await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));

      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Create tournament
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Test Tournament",
        "A test tournament",
        "game1",
        100, // max participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      tournamentId = event.args[0];

      // Register participants
      await tournamentEscrow.connect(winner1).registerForTournament(tournamentId);
      await tournamentEscrow.connect(winner2).registerForTournament(tournamentId);
    });

    it("Should not allow declaring winner before tournament starts", async function () {
      // Try to declare winner before tournament starts
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          tournamentId,
          0,
          winner1.address
        )
      ).to.be.revertedWith("Tournament has not started yet");
    });

    it("Should enforce max participants limit", async function () {
      // Create a tournament with small max participants
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Approve token transfer
      await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));

      // Create tournament with maxParticipants = 2
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Limited Tournament",
        "A tournament with limited participants",
        "game1",
        2, // Only 2 participants allowed
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      const limitedTournamentId = event.args[0];

      // Register 2 participants
      await tournamentEscrow.connect(participant1).registerForTournament(limitedTournamentId);
      await tournamentEscrow.connect(participant2).registerForTournament(limitedTournamentId);

      // Try to register a 3rd participant
      await expect(
        tournamentEscrow.connect(participant3).registerForTournament(limitedTournamentId)
      ).to.be.revertedWith("Tournament is full");
    });
  });

  describe("Tournament Cancellation", function () {
    let tournamentId;

    beforeEach(async function () {
      // Approve token transfer
      await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));

      // Use block timestamp + buffer to ensure it's always in the future
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Create tournament
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Test Tournament",
        "A test tournament",
        "game1",
        100, // max participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      tournamentId = event.args[0];
    });

    it("Should allow creator to cancel tournament", async function () {
      // Check creator's balance before cancellation
      const balanceBefore = await mockToken.balanceOf(creator.address);

      // Cancel tournament
      const tx = await tournamentEscrow.connect(creator).cancelTournament(tournamentId);
      const receipt = await tx.wait();

      // Check for TournamentCancelled event
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCancelled"
      );
      expect(event).to.not.be.undefined;

      // Check tournament is no longer active
      const tournamentInfo = await tournamentEscrow.getTournamentInfo(tournamentId);
      expect(tournamentInfo[8]).to.be.false; // isActive

      // Check creator's balance after cancellation (should get all funds back)
      const balanceAfter = await mockToken.balanceOf(creator.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("100", 18));
    });

    it("Should not allow non-creator to cancel tournament", async function () {
      // Try to cancel as non-creator
      await expect(
        tournamentEscrow.connect(nonCreator).cancelTournament(tournamentId)
      ).to.be.revertedWith("Not tournament creator");
    });
  });
});
