const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`Upgrading on ${network} network...`);

  // Get the proxy address from the previous deployment
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS environment variable is not set");
  }

  console.log(`Upgrading TournamentEscrowV2 at ${proxyAddress}...`);

  // Deploy the new implementation
  const TournamentEscrowV2 = await ethers.getContractFactory("TournamentEscrowV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, TournamentEscrowV2);

  console.log("Upgrade completed!");
  console.log(`New implementation address: ${await upgrades.erc1967.getImplementationAddress(proxyAddress)}`);

  // Wait for block confirmations
  console.log("Waiting for block confirmations...");
  await upgraded.deployTransaction.wait(5);

  // Network-specific verification
  if (network === "roninTestnet") {
    console.log("Ronin Testnet detected - skipping standard verification");
    // Add Ronin-specific verification if available
  } else {
    try {
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      console.log("Verifying new implementation contract...");
      await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [],
      });
      console.log("New implementation contract verified!");
    } catch (e) {
      console.log("Verification failed:", e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 