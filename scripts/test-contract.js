const hre = require("hardhat");

async function main() {
  console.log("Testing TournamentEscrowV2 contract...");

  // Deploy MockERC20
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy("Mock Token", "MTK");
  await mockToken.waitForDeployment();
  console.log(`MockERC20 deployed to: ${await mockToken.getAddress()}`);

  // Deploy TournamentEscrowV2
  const TournamentEscrow = await hre.ethers.getContractFactory("TournamentEscrowV2");
  const tournamentEscrow = await TournamentEscrow.deploy();
  await tournamentEscrow.waitForDeployment();
  console.log(`TournamentEscrowV2 deployed to: ${await tournamentEscrow.getAddress()}`);

  // Get signers
  const [owner, creator, winner] = await hre.ethers.getSigners();
  console.log(`Owner: ${owner.address}`);
  console.log(`Creator: ${creator.address}`);
  console.log(`Winner: ${winner.address}`);

  // Mint tokens to creator
  await mockToken.mint(creator.address, hre.ethers.parseUnits("1000", 18));
  console.log(`Minted 1000 tokens to creator`);

  // Approve tokens for tournament creation
  await mockToken.connect(creator).approve(
    await tournamentEscrow.getAddress(),
    hre.ethers.parseUnits("100", 18)
  );
  console.log(`Creator approved 100 tokens for tournament creation`);

  // Create a tournament
  const now = Math.floor(Date.now() / 1000);
  const registrationEndTime = now + 3600; // 1 hour from now
  const startTime = now + 7200; // 2 hours from now

  // Position reward amounts
  const positionRewardAmounts = [
    hre.ethers.parseUnits("50", 18),
    hre.ethers.parseUnits("30", 18),
    hre.ethers.parseUnits("20", 18)
  ];

  console.log(`Creating tournament...`);
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

  const receipt = await tx.wait();
  const event = receipt.logs.find(
    log => log.fragment && log.fragment.name === "TournamentCreated"
  );
  const tournamentId = event.args[0];
  console.log(`Tournament created with ID: ${tournamentId}`);

  // Get tournament info
  const tournamentInfo = await tournamentEscrow.getTournamentInfo(tournamentId);
  console.log(`Tournament creator: ${tournamentInfo[0]}`);
  console.log(`Tournament name: ${tournamentInfo[1]}`);
  console.log(`Tournament description: ${tournamentInfo[2]}`);
  console.log(`Tournament game ID: ${tournamentInfo[3]}`);
  console.log(`Tournament type: ${tournamentInfo[4]}`);
  console.log(`Tournament max participants: ${tournamentInfo[5]}`);
  console.log(`Tournament is active: ${tournamentInfo[9]}`);
  console.log(`Tournament reward token: ${tournamentInfo[10]}`);
  console.log(`Tournament position count: ${tournamentInfo[12]}`);

  console.log("Test completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
