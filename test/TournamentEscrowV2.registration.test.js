const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentEscrowV2 - Registration and Entry Fees", function () {
  let tournamentEscrow;
  let mockToken;
  let owner;
  let creator;
  let participant1;
  let participant2;
  let participant3;
  let nonCreator;

  beforeEach(async function () {
    // Get signers
    [owner, creator, participant1, participant2, participant3, nonCreator] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy TournamentEscrowV2
    const TournamentEscrow = await ethers.getContractFactory("TournamentEscrowV2");
    tournamentEscrow = await TournamentEscrow.deploy();
    await tournamentEscrow.waitForDeployment();

    // Mint tokens to creator and participants
    await mockToken.mint(creator.address, ethers.parseUnits("1000", 18));
    await mockToken.mint(participant1.address, ethers.parseUnits("100", 18));
    await mockToken.mint(participant2.address, ethers.parseUnits("100", 18));
    await mockToken.mint(participant3.address, ethers.parseUnits("100", 18));

    // Approve tokens for tournament creation
    await mockToken.connect(creator).approve(
      await tournamentEscrow.getAddress(),
      ethers.parseUnits("1000", 18)
    );

    // Get the current block timestamp
    const latestBlock = await ethers.provider.getBlock("latest");
    const currentTimestamp = latestBlock.timestamp;

    // Set the blockchain time to a value in the future
    const newTimestamp = currentTimestamp + 1000;
    await ethers.provider.send("evm_setNextBlockTimestamp", [newTimestamp]);
    await ethers.provider.send("evm_mine");
  });

  describe("Tournament Registration (No Entry Fee)", function () {
    let tournamentId;

    beforeEach(async function () {
      // Get the current block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTimestamp = latestBlock.timestamp;

      // Set the blockchain time to a value in the future
      const newTimestamp = currentTimestamp + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [newTimestamp]);
      await ethers.provider.send("evm_mine");

      // Create a tournament for testing registration
      const registrationEndTime = newTimestamp + 3600; // 1 hour in the future
      const startTime = newTimestamp + 7200; // 2 hours in the future

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Test Tournament",
        "A test tournament",
        "game1",
        0,
        10, // max 10 participants
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
      await expect(
        tournamentEscrow.connect(participant1).registerForTournament(tournamentId)
      ).to.emit(tournamentEscrow, "ParticipantRegistered");

      await expect(
        tournamentEscrow.connect(participant2).registerForTournament(tournamentId)
      ).to.emit(tournamentEscrow, "ParticipantRegistered");

      // Check participant count
      const tournamentInfo = await tournamentEscrow.getTournamentInfo(tournamentId);
      expect(tournamentInfo[16]).to.equal(2); // participantCount

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
      // Advance time past registration end
      await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
      await ethers.provider.send("evm_mine");

      // Try to register
      await expect(
        tournamentEscrow.connect(participant1).registerForTournament(tournamentId)
      ).to.be.revertedWith("Registration period ended");
    });

    it("Should enforce max participants limit", async function () {
      // Create a tournament with small max participants
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Small Tournament",
        "A tournament with few spots",
        "game1",
        0,
        2, // max 2 participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      const smallTournamentId = event.args[0];

      // Register 2 participants
      await tournamentEscrow.connect(participant1).registerForTournament(smallTournamentId);
      await tournamentEscrow.connect(participant2).registerForTournament(smallTournamentId);

      // Try to register a 3rd participant
      await expect(
        tournamentEscrow.connect(participant3).registerForTournament(smallTournamentId)
      ).to.be.revertedWith("Tournament is full");
    });

    it("Should allow unlimited participants when max is 0", async function () {
      // Create a tournament with unlimited participants
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Unlimited Tournament",
        "A tournament with unlimited spots",
        "game1",
        0,
        0, // unlimited participants
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

      // Check participant count
      const tournamentInfo = await tournamentEscrow.getTournamentInfo(unlimitedTournamentId);
      expect(tournamentInfo[16]).to.equal(3); // participantCount
    });
  });

  describe("Tournament with Entry Fee", function () {
    let tournamentId;

    beforeEach(async function () {
      // Get the current block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTimestamp = latestBlock.timestamp;

      // Set the blockchain time to a value in the future
      const newTimestamp = currentTimestamp + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [newTimestamp]);
      await ethers.provider.send("evm_mine");

      // Create a tournament with entry fee
      const registrationEndTime = newTimestamp + 3600; // 1 hour in the future
      const startTime = newTimestamp + 7200; // 2 hours in the future

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Create tournament with entry fee
      const tx = await tournamentEscrow.connect(creator).createTournamentWithEntryFee(
        "Entry Fee Tournament",
        "A tournament with entry fee",
        "game1",
        0,
        10,
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts,
        await mockToken.getAddress(),
        ethers.parseUnits("10", 18) // 10 tokens entry fee
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      tournamentId = event.args[0];

      // Approve entry fee for participants
      await mockToken.connect(participant1).approve(
        await tournamentEscrow.getAddress(),
        ethers.parseUnits("10", 18)
      );

      await mockToken.connect(participant2).approve(
        await tournamentEscrow.getAddress(),
        ethers.parseUnits("10", 18)
      );

      await mockToken.connect(participant3).approve(
        await tournamentEscrow.getAddress(),
        ethers.parseUnits("10", 18)
      );
    });

    it("Should require entry fee for registration", async function () {
      // Register with entry fee
      await expect(
        tournamentEscrow.connect(participant1).registerWithEntryFee(tournamentId)
      ).to.emit(tournamentEscrow, "ParticipantRegistered");

      // Check participant is registered
      expect(await tournamentEscrow.isParticipantRegistered(tournamentId, participant1.address)).to.be.true;

      // Check participant's token balance decreased
      const balance = await mockToken.balanceOf(participant1.address);
      expect(balance).to.equal(ethers.parseUnits("90", 18)); // 100 - 10 = 90
    });

    it("Should fail registration without entry fee approval", async function () {
      // Create a new participant without approval
      const noApprovalParticipant = nonCreator;

      // Try to register without approving entry fee
      await expect(
        tournamentEscrow.connect(noApprovalParticipant).registerWithEntryFee(tournamentId)
      ).to.be.reverted;
    });

    it("Should distribute entry fees correctly", async function () {
      // Register multiple participants
      await tournamentEscrow.connect(participant1).registerWithEntryFee(tournamentId);
      await tournamentEscrow.connect(participant2).registerWithEntryFee(tournamentId);
      await tournamentEscrow.connect(participant3).registerWithEntryFee(tournamentId);

      // Check creator's fee balance before claiming
      const creatorBalanceBefore = await mockToken.balanceOf(creator.address);

      // Creator claims entry fees
      await expect(
        tournamentEscrow.connect(creator).claimEntryFees(tournamentId)
      ).to.emit(tournamentEscrow, "EntryFeesCollected");

      // Check creator's balance after claiming
      const creatorBalanceAfter = await mockToken.balanceOf(creator.address);

      // Creator should receive 97.5% of total entry fees (3 participants * 10 tokens * 0.975)
      const expectedCreatorFees = ethers.parseUnits("29.25", 18); // 30 * 0.975 = 29.25
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(expectedCreatorFees);

      // Check platform fee balance
      const platformFees = await tournamentEscrow.platformFees(await mockToken.getAddress());
      expect(platformFees).to.equal(ethers.parseUnits("0.75", 18)); // 30 * 0.025 = 0.75
    });

    it("Should allow owner to withdraw platform fees", async function () {
      // Register participants
      await tournamentEscrow.connect(participant1).registerWithEntryFee(tournamentId);
      await tournamentEscrow.connect(participant2).registerWithEntryFee(tournamentId);

      // Creator claims entry fees
      await tournamentEscrow.connect(creator).claimEntryFees(tournamentId);

      // Check owner's balance before withdrawal
      const ownerBalanceBefore = await mockToken.balanceOf(owner.address);

      // Owner withdraws platform fees
      await expect(
        tournamentEscrow.connect(owner).withdrawPlatformFees(await mockToken.getAddress())
      ).to.emit(tournamentEscrow, "PlatformFeesWithdrawn");

      // Check owner's balance after withdrawal
      const ownerBalanceAfter = await mockToken.balanceOf(owner.address);

      // Owner should receive platform fees (2 participants * 10 tokens * 0.025)
      const expectedPlatformFees = ethers.parseUnits("0.5", 18); // 20 * 0.025 = 0.5
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(expectedPlatformFees);

      // Platform fees should be reset to 0
      const platformFees = await tournamentEscrow.platformFees(await mockToken.getAddress());
      expect(platformFees).to.equal(0);
    });

    it("Should not allow non-owner to withdraw platform fees", async function () {
      // Register a participant
      await tournamentEscrow.connect(participant1).registerWithEntryFee(tournamentId);

      // Creator claims entry fees
      await tournamentEscrow.connect(creator).claimEntryFees(tournamentId);

      // Try to withdraw platform fees as non-owner
      await expect(
        tournamentEscrow.connect(nonCreator).withdrawPlatformFees(await mockToken.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow using registerForTournament for entry fee tournaments", async function () {
      // Try to use regular registration for entry fee tournament
      await expect(
        tournamentEscrow.connect(participant1).registerForTournament(tournamentId)
      ).to.be.revertedWith("Tournament requires entry fee");
    });

    it("Should not allow using registerWithEntryFee for non-entry fee tournaments", async function () {
      // Create a tournament without entry fee
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Regular Tournament",
        "A tournament without entry fee",
        "game1",
        0,
        10,
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      const regularTournamentId = event.args[0];

      // Try to use entry fee registration for regular tournament
      await expect(
        tournamentEscrow.connect(participant1).registerWithEntryFee(regularTournamentId)
      ).to.be.revertedWith("Tournament does not have entry fee");
    });
  });
});
