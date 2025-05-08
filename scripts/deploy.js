const { ethers, upgrades } = require("hardhat");
const path = require('path');
const fs = require('fs');

// More verbose dotenv loading with debugging
const dotenv = require('dotenv');
const envPath = path.resolve(process.cwd(), '.env');
console.log('Looking for .env file at:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
  console.log('.env file content:', fs.readFileSync(envPath, 'utf8'));
}
const result = dotenv.config();
console.log('dotenv.config() result:', result);

async function main() {
  // Debug line to check if .env is being read
  console.log("Environment variables loaded:", {
    hasPrivateKey: !!process.env.PRIVATE_KEY,
    privateKeyLength: process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.length : 0,
    cwd: process.cwd()
  });

  if (!process.env.PRIVATE_KEY) {
    throw new Error("Please set your PRIVATE_KEY in the .env file");
  }

  // Get the deployer from hardhat's ethers
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Get the contract factory
  const TournamentEscrowV2 = await ethers.getContractFactory("TournamentEscrowV2");
  console.log("Deploying TournamentEscrowV2...");

  // Deploy using the upgrades plugin
  const tournamentEscrow = await upgrades.deployProxy(TournamentEscrowV2, [], {
    initializer: 'initialize',
    kind: 'uups'
  });

  await tournamentEscrow.waitForDeployment();
  const tournamentEscrowAddress = await tournamentEscrow.getAddress();
  console.log(`TournamentEscrowV2 deployed to: ${tournamentEscrowAddress}`);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(tournamentEscrowAddress);
  console.log(`Implementation contract address: ${implementationAddress}`);

  // Get the admin address (for UUPS pattern)
  const adminAddress = await upgrades.erc1967.getAdminAddress(tournamentEscrowAddress);
  console.log(`Admin contract address: ${adminAddress}`);

  console.log("Deployment completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });


