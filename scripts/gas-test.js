const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Running gas usage tests for TournamentEscrowV2...");
  
  // Get signers
  const [deployer, creator, participant1, participant2, winner1] = await ethers.getSigners();
  
  // Deploy mock ERC20 token for testing
  console.log("Deploying mock token...");
  const MockToken = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockToken.deploy("Mock Token", "MTK");
  await mockToken.waitForDeployment();
  console.log(`Mock token deployed to: ${await mockToken.getAddress()}`);
  
  // Mint tokens to creator and participants
  await mockToken.mint(creator.address, ethers.parseUnits("1000", 18));
  await mockToken.mint(participant1.address, ethers.parseUnits("100", 18));
  await mockToken.mint(participant2.address, ethers.parseUnits("100", 18));
  
  // Deploy TournamentEscrowV2 contract
  console.log("Deploying TournamentEscrowV2...");
  const TournamentEscrow = await ethers.getContractFactory("TournamentEscrowV2");
  const tournamentEscrow = await upgrades.deployProxy(TournamentEscrow, [], { 
    initializer: 'initialize',
    kind: 'uups'
  });
  await tournamentEscrow.waitForDeployment();
  console.log(`TournamentEscrowV2 deployed to: ${await tournamentEscrow.getAddress()}`);
  
  // Prepare tournament parameters
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
  
  // Test 1: Create Tournament
  console.log("\n--- Test 1: Create Tournament ---");
  const createTx = await tournamentEscrow.connect(creator).createTournament(
    "Test Tournament",
    "A test tournament",
    "game1",
    100, // max participants
    registrationEndTime,
    startTime,
    await mockToken.getAddress(),
    positionRewardAmounts
  );
  
  const createReceipt = await createTx.wait();
  console.log(`Gas used for tournament creation: ${createReceipt.gasUsed.toString()}`);
  
  // Get tournament ID from event
  const createEvent = createReceipt.logs.find(
    log => log.fragment && log.fragment.name === "TournamentCreated"
  );
  const tournamentId = createEvent.args[0];
  console.log(`Tournament created with ID: ${tournamentId}`);
  
  // Test 2: Register for Tournament
  console.log("\n--- Test 2: Register for Tournament ---");
  const registerTx = await tournamentEscrow.connect(participant1).registerForTournament(tournamentId);
  const registerReceipt = await registerTx.wait();
  console.log(`Gas used for tournament registration: ${registerReceipt.gasUsed.toString()}`);
  
  // Test 3: Create Tournament with Entry Fee
  console.log("\n--- Test 3: Create Tournament with Entry Fee ---");
  
  // Approve token transfer for entry fee
  await mockToken.connect(creator).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("100", 18));
  
  const createWithFeeTx = await tournamentEscrow.connect(creator).createTournamentWithEntryFee(
    "Entry Fee Tournament",
    "A tournament with entry fee",
    "game1",
    100, // max participants
    registrationEndTime,
    startTime,
    await mockToken.getAddress(), // reward token
    positionRewardAmounts,
    await mockToken.getAddress(), // entry fee token
    ethers.parseUnits("10", 18) // entry fee amount
  );
  
  const createWithFeeReceipt = await createWithFeeTx.wait();
  console.log(`Gas used for tournament creation with entry fee: ${createWithFeeReceipt.gasUsed.toString()}`);
  
  // Get tournament ID from event
  const createWithFeeEvent = createWithFeeReceipt.logs.find(
    log => log.fragment && log.fragment.name === "TournamentCreated"
  );
  const tournamentWithFeeId = createWithFeeEvent.args[0];
  console.log(`Tournament with entry fee created with ID: ${tournamentWithFeeId}`);
  
  // Test 4: Register with Entry Fee
  console.log("\n--- Test 4: Register with Entry Fee ---");
  
  // Approve token transfer for entry fee
  await mockToken.connect(participant2).approve(await tournamentEscrow.getAddress(), ethers.parseUnits("10", 18));
  
  const registerWithFeeTx = await tournamentEscrow.connect(participant2).registerWithEntryFee(tournamentWithFeeId);
  const registerWithFeeReceipt = await registerWithFeeTx.wait();
  console.log(`Gas used for tournament registration with entry fee: ${registerWithFeeReceipt.gasUsed.toString()}`);
  
  // Advance time to start of tournament
  await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
  await ethers.provider.send("evm_mine");
  
  // Test 5: Declare Winner
  console.log("\n--- Test 5: Declare Winner ---");
  const declareWinnerTx = await tournamentEscrow.connect(creator).declareWinner(
    tournamentId,
    0,
    participant1.address
  );
  
  const declareWinnerReceipt = await declareWinnerTx.wait();
  console.log(`Gas used for declaring winner: ${declareWinnerReceipt.gasUsed.toString()}`);
  
  // Test 6: Claim Reward
  console.log("\n--- Test 6: Claim Reward ---");
  const claimRewardTx = await tournamentEscrow.connect(participant1).claimReward(tournamentId, 0);
  const claimRewardReceipt = await claimRewardTx.wait();
  console.log(`Gas used for claiming reward: ${claimRewardReceipt.gasUsed.toString()}`);
  
  // Test 7: Cancel Tournament
  console.log("\n--- Test 7: Cancel Tournament ---");
  const cancelTx = await tournamentEscrow.connect(creator).cancelTournament(tournamentWithFeeId);
  const cancelReceipt = await cancelTx.wait();
  console.log(`Gas used for cancelling tournament: ${cancelReceipt.gasUsed.toString()}`);
  
  // Summary
  console.log("\n--- Gas Usage Summary ---");
  console.log(`Tournament Creation: ${createReceipt.gasUsed.toString()} gas`);
  console.log(`Tournament Registration: ${registerReceipt.gasUsed.toString()} gas`);
  console.log(`Tournament Creation with Entry Fee: ${createWithFeeReceipt.gasUsed.toString()} gas`);
  console.log(`Tournament Registration with Entry Fee: ${registerWithFeeReceipt.gasUsed.toString()} gas`);
  console.log(`Declare Winner: ${declareWinnerReceipt.gasUsed.toString()} gas`);
  console.log(`Claim Reward: ${claimRewardReceipt.gasUsed.toString()} gas`);
  console.log(`Cancel Tournament: ${cancelReceipt.gasUsed.toString()} gas`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Gas test failed:", error);
    process.exit(1);
  });
