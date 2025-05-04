const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentEscrowV2 - Tournament Cancellation", function () {
  let tournamentEscrow;
  let mockToken;
  let owner;
  let creator;
  let winner1;
  let winner2;
  let winner3;
  let nonCreator;

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

  describe("Tournament Cancellation", function () {
    let tournamentId;

    beforeEach(async function () {
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
      expect(tournamentInfo[9]).to.be.false; // isActive

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

    it("Should not allow cancelling an already cancelled tournament", async function () {
      // Cancel tournament
      await tournamentEscrow.connect(creator).cancelTournament(tournamentId);

      // Try to cancel again
      await expect(
        tournamentEscrow.connect(creator).cancelTournament(tournamentId)
      ).to.be.revertedWith("Tournament not active");
    });

    it("Should return partial funds if some positions were already claimed", async function () {
      // Declare winners for all positions
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner1.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 1, winner2.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 2, winner3.address);

      // First winner claims their reward (50 tokens)
      await tournamentEscrow.connect(winner1).claimReward(tournamentId, 0);

      // Check creator's balance before cancellation
      const balanceBefore = await mockToken.balanceOf(creator.address);

      // Cancel tournament
      await tournamentEscrow.connect(creator).cancelTournament(tournamentId);

      // Check creator's balance after cancellation
      const balanceAfter = await mockToken.balanceOf(creator.address);

      // Creator should get back 50 tokens (30 + 20 = 50 tokens from unclaimed positions)
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseUnits("50", 18));
    });

    it("Should handle cancellation of tournament with no unclaimed rewards", async function () {
      // Declare winners for all positions
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner1.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 1, winner2.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 2, winner3.address);

      // All winners claim their rewards
      await tournamentEscrow.connect(winner1).claimReward(tournamentId, 0);
      await tournamentEscrow.connect(winner2).claimReward(tournamentId, 1);
      await tournamentEscrow.connect(winner3).claimReward(tournamentId, 2);

      // Check creator's balance before cancellation
      const balanceBefore = await mockToken.balanceOf(creator.address);

      // Cancel tournament
      await tournamentEscrow.connect(creator).cancelTournament(tournamentId);

      // Check creator's balance after cancellation
      const balanceAfter = await mockToken.balanceOf(creator.address);

      // Creator should get back 0 tokens (all positions claimed)
      expect(balanceAfter).to.equal(balanceBefore);
    });
  });

  describe("Native Token Tournament Cancellation", function () {
    let nativeTournamentId;

    beforeEach(async function () {
      // Get the current block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTimestamp = latestBlock.timestamp;

      // Set the blockchain time to a value in the future
      const newTimestamp = currentTimestamp + 1000;
      await ethers.provider.send("evm_setNextBlockTimestamp", [newTimestamp]);
      await ethers.provider.send("evm_mine");

      // Create a tournament with native token rewards
      const registrationEndTime = newTimestamp + 3600; // 1 hour in the future
      const startTime = newTimestamp + 7200; // 2 hours in the future

      const positionRewardAmounts = [
        ethers.parseUnits("1", 18),
        ethers.parseUnits("0.5", 18),
        ethers.parseUnits("0.25", 18)
      ];

      const totalReward = ethers.parseUnits("1.75", 18);

      // Create tournament with native token
      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Native Token Tournament",
        "A tournament with native token rewards",
        "game7",
        0,
        100,
        registrationEndTime,
        startTime,
        ethers.ZeroAddress,
        positionRewardAmounts,
        { value: totalReward }
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TournamentCreated"
      );
      nativeTournamentId = event.args[0];

      // Advance time to start of tournament
      await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
      await ethers.provider.send("evm_mine");
    });

    it("Should handle cancellation of tournament with native token rewards", async function () {
      // Check creator's balance before cancellation
      const balanceBefore = await ethers.provider.getBalance(creator.address);

      // Cancel tournament
      const cancelTx = await tournamentEscrow.connect(creator).cancelTournament(nativeTournamentId);
      const cancelReceipt = await cancelTx.wait();

      // Calculate gas cost
      const gasCost = cancelReceipt.gasUsed * cancelReceipt.gasPrice;

      // Check creator's balance after cancellation
      const balanceAfter = await ethers.provider.getBalance(creator.address);

      // Creator should get back 1.75 ETH minus gas costs
      expect(balanceAfter + gasCost - balanceBefore).to.be.closeTo(
        ethers.parseUnits("1.75", 18),
        ethers.parseUnits("0.01", 18) // Allow for small rounding errors
      );
    });

    it("Should handle partial refund with native tokens", async function () {
      // Declare winners for all positions
      await tournamentEscrow.connect(creator).declareWinner(nativeTournamentId, 0, winner1.address);
      await tournamentEscrow.connect(creator).declareWinner(nativeTournamentId, 1, winner2.address);
      await tournamentEscrow.connect(creator).declareWinner(nativeTournamentId, 2, winner3.address);

      // First winner claims their reward (1 ETH)
      await tournamentEscrow.connect(winner1).claimReward(nativeTournamentId, 0);

      // Check creator's balance before cancellation
      const balanceBefore = await ethers.provider.getBalance(creator.address);

      // Cancel tournament
      const cancelTx = await tournamentEscrow.connect(creator).cancelTournament(nativeTournamentId);
      const cancelReceipt = await cancelTx.wait();

      // Calculate gas cost
      const gasCost = cancelReceipt.gasUsed * cancelReceipt.gasPrice;

      // Check creator's balance after cancellation
      const balanceAfter = await ethers.provider.getBalance(creator.address);

      // Creator should get back 0.75 ETH (0.5 + 0.25) minus gas costs
      expect(balanceAfter + gasCost - balanceBefore).to.be.closeTo(
        ethers.parseUnits("0.75", 18),
        ethers.parseUnits("0.01", 18) // Allow for small rounding errors
      );
    });
  });
});
