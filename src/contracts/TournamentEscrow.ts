import { ethers } from 'ethers';

// Contract ABI (Application Binary Interface)
export const TOURNAMENT_ESCROW_ABI = [
  // Tournament creation
  "function createTournament(string name, string description, string gameId, uint256 maxParticipants, uint256 registrationEndTime, uint256 startTime, address rewardTokenAddress, uint256[] positionRewardAmounts) payable returns (uint256)",
  "function createTournamentWithEntryFee(string name, string description, string gameId, uint256 maxParticipants, uint256 registrationEndTime, uint256 startTime, address rewardTokenAddress, uint256[] positionRewardAmounts, address entryFeeTokenAddress, uint256 entryFeeAmount) payable returns (uint256)",

  // Tournament registration
  "function registerForTournament(uint256 tournamentId)",
  "function registerWithEntryFee(uint256 tournamentId) payable",

  // Winner declaration
  "function declareWinner(uint256 tournamentId, uint256 position, address winner)",
  "function declareWinners(uint256 tournamentId, uint256[] positions, address[] winners)",

  // Reward claiming
  "function claimReward(uint256 tournamentId, uint256 position)",

  // Tournament cancellation
  "function cancelTournament(uint256 tournamentId)",

  // View functions
  "function getTournamentInfo(uint256 tournamentId) view returns (address creator, string name, string description, string gameId, uint256 maxParticipants, uint256 createdAt, uint256 startTime, uint256 registrationEndTime, bool isActive, address rewardTokenAddress, uint256 totalRewardAmount, uint256 positionCount, bool hasEntryFee, address entryFeeTokenAddress, uint256 entryFeeAmount, bool feesDistributed, uint256 participantCount)",
  "function getPositionInfo(uint256 tournamentId, uint256 position) view returns (uint256 rewardAmount, address winner, bool claimed)",
  "function getPositionRewardAmounts(uint256 tournamentId) view returns (uint256[])",
  "function isParticipantRegistered(uint256 tournamentId, address participant) view returns (bool)",
  "function MIN_REGISTRATION_PERIOD() view returns (uint256)",

  // Events
  "event TournamentCreated(uint256 indexed tournamentId, address indexed creator, string name)",
  "event ParticipantRegistered(uint256 indexed tournamentId, address indexed participant)",
  "event WinnerDeclared(uint256 indexed tournamentId, uint256 position, address winner)",
  "event RewardClaimed(uint256 indexed tournamentId, uint256 position, address winner, uint256 amount)",
  "event TournamentCancelled(uint256 indexed tournamentId)",
  "event EntryFeesDistributed(uint256 indexed tournamentId, address indexed creator, uint256 creatorAmount, uint256 platformFeeAmount)",
  "event PlatformFeesWithdrawn(address indexed token, address indexed recipient, uint256 amount)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];

// Contract addresses (to be updated after deployment)
export const TOURNAMENT_ESCROW_ADDRESS = {
  // Ronin Mainnet
  mainnet: "0x0000000000000000000000000000000000000000", // Replace after deployment

  // Ronin Testnet (Saigon)
  testnet: "0x0000000000000000000000000000000000000000"  // Replace after deployment
};

// ERC20 Token ABI (for token approvals)
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

// Helper function to get contract instance
export function getTournamentEscrowContract(
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider,
  isTestnet: boolean = false
) {
  const address = isTestnet ?
    TOURNAMENT_ESCROW_ADDRESS.testnet :
    TOURNAMENT_ESCROW_ADDRESS.mainnet;

  return new ethers.Contract(
    address,
    TOURNAMENT_ESCROW_ABI,
    provider
  );
}

// Helper function to get ERC20 token contract
export function getERC20Contract(
  tokenAddress: string,
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider
) {
  return new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    provider
  );
}
