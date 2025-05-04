const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentEscrowV2 - Simple Test", function () {
  let tournamentEscrow;
  let mockToken;
  let owner;
  let creator;
  
  beforeEach(async function () {
    // Get signers
    [owner, creator] = await ethers.getSigners();
    
    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();
    
    // Deploy TournamentEscrowV2
    const TournamentEscrow = await ethers.getContractFactory("TournamentEscrowV2");
    tournamentEscrow = await TournamentEscrow.deploy();
    await tournamentEscrow.waitForDeployment();
  });
  
  it("Should deploy successfully", async function () {
    expect(await tournamentEscrow.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
});
