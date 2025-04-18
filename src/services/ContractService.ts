import { ethers } from 'ethers';
import {
  TOURNAMENT_ESCROW_ABI,
  TOURNAMENT_ESCROW_ADDRESS,
  ERC20_ABI
} from '@/contracts/TournamentEscrow';

// Environment configuration
const IS_TESTNET = process.env.NEXT_PUBLIC_NETWORK === 'testnet';

export class ContractService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private connector: any = null;

  constructor() {
    // Provider will be set when connect is called with the connector
  }

  // Set the connector from WalletProvider
  setConnector(connector: any) {
    this.connector = connector;
    if (connector && connector.provider) {
      this.provider = new ethers.providers.Web3Provider(connector.provider);
    }
  }

  // Connect to wallet and get signer
  async connect() {
    if (!this.provider) {
      throw new Error('Provider not available');
    }

    await this.provider.send('eth_requestAccounts', []);
    this.signer = this.provider.getSigner();
    return this.signer.getAddress();
  }

  // Get tournament escrow contract
  getTournamentEscrowContract(withSigner = false) {
    if (!this.provider) {
      throw new Error('Provider not available');
    }

    const address = IS_TESTNET ?
      TOURNAMENT_ESCROW_ADDRESS.testnet :
      TOURNAMENT_ESCROW_ADDRESS.mainnet;

    return new ethers.Contract(
      address,
      TOURNAMENT_ESCROW_ABI,
      withSigner && this.signer ? this.signer : this.provider
    );
  }

  // Get ERC20 token contract
  getERC20Contract(tokenAddress: string, withSigner = false) {
    if (!this.provider) {
      throw new Error('Provider not available');
    }

    return new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      withSigner && this.signer ? this.signer : this.provider
    );
  }

  // Create a tournament
  async createTournament(tournamentData: {
    name: string;
    description: string;
    gameId: string;
    tournamentType: string;
    maxParticipants?: number;
    registrationEndDate: string;
    startDate: string;
    rewardType: string;
    rewardTokenAddress: string;
    rewardAmount: string;
    rewardDistribution: {
      first: number;
      second: number;
      third: number;
      fourth: number;
    };
  }) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    const contract = this.getTournamentEscrowContract(true);

    // Convert dates to timestamps
    const registrationEndTime = Math.floor(new Date(tournamentData.registrationEndDate).getTime() / 1000);
    const startTime = Math.floor(new Date(tournamentData.startDate).getTime() / 1000);

    // Determine reward token address (use zero address for native token)
    const rewardTokenAddress = tournamentData.rewardType === 'token' ?
      tournamentData.rewardTokenAddress :
      ethers.constants.AddressZero;

    // Calculate position reward amounts based on distribution
    const totalReward = ethers.utils.parseUnits(tournamentData.rewardAmount, 18);
    const positionRewardAmounts = [];

    // Add rewards for positions with non-zero percentages
    if (tournamentData.rewardDistribution.first > 0) {
      positionRewardAmounts.push(
        totalReward.mul(tournamentData.rewardDistribution.first).div(100)
      );
    }

    if (tournamentData.rewardDistribution.second > 0) {
      positionRewardAmounts.push(
        totalReward.mul(tournamentData.rewardDistribution.second).div(100)
      );
    }

    if (tournamentData.rewardDistribution.third > 0) {
      positionRewardAmounts.push(
        totalReward.mul(tournamentData.rewardDistribution.third).div(100)
      );
    }

    if (tournamentData.rewardDistribution.fourth > 0) {
      positionRewardAmounts.push(
        totalReward.mul(tournamentData.rewardDistribution.fourth).div(100)
      );
    }

    // If using ERC20 token, approve transfer first
    if (rewardTokenAddress !== ethers.constants.AddressZero) {
      const tokenContract = this.getERC20Contract(rewardTokenAddress, true);

      // Check if approval is needed
      const currentAllowance = await tokenContract.allowance(
        await this.signer.getAddress(),
        contract.address
      );

      if (currentAllowance.lt(totalReward)) {
        const approveTx = await tokenContract.approve(contract.address, totalReward);
        await approveTx.wait();
      }
    }

    // Create tournament
    const tx = await contract.createTournament(
      tournamentData.name,
      tournamentData.description,
      tournamentData.gameId,
      tournamentData.tournamentType === 'single-elimination' ? 0 : 1,
      0, // No fixed max participants - will be determined by actual registrations
      registrationEndTime,
      startTime,
      rewardTokenAddress,
      positionRewardAmounts,
      {
        value: rewardTokenAddress === ethers.constants.AddressZero ? totalReward : 0
      }
    );

    const receipt = await tx.wait();

    // Find tournament ID from event
    const event = receipt.events?.find(e => e.event === 'TournamentCreated');
    const tournamentId = event?.args?.tournamentId.toString();

    return tournamentId;
  }

  // Declare winner
  async declareWinner(tournamentId: string, position: number, winnerAddress: string) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    const contract = this.getTournamentEscrowContract(true);

    const tx = await contract.declareWinner(tournamentId, position, winnerAddress);
    await tx.wait();

    return true;
  }

  // Claim reward
  async claimReward(tournamentId: string, position: number) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    const contract = this.getTournamentEscrowContract(true);

    const tx = await contract.claimReward(tournamentId, position);
    await tx.wait();

    return true;
  }

  // Cancel tournament
  async cancelTournament(tournamentId: string) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    const contract = this.getTournamentEscrowContract(true);

    const tx = await contract.cancelTournament(tournamentId);
    await tx.wait();

    return true;
  }

  // Get tournament info
  async getTournamentInfo(tournamentId: string) {
    const contract = this.getTournamentEscrowContract();

    const info = await contract.getTournamentInfo(tournamentId);
    const positionRewardAmounts = await contract.getPositionRewardAmounts(tournamentId);

    // Format the response
    return {
      id: tournamentId,
      creator: info.creator,
      name: info.name,
      description: info.description,
      gameId: info.gameId,
      tournamentType: info.tournamentType === 0 ? 'single-elimination' : 'double-elimination',
      maxParticipants: info.maxParticipants.toNumber(),
      createdAt: new Date(info.createdAt.toNumber() * 1000),
      startDate: new Date(info.startTime.toNumber() * 1000),
      registrationEndDate: new Date(info.registrationEndTime.toNumber() * 1000),
      isActive: info.isActive,
      rewardTokenAddress: info.rewardTokenAddress,
      rewardType: info.rewardTokenAddress === ethers.constants.AddressZero ? 'native' : 'token',
      totalRewardAmount: ethers.utils.formatUnits(info.totalRewardAmount, 18),
      positionCount: info.positionCount.toNumber(),
      positionRewardAmounts: positionRewardAmounts.map(amount =>
        ethers.utils.formatUnits(amount, 18)
      )
    };
  }

  // Get position info
  async getPositionInfo(tournamentId: string, position: number) {
    const contract = this.getTournamentEscrowContract();

    const info = await contract.getPositionInfo(tournamentId, position);

    return {
      rewardAmount: ethers.utils.formatUnits(info.rewardAmount, 18),
      winner: info.winner,
      claimed: info.claimed
    };
  }
}

// Create singleton instance
export const contractService = new ContractService();
