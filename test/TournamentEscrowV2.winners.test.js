const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentEscrowV2 - Winner Declaration and Rewards", function () {
  let tournamentEscrow;
  let mockToken;
  let owner;
  let creator;
  let winner1;
  let winner2;
  let winner3;
  let nonCreator;
  let tournamentId;

  beforeEach(async function () {
    // Get signers
    [owner, creator, winner1, winner2, winner3, nonCreator] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy TournamentEscrowV2
    const TournamentEscrow = await ethers.getContractFactory("TournamentEscrowV2");
    tournamentEscrow = await TournamentEscrow.deploy();
    await tournamentEscrow.waitForDeployment();

    // Mint tokens to creator
    await mockToken.mint(creator.address, ethers.parseUnits("1000", 18));

    // Approve tokens for tournament creation
    await mockToken.connect(creator).approve(
      await tournamentEscrow.getAddress(),
      ethers.parseUnits("100", 18)
    );

    // Get the current block timestamp
    const latestBlock = await ethers.provider.getBlock("latest");
    const currentTimestamp = latestBlock.timestamp;

    // Set the blockchain time to a value in the future
    const newTimestamp = currentTimestamp + 1000;
    await ethers.provider.send("evm_setNextBlockTimestamp", [newTimestamp]);
    await ethers.provider.send("evm_mine");

    // Create a tournament for testing
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
      100,
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

    // Advance time to start of tournament
    await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
    await ethers.provider.send("evm_mine");
  });

  describe("Winner Declaration", function () {
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
      expect(event.args[0]).to.equal(tournamentId); // tournamentId
      expect(event.args[1]).to.equal(0); // position
      expect(event.args[2]).to.equal(winner1.address); // winner address

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

    it("Should not allow non-creator to declare a winner", async function () {
      // Try to declare winner as non-creator
      await expect(
        tournamentEscrow.connect(nonCreator).declareWinner(
          tournamentId,
          0,
          winner1.address
        )
      ).to.be.revertedWith("Not tournament creator");
    });

    it("Should not allow declaring winner for invalid position", async function () {
      // Try to declare winner for invalid position
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          tournamentId,
          10, // Position 10 doesn't exist
          winner1.address
        )
      ).to.be.revertedWith("Invalid position");
    });

    it("Should not allow declaring winner with zero address", async function () {
      // Try to declare winner with zero address
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          tournamentId,
          0,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Winner cannot be zero address");
    });

    it("Should not allow declaring winner before tournament starts", async function () {
      // Create a new tournament
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Future Tournament",
        "A tournament that hasn't started yet",
        "game1",
        0,
        100,
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      const futureTournamentId = event.args[0];

      // Try to declare winner before tournament starts
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          futureTournamentId,
          0,
          winner1.address
        )
      ).to.be.revertedWith("Tournament has not started yet");
    });
  });

  describe("Reward Claiming", function () {
    beforeEach(async function () {
      // Declare winners for all positions
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner1.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 1, winner2.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 2, winner3.address);
    });

    it("Should allow winner to claim reward", async function () {
      // Check winner's balance before claiming
      const balanceBefore = await mockToken.balanceOf(winner1.address);

      // Winner claims reward
      const tx = await tournamentEscrow.connect(winner1).claimReward(
        tournamentId,
        0
      );

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
      // Claim reward
      await tournamentEscrow.connect(winner1).claimReward(tournamentId, 0);

      // Try to claim again
      await expect(
        tournamentEscrow.connect(winner1).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Position already claimed");
    });

    it("Should not allow non-winner to claim reward", async function () {
      // Try to claim as non-winner
      await expect(
        tournamentEscrow.connect(nonCreator).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Not the winner");
    });

    it("Should not allow claiming for invalid position", async function () {
      // Try to claim for invalid position
      await expect(
        tournamentEscrow.connect(winner1).claimReward(tournamentId, 10) // Position 10 doesn't exist
      ).to.be.revertedWith("Invalid position");
    });

    it("Should not allow claiming from inactive tournament", async function () {
      // Cancel tournament
      await tournamentEscrow.connect(creator).cancelTournament(tournamentId);

      // Try to claim from cancelled tournament
      await expect(
        tournamentEscrow.connect(winner1).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Tournament not active");
    });

    it("Should correctly identify winner positions", async function () {
      // Get winner position
      const position = await tournamentEscrow.getWinnerPosition(tournamentId, winner1.address);
      expect(position).to.equal(1); // 1-based position (1st place)

      // Check if winner has claimed reward
      const claimed = await tournamentEscrow.hasClaimedReward(tournamentId, winner1.address);
      expect(claimed).to.be.false;

      // Claim reward
      await tournamentEscrow.connect(winner1).claimReward(tournamentId, 0);

      // Check if winner has claimed reward now
      const claimedAfter = await tournamentEscrow.hasClaimedReward(tournamentId, winner1.address);
      expect(claimedAfter).to.be.true;
    });

    it("Should fail to get position for non-winner", async function () {
      // Try to get position for non-winner
      await expect(
        tournamentEscrow.getWinnerPosition(tournamentId, nonCreator.address)
      ).to.be.revertedWith("Address is not a winner");
    });
  });
});
