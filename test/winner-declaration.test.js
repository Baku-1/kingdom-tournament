const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Tournament Winner Declaration and Reward Disbursement", function () {
  let tournamentEscrow;
  let mockToken;
  let creator;
  let participant1;
  let participant2;
  let participant3;
  let participant4;
  let tournamentId;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const parseEther = ethers.parseUnits;

  beforeEach(async function () {
    // Get signers
    [creator, participant1, participant2, participant3, participant4] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.waitForDeployment();

    // Deploy tournament escrow contract
    const TournamentEscrow = await ethers.getContractFactory("TournamentEscrow");
    tournamentEscrow = await TournamentEscrow.deploy();
    await tournamentEscrow.waitForDeployment();

    // Mint tokens to creator
    await mockToken.mint(creator.address, parseEther("1000"));

    // Approve tokens for tournament creation
    await mockToken.approve(await tournamentEscrow.getAddress(), parseEther("1000"));

    // Create a tournament with 4 positions
    const now = Math.floor(Date.now() / 1000);
    const registrationEndTime = now + 3600; // 1 hour from now
    const startTime = now + 7200; // 2 hours from now

    const positionRewardAmounts = [
      parseEther("50"), // 1st place: 50 tokens
      parseEther("30"), // 2nd place: 30 tokens
      parseEther("15"), // 3rd place: 15 tokens
      parseEther("5")   // 4th place: 5 tokens
    ];

    const tx = await tournamentEscrow.createTournament(
      "Test Tournament",
      "Tournament for testing winner declaration",
      "test-game",
      0, // Single elimination
      8, // Max participants
      registrationEndTime,
      startTime,
      await mockToken.getAddress(),
      positionRewardAmounts
    );

    const receipt = await tx.wait();
    const event = receipt.logs.find(log => {
      try {
        const parsedLog = tournamentEscrow.interface.parseLog(log);
        return parsedLog?.name === "TournamentCreated";
      } catch (e) {
        return false;
      }
    });

    const parsedEvent = event ? tournamentEscrow.interface.parseLog(event) : null;
    tournamentId = parsedEvent?.args?.tournamentId;

    // Advance time to start
    await ethers.provider.send("evm_increaseTime", [7201]); // 2 hours + 1 second
    await ethers.provider.send("evm_mine");
  });

  describe("Winner Declaration", function () {
    it("Should allow creator to declare winners", async function () {
      // Declare winner for position 0 (first place)
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          tournamentId,
          0,
          participant1.address
        )
      ).to.emit(tournamentEscrow, "WinnerDeclared")
        .withArgs(tournamentId, 0, participant1.address);

      // Declare winner for position 1 (second place)
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          tournamentId,
          1,
          participant2.address
        )
      ).to.emit(tournamentEscrow, "WinnerDeclared")
        .withArgs(tournamentId, 1, participant2.address);

      // Get position info
      const position0Info = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      const position1Info = await tournamentEscrow.getPositionInfo(tournamentId, 1);

      expect(position0Info[1]).to.equal(participant1.address); // winner
      expect(position0Info[2]).to.be.false; // claimed
      expect(position1Info[1]).to.equal(participant2.address); // winner
      expect(position1Info[2]).to.be.false; // claimed
    });

    it("Should not allow non-creator to declare winners", async function () {
      await expect(
        tournamentEscrow.connect(participant1).declareWinner(
          tournamentId,
          0,
          participant1.address
        )
      ).to.be.revertedWith("Not tournament creator");
    });

    it("Should not allow declaring winner for invalid position", async function () {
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          tournamentId,
          10, // Invalid position
          participant1.address
        )
      ).to.be.revertedWith("Invalid position");
    });
  });

  describe("Reward Claiming", function () {
    beforeEach(async function () {
      // Declare winners for all positions
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, participant1.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 1, participant2.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 2, participant3.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 3, participant4.address);
    });

    it("Should allow winners to claim their rewards", async function () {
      // Check balances before claiming
      const p1BalanceBefore = await mockToken.balanceOf(participant1.address);
      const p2BalanceBefore = await mockToken.balanceOf(participant2.address);

      // Claim rewards
      await expect(
        tournamentEscrow.connect(participant1).claimReward(tournamentId, 0)
      ).to.emit(tournamentEscrow, "RewardClaimed")
        .withArgs(tournamentId, 0, participant1.address, parseEther("50"));

      await expect(
        tournamentEscrow.connect(participant2).claimReward(tournamentId, 1)
      ).to.emit(tournamentEscrow, "RewardClaimed")
        .withArgs(tournamentId, 1, participant2.address, parseEther("30"));

      // Check balances after claiming
      const p1BalanceAfter = await mockToken.balanceOf(participant1.address);
      const p2BalanceAfter = await mockToken.balanceOf(participant2.address);

      expect(p1BalanceAfter - p1BalanceBefore).to.equal(parseEther("50"));
      expect(p2BalanceAfter - p2BalanceBefore).to.equal(parseEther("30"));

      // Check that positions are marked as claimed
      const position0Info = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      const position1Info = await tournamentEscrow.getPositionInfo(tournamentId, 1);

      expect(position0Info[2]).to.be.true; // claimed
      expect(position1Info[2]).to.be.true; // claimed
    });

    it("Should not allow non-winners to claim rewards", async function () {
      await expect(
        tournamentEscrow.connect(participant2).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Not the winner");
    });

    it("Should not allow claiming rewards twice", async function () {
      // Claim reward
      await tournamentEscrow.connect(participant1).claimReward(tournamentId, 0);

      // Try to claim again
      await expect(
        tournamentEscrow.connect(participant1).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Position already claimed");
    });
  });

  describe("Batch Winner Declaration", function () {
    it("Should allow declaring multiple winners at once if supported", async function () {
      // Skip this test if the contract doesn't support batch declaration
      try {
        const hasFunction = await tournamentEscrow.declareWinners ? true : false;
        if (!hasFunction) {
          this.skip();
          return;
        }
      } catch (e) {
        this.skip();
        return;
      }

      // Declare multiple winners
      const positions = [0, 1, 2, 3];
      const winners = [
        participant1.address,
        participant2.address,
        participant3.address,
        participant4.address
      ];

      await tournamentEscrow.connect(creator).declareWinners(
        tournamentId,
        positions,
        winners
      );

      // Check each position
      for (let i = 0; i < positions.length; i++) {
        const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, positions[i]);
        expect(positionInfo[1]).to.equal(winners[i]); // winner
      }
    });
  });
});
