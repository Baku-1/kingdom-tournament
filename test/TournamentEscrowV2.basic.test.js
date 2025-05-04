const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentEscrowV2 - Basic Functionality", function () {
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

    it("Should fail if name is empty", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

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
          0,
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts
        )
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should fail if tournament type is invalid", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 3600;
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Try to create tournament with invalid tournament type
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Invalid Type Tournament",
          "A test tournament",
          "game1",
          2, // Invalid type (only 0 and 1 are valid)
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts
        )
      ).to.be.revertedWith("Invalid tournament type");
    });

    it("Should fail if registration end time is in the past", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now - 3600; // 1 hour in the past
      const startTime = now + 7200;

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Try to create tournament with past registration end time
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Past Registration Tournament",
          "A test tournament",
          "game1",
          0,
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts
        )
      ).to.be.revertedWith("Registration end time must be in the future");
    });

    it("Should fail if start time is before registration end time", async function () {
      const now = Math.floor(Date.now() / 1000);
      const registrationEndTime = now + 7200; // 2 hours in the future
      const startTime = now + 3600; // 1 hour in the future (before registration ends)

      const positionRewardAmounts = [
        ethers.parseUnits("50", 18),
        ethers.parseUnits("30", 18),
        ethers.parseUnits("20", 18)
      ];

      // Try to create tournament with start time before registration end time
      await expect(
        tournamentEscrow.connect(creator).createTournament(
          "Invalid Timing Tournament",
          "A test tournament",
          "game1",
          0,
          100,
          registrationEndTime,
          startTime,
          await mockToken.getAddress(),
          positionRewardAmounts
        )
      ).to.be.revertedWith("Start time must be after registration end time");
    });
  });

  describe("Tournament Info Retrieval", function () {
    let tournamentId;

    beforeEach(async function () {
      // Create a tournament for testing
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

    it("Should retrieve tournament info correctly", async function () {
      const tournamentInfo = await tournamentEscrow.getTournamentInfo(tournamentId);

      expect(tournamentInfo[0]).to.equal(creator.address); // creator
      expect(tournamentInfo[1]).to.equal("Test Tournament"); // name
      expect(tournamentInfo[2]).to.equal("A test tournament"); // description
      expect(tournamentInfo[3]).to.equal("game1"); // gameId
      expect(tournamentInfo[4]).to.equal(0); // tournamentType
      expect(tournamentInfo[5]).to.equal(100); // maxParticipants
      expect(tournamentInfo[9]).to.be.true; // isActive
      expect(tournamentInfo[10]).to.equal(await mockToken.getAddress()); // rewardTokenAddress
      expect(tournamentInfo[12]).to.equal(3); // positionCount
      expect(tournamentInfo[13]).to.be.false; // hasEntryFee
      expect(tournamentInfo[16]).to.equal(0); // participantCount
    });

    it("Should retrieve position info correctly", async function () {
      // Advance time to start of tournament
      await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
      await ethers.provider.send("evm_mine");

      // Declare a winner for position 0
      await tournamentEscrow.connect(creator).declareWinner(tournamentId, 0, winner.address);

      const positionInfo = await tournamentEscrow.getPositionInfo(tournamentId, 0);

      expect(positionInfo[0]).to.equal(ethers.parseUnits("50", 18)); // rewardAmount
      expect(positionInfo[1]).to.equal(winner.address); // winner
      expect(positionInfo[2]).to.be.false; // claimed (should be false initially)
    });

    it("Should fail to retrieve info for non-existent tournament", async function () {
      const nonExistentTournamentId = 9999;

      await expect(
        tournamentEscrow.getTournamentInfo(nonExistentTournamentId)
      ).to.be.revertedWith("Tournament does not exist");
    });
  });
});
