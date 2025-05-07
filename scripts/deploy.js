const { ethers, upgrades } = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`Deploying to ${network} network...`);

  // Deploy the upgradeable TournamentEscrowV2 contract
  const TournamentEscrowV2 = await ethers.getContractFactory("TournamentEscrowV2");
  console.log("Deploying TournamentEscrowV2...");
  
  const tournamentEscrow = await upgrades.deployProxy(TournamentEscrowV2, [], {
    initializer: 'initialize', // if your contract has an initialize function
    kind: 'uups' // or 'transparent' depending on your upgrade pattern
  });

  await tournamentEscrow.deployed();
  console.log(`TournamentEscrowV2 deployed to: ${tournamentEscrow.address}`);
  
  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(tournamentEscrow.address);
  console.log(`Implementation contract address: ${implementationAddress}`);

  // Get the admin address (for UUPS pattern)
  const adminAddress = await upgrades.erc1967.getAdminAddress(tournamentEscrow.address);
  console.log(`Admin contract address: ${adminAddress}`);

  // Wait for block confirmations
  console.log("Waiting for block confirmations...");
  await tournamentEscrow.deployTransaction.wait(5);

  // Network-specific verification
  if (network === "ronin") {
    console.log("Ronin network detected - skipping standard verification");
    // Add Ronin-specific verification if available
  } else {
    try {
      console.log("Verifying implementation contract...");
      await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [],
      });
      console.log("Implementation contract verified!");
    } catch (e) {
      console.log("Verification failed:", e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
