const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentEscrow", function () {
  let tournamentEscrow;
  let mockToken;
  let owner;
  let creator;
  let winner;
  let nonCreator;

  beforeEach(async function () {
    // Get signers
    [owner, creator, winner, nonCreator] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK");

    // Deploy TournamentEscrow
    const TournamentEscrow = await ethers.getContractFactory("TournamentEscrow");
    tournamentEscrow = await TournamentEscrow.deploy();

    // Mint tokens to creator
    await mockToken.mint(creator.address, ethers.parseUnits("1000", 18));

    // Approve tokens for tournament creation
    await mockToken.connect(creator).approve(
      await tournamentEscrow.getAddress(),
      ethers.parseUnits("100", 18)
    );
  });

  describe("Tournament Creation", function () {
    it("Should create a tournament with ERC20 token rewards", async function () {
      const now = Math.floor(Date.now() / 1000);
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
        0, // single elimination
        100, // max participants
        registrationEndTime,
        startTime,
        await mockToken.getAddress(),
        positionRewardAmounts
      );

      // Wait for transaction to be mined
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

      // Check tournament details
      expect(tournamentInfo[0]).to.equal(creator.address); // creator
      expect(tournamentInfo[1]).to.equal("Test Tournament"); // name
      expect(tournamentInfo[2]).to.equal("A test tournament"); // description
      expect(tournamentInfo[3]).to.equal("game1"); // gameId
      expect(tournamentInfo[4]).to.equal(0); // tournamentType
      expect(tournamentInfo[9]).to.be.true; // isActive
      expect(tournamentInfo[10]).to.equal(await mockToken.getAddress()); // rewardTokenAddress
      expect(tournamentInfo[12]).to.equal(3); // positionCount

      // Check position reward amounts
      const rewardAmounts = await tournamentEscrow.getPositionRewardAmounts(tournamentId);
      expect(rewardAmounts.length).to.equal(3);
      expect(rewardAmounts[0]).to.equal(ethers.parseUnits("50", 18));
      expect(rewardAmounts[1]).to.equal(ethers.parseUnits("30", 18));
      expect(rewardAmounts[2]).to.equal(ethers.parseUnits("20", 18));
    });

    it("Should create a tournament with native token rewards", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      // Position reward amounts
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
        1, // double elimination
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

      // Get tournament info
      const tournamentInfo = await tournamentEscrow.getTournamentInfo(tournamentId);

      // Check tournament details
      expect(tournamentInfo[10]).to.equal(ethers.ZeroAddress); // rewardTokenAddress should be address(0)
      expect(tournamentInfo[11]).to.equal(totalReward); // totalRewardAmount
    });

    it("Should fail if no positions are provided", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      // Empty position reward amounts
      const positionRewardAmounts = [];

      // Should fail with "No positions provided"
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Invalid Tournament",
          "A tournament with no positions",
          "game3",
          0,
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts
        )
      ).to.be.revertedWith("No positions provided");
    });

    it("Should fail if token approval is insufficient", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      // Position reward amounts totaling more than approved
      const positionRewardAmounts = [
        ethers.parseUnits("500", 18),
        ethers.parseUnits("300", 18),
        ethers.parseUnits("200", 18)
      ];

      // Only approved 100 tokens earlier, but trying to use 1000
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Over Budget Tournament",
          "A tournament with insufficient token approval",
          "game4",
          0,
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts
        )
      ).to.be.reverted; // Will revert during token transfer
    });

    it("Should fail if sending native tokens with ERC20 tournament", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Trying to send native tokens with ERC20 tournament
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Invalid Payment Tournament",
          "A tournament with invalid payment",
          "game5",
          0,
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts,
          { value: ethers.parseUnits("1", 18) } // Incorrectly sending native tokens
        )
      ).to.be.revertedWith("Don't send RON with token tournaments");
    });

    it("Should fail if native token amount doesn't match reward total", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("1", 18),
        ethers.parseUnits("0.5", 18),
        ethers.parseUnits("0.25", 18)
      ];

      // Total should be 1.75 ETH, but only sending 1 ETH
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Underfunded Tournament",
          "A tournament with insufficient native tokens",
          "game6",
          0,
          100,
          registrationEndTime,
          startTime,
          ethers.ZeroAddress,
          positionRewardAmounts,
          { value: ethers.parseUnits("1", 18) } // Not enough native tokens
        )
      ).to.be.revertedWith("Incorrect reward amount sent");
    });
  });

  describe("Winner Declaration and Reward Claiming", function () {
    let tournamentId;

    beforeEach(async function () {
      // Create a tournament
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

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
    });

    it("Should allow creator to declare a winner", async function () {
      // Declare winner for first position (index 0)
      const tx = await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner.address
      );

      const receipt = await tx.wait();

      // Check for WinnerDeclared event
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "WinnerDeclared"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(tournamentId); // tournamentId
      expect(event.args[1]).to.equal(0); // position
      expect(event.args[2]).to.equal(winner.address); // winner address

      // Check position info
      const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      expect(positionInfo[1]).to.equal(winner.address); // winner
      expect(positionInfo[2]).to.be.false; // claimed (should be false initially)
    });

    it("Should not allow non-creator to declare a winner", async function () {
      // Try to declare winner as non-creator
      await expect(
        tournamentEscrow.connect(nonCreator).declareWinner(
          tournamentId,
          0,
          winner.address
        )
      ).to.be.revertedWith("Not tournament creator");
    });

    it("Should allow winner to claim reward", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner.address
      );

      // Check winner's balance before claiming
      const balanceBefore = await mockToken.balanceOf(winner.address);

      // Winner claims reward
      const tx = await tournamentEscrow.connect(winner).claimReward(
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
      const balanceAfter = await mockToken.balanceOf(winner.address);
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
        winner.address
      );

      // Claim reward
      await tournamentEscrow.connect(winner).claimReward(tournamentId, 0);

      // Try to claim again
      await expect(
        tournamentEscrow.connect(winner).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Position already claimed");
    });

    it("Should not allow claiming for invalid position", async function () {
      // Declare winner for position 0
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner.address
      );

      // Try to claim for invalid position (out of bounds)
      await expect(
        tournamentEscrow.connect(winner).claimReward(tournamentId, 10)
      ).to.be.revertedWith("Invalid position");
    });

    it("Should not allow non-winner to claim reward", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        winner.address
      );

      // Try to claim as non-winner
      await expect(
        tournamentEscrow.connect(nonCreator).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Not the winner");
    });

    it("Should allow declaring winners for multiple positions", async function () {
      // Declare winners for all positions
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 1, nonCreator.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 2, owner.address);

      // Check all positions
      const position0 = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      const position1 = await tournamentEscrow.getPositionInfo(tournamentId, 1);
      const position2 = await tournamentEscrow.getPositionInfo(tournamentId, 2);

      expect(position0[1]).to.equal(winner.address);
      expect(position1[1]).to.equal(nonCreator.address);
      expect(position2[1]).to.equal(owner.address);
    });

    it("Should not allow declaring winner for already claimed position", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner.address);

      // Winner claims reward
      await tournamentEscrow.connect(winner).claimReward(tournamentId, 0);

      // Try to declare a different winner for the same position
      await expect(
        tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, nonCreator.address)
      ).to.be.revertedWith("Position already claimed");
    });

    it("Should not allow claiming from inactive tournament", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner.address);

      // Cancel tournament
      await tournamentEscrow.connect(creator).cancelTournament(tournamentId);

      // Try to claim from cancelled tournament
      await expect(
        tournamentEscrow.connect(winner).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Tournament not active");
    });
  });

  describe("Tournament Cancellation", function () {
    let tournamentId;

    beforeEach(async function () {
      // Create a tournament
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

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
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 1, nonCreator.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 2, owner.address);

      // First winner claims their reward (50 tokens)
      await tournamentEscrow.connect(winner).claimReward(tournamentId, 0);

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
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 1, nonCreator.address);
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 2, owner.address);

      // All winners claim their rewards
      await tournamentEscrow.connect(winner).claimReward(tournamentId, 0);
      await tournamentEscrow.connect(nonCreator).claimReward(tournamentId, 1);
      await tournamentEscrow.connect(owner).claimReward(tournamentId, 2);

      // Check creator's balance before cancellation
      const balanceBefore = await mockToken.balanceOf(creator.address);

      // Cancel tournament
      await tournamentEscrow.connect(creator).cancelTournament(tournamentId);

      // Check creator's balance after cancellation
      const balanceAfter = await mockToken.balanceOf(creator.address);

      // Creator should get back 0 tokens (all positions claimed)
      expect(balanceAfter).to.equal(balanceBefore);
    });

    it("Should handle cancellation of tournament with native token rewards", async function () {
      // Create a tournament with native token rewards
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

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
      const nativeTournamentId = event.args[0];

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
        totalReward,
        ethers.parseUnits("0.01", 18) // Allow for small rounding errors
      );
    });
  });
});
