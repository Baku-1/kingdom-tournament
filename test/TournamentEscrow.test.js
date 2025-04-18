const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = ethers;

describe("TournamentEscrow", function () {
  let TournamentEscrow;
  let tournamentEscrow;
  let owner;
  let creator;
  let participant1;
  let participant2;
  let participant3;
  let participant4;
  let mockToken;

  beforeEach(async function () {
    // Get signers
    [owner, creator, participant1, participant2, participant3, participant4] = await ethers.getSigners();

    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Mint tokens to creator and participants
    await mockToken.mint(creator.address, parseEther("1000"));
    await mockToken.mint(participant1.address, parseEther("100"));
    await mockToken.mint(participant2.address, parseEther("100"));
    await mockToken.mint(participant3.address, parseEther("100"));
    await mockToken.mint(participant4.address, parseEther("100"));

    // Deploy TournamentEscrow contract
    TournamentEscrow = await ethers.getContractFactory("TournamentEscrow");
    tournamentEscrow = await TournamentEscrow.deploy();
    await tournamentEscrow.waitForDeployment();
  });

  describe("Tournament Creation", function () {
    it("Should create a tournament with token rewards", async function () {
      // Approve token transfer
      await mockToken.connect(creator).approve(tournamentEscrow.address, parseEther("100"));

      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600; // 1 hour from now
      const startTime = now + 7200; // 2 hours from now

      // Position reward amounts (50% to 1st, 30% to 2nd, 15% to 3rd, 5% to 4th)
      const positionRewardAmounts = [
        parseEther("50"),
        parseEther("30"),
        parseEther("15"),
        parseEther("5")
      ];

      // Create tournament
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Test Tournament",
          "A test tournament",
          "game1",
          0, // single elimination
          0, // no fixed max participants
          registrationEndTime,
          startTime,
          mockToken.address,
          positionRewardAmounts
        )
      ).to.emit(tournamentEscrow, "TournamentCreated");

      // Check tournament details
      const tournament = await tournamentEscrow.tournaments(1);
      expect(tournament.name).to.equal("Test Tournament");
      expect(tournament.creator).to.equal(creator.address);
      expect(tournament.rewardTokenAddress).to.equal(mockToken.address);
      expect(tournament.totalRewardAmount).to.equal(ethers.utils.parseEther("100"));
    });

    it("Should fail if reward token approval is insufficient", async function () {
      // Approve less than required
      await mockToken.connect(creator).approve(tournamentEscrow.address, parseEther("50"));

      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        parseEther("50"),
        parseEther("30"),
        parseEther("15"),
        parseEther("5")
      ];

      // Should fail due to insufficient approval
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Test Tournament",
          "A test tournament",
          "game1",
          0,
          0,
          registrationEndTime,
          startTime,
          mockToken.address,
          positionRewardAmounts
        )
      ).to.be.reverted;
    });
  });

  // Skipping Tournament Registration tests as the contract doesn't have registration functionality yet
  describe.skip("Tournament Registration", function () {
    // Tests will be implemented when registration functionality is added to the contract
  });

  describe("Winner Declaration and Reward Distribution", function () {
    let tournamentId;

    beforeEach(async function () {
      // Create tournament
      await mockToken.connect(creator).approve(tournamentEscrow.address, parseEther("100"));

      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        parseEther("50"),
        parseEther("30"),
        parseEther("15"),
        parseEther("5")
      ];

      const tx = await tournamentEscrow.connect(creator).createTournament(
        "Test Tournament",
        "A test tournament",
        "game1",
        0,
        0,
        registrationEndTime,
        startTime,
        mockToken.address,
        positionRewardAmounts
      );

      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "TournamentCreated");
      tournamentId = event.args.tournamentId;

      // Advance time to start
      await ethers.provider.send("evm_increaseTime", [7201]); // 2 hours + 1 second
      await ethers.provider.send("evm_mine");
    });

    it("Should allow creator to declare winner", async function () {
      // Declare winner for position 0 (first place)
      await expect(
        tournamentEscrow.connect(creator).declareWinner(
          tournamentId,
          0,
          participant1.address
        )
      ).to.emit(tournamentEscrow, "WinnerDeclared");

      // Get position info
      const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      expect(positionInfo.winner).to.equal(participant1.address);
      expect(positionInfo.claimed).to.be.false;
    });

    it("Should only allow creator to declare winner", async function () {
      // Try to declare winner as non-creator
      await expect(
        tournamentEscrow.connect(participant1).declareWinner(
          tournamentId,
          0,
          participant1.address
        )
      ).to.be.revertedWith("Not tournament creator");
    });

    it("Should allow winner to claim reward", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        participant1.address
      );

      // Check balances before claiming
      const balanceBefore = await mockToken.balanceOf(participant1.address);

      // Claim reward
      await expect(
        tournamentEscrow.connect(participant1).claimReward(tournamentId, 0)
      ).to.emit(tournamentEscrow, "RewardClaimed");

      // Check balance after claiming
      const balanceAfter = await mockToken.balanceOf(participant1.address);
      expect(balanceAfter - balanceBefore).to.equal(parseEther("50"));

      // Check that reward is marked as claimed
      const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, 0);
      expect(positionInfo.claimed).to.be.true;
    });

    it("Should not allow claiming reward twice", async function () {
      // Declare winner
      await tournamentEscrow.connect(creator).declareWinner(
        tournamentId,
        0,
        participant1.address
      );

      // Claim reward
      await tournamentEscrow.connect(participant1).claimReward(tournamentId, 0);

      // Try to claim again
      await expect(
        tournamentEscrow.connect(participant1).claimReward(tournamentId, 0)
      ).to.be.revertedWith("Position already claimed");
    });
  });

  // Skipping Entry Fees tests as the contract doesn't have entry fee functionality yet
  describe.skip("Entry Fees", function () {
    // Tests will be implemented when entry fee functionality is added to the contract
  });
});
