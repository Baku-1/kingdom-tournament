const hre = require("hardhat");

async function main() {
  console.log("Deploying TournamentEscrow contract...");

  // Deploy the TournamentEscrow contract
  const TournamentEscrow = await hre.ethers.getContractFactory("TournamentEscrow");
  const tournamentEscrow = await TournamentEscrow.deploy();

  await tournamentEscrow.deployed();

  console.log(`TournamentEscrow deployed to: ${tournamentEscrow.address}`);
  
  // For verification later
  console.log("Wait for block confirmations...");
  await tournamentEscrow.deployTransaction.wait(5);
  
  // Verify the contract on Etherscan (if on a supported network)
  try {
    console.log("Verifying contract...");
    await hre.run("verify:verify", {
      address: tournamentEscrow.address,
      constructorArguments: [],
    });
    console.log("Contract verified!");
  } catch (e) {
    console.log("Verification failed:", e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
