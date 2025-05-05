import { ethers } from 'ethers';
import {
  TOURNAMENT_ESCROW_ABI,
  TOURNAMENT_ESCROW_ADDRESS,
  ERC20_ABI
} from '@/contracts/TournamentEscrow';

// Environment configuration
const IS_TESTNET = process.env.NEXT_PUBLIC_NETWORK === 'testnet';

// Constants for ethers v6
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Define a type for the connector
interface RoninConnector {
  provider: unknown;
  connect: () => Promise<{ account: string; chainId: number }>;
  getAccounts: () => Promise<string[]>;
  getChainId: () => Promise<number>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
}

export class ContractService {
  public provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private connector: RoninConnector | null = null;

  constructor() {
    // Provider will be set when connect is called with the connector
  }

  // Set the connector from WalletProvider
  setConnector(connector: RoninConnector) {
    this.connector = connector;
    if (connector && connector.provider) {
      this.provider = new ethers.BrowserProvider(connector.provider);
    }
  }

  // Connect to wallet and get signer
  async connect() {
    if (!this.provider) {
      throw new Error('Provider not available');
    }

    await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    return await this.signer.getAddress();
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
      ZERO_ADDRESS;

    // Calculate position reward amounts based on distribution
    const totalReward = ethers.parseUnits(tournamentData.rewardAmount, 18);
    const positionRewardAmounts = [];

    // Add rewards for positions with non-zero percentages
    if (tournamentData.rewardDistribution.first > 0) {
      positionRewardAmounts.push(
        totalReward * BigInt(tournamentData.rewardDistribution.first) / BigInt(100)
      );
    }

    if (tournamentData.rewardDistribution.second > 0) {
      positionRewardAmounts.push(
        totalReward * BigInt(tournamentData.rewardDistribution.second) / BigInt(100)
      );
    }

    if (tournamentData.rewardDistribution.third > 0) {
      positionRewardAmounts.push(
        totalReward * BigInt(tournamentData.rewardDistribution.third) / BigInt(100)
      );
    }

    if (tournamentData.rewardDistribution.fourth > 0) {
      positionRewardAmounts.push(
        totalReward * BigInt(tournamentData.rewardDistribution.fourth) / BigInt(100)
      );
    }

    // If using ERC20 token, approve transfer first
    if (rewardTokenAddress !== ZERO_ADDRESS) {
      const tokenContract = this.getERC20Contract(rewardTokenAddress, true);

      // Check if approval is needed
      const currentAllowance = await tokenContract.allowance(
        await this.signer.getAddress(),
        contract.address
      );

      if (currentAllowance < totalReward) {
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
        value: rewardTokenAddress === ZERO_ADDRESS ? totalReward : 0
      }
    );

    const receipt = await tx.wait();

    // Find tournament ID from event
    const event = receipt.logs.find(log => {
      const parsedLog = contract.interface.parseLog(log);
      return parsedLog?.name === 'TournamentCreated';
    });

    const parsedEvent = event ? contract.interface.parseLog(event) : null;
    const tournamentId = parsedEvent?.args?.tournamentId?.toString();

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

  // Declare multiple winners at once
  async declareWinners(tournamentId: string, positions: number[], winnerAddresses: string[]) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    if (positions.length !== winnerAddresses.length) {
      throw new Error('Positions and winner addresses arrays must have the same length');
    }

    const contract = this.getTournamentEscrowContract(true);

    // Check if the contract supports the declareWinners function
    if (typeof contract.declareWinners === 'function') {
      // Use the batch function if available
      const tx = await contract.declareWinners(tournamentId, positions, winnerAddresses);
      await tx.wait();
    } else {
      // Fall back to individual declarations if batch function is not available
      for (let i = 0; i < positions.length; i++) {
        const tx = await contract.declareWinner(tournamentId, positions[i], winnerAddresses[i]);
        await tx.wait();
      }
    }

    return true;
  }

  // Finalize tournament by declaring all winners
  async finalizeTournament(tournamentId: string, winnersByPosition: Record<string, string>) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    const positions: number[] = [];
    const winners: string[] = [];

    // Convert the record to arrays for batch processing
    for (const [position, address] of Object.entries(winnersByPosition)) {
      if (address) {
        positions.push(parseInt(position));
        winners.push(address);
      }
    }

    // Use the batch function to declare all winners
    return this.declareWinners(tournamentId, positions, winners);
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

  // Register for a tournament without entry fee
  async registerForTournament(tournamentId: string) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    const contract = this.getTournamentEscrowContract(true);

    const tx = await contract.registerForTournament(tournamentId);
    const receipt = await tx.wait();

    // Check for successful registration event
    const event = receipt.logs.find(log => {
      const parsedLog = contract.interface.parseLog(log);
      return parsedLog?.name === 'ParticipantRegistered';
    });

    if (!event) {
      throw new Error('Registration failed: Event not found in transaction receipt');
    }

    return true;
  }

  // Register for a tournament with entry fee
  async registerWithEntryFee(tournamentId: string, entryFeeTokenAddress: string, entryFeeAmount: string) {
    if (!this.signer) {
      throw new Error('Signer not available. Please connect wallet first.');
    }

    const contract = this.getTournamentEscrowContract(true);

    // If using ERC20 token (not native token), approve transfer first
    if (entryFeeTokenAddress !== ZERO_ADDRESS) {
      const tokenContract = this.getERC20Contract(entryFeeTokenAddress, true);
      const entryFeeAmountBigInt = ethers.parseUnits(entryFeeAmount, 18);

      // Check if approval is needed
      const currentAllowance = await tokenContract.allowance(
        await this.signer.getAddress(),
        contract.address
      );

      if (currentAllowance < entryFeeAmountBigInt) {
        const approveTx = await tokenContract.approve(contract.address, entryFeeAmountBigInt);
        await approveTx.wait();
      }

      // Register with entry fee (ERC20 token)
      const tx = await contract.registerWithEntryFee(tournamentId);
      const receipt = await tx.wait();

      // Check for successful registration event
      const event = receipt.logs.find(log => {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === 'ParticipantRegistered';
      });

      if (!event) {
        throw new Error('Registration failed: Event not found in transaction receipt');
      }
    } else {
      // Register with entry fee (native token)
      const entryFeeAmountBigInt = ethers.parseUnits(entryFeeAmount, 18);

      const tx = await contract.registerWithEntryFee(tournamentId, {
        value: entryFeeAmountBigInt
      });
      const receipt = await tx.wait();

      // Check for successful registration event
      const event = receipt.logs.find(log => {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === 'ParticipantRegistered';
      });

      if (!event) {
        throw new Error('Registration failed: Event not found in transaction receipt');
      }
    }

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
      maxParticipants: Number(info.maxParticipants),
      createdAt: new Date(Number(info.createdAt) * 1000),
      startDate: new Date(Number(info.startTime) * 1000),
      registrationEndDate: new Date(Number(info.registrationEndTime) * 1000),
      isActive: info.isActive,
      rewardTokenAddress: info.rewardTokenAddress,
      rewardType: info.rewardTokenAddress === ZERO_ADDRESS ? 'native' : 'token',
      totalRewardAmount: ethers.formatUnits(info.totalRewardAmount, 18),
      positionCount: Number(info.positionCount),
      hasEntryFee: info.hasEntryFee,
      entryFeeTokenAddress: info.entryFeeTokenAddress,
      entryFeeAmount: info.entryFeeAmount ? ethers.formatUnits(info.entryFeeAmount, 18) : '0',
      participantCount: Number(info.participantCount),
      positionRewardAmounts: positionRewardAmounts.map(amount =>
        ethers.formatUnits(amount, 18)
      )
    };
  }

  // Get position info
  async getPositionInfo(tournamentId: string, position: number) {
    const contract = this.getTournamentEscrowContract();

    const info = await contract.getPositionInfo(tournamentId, position);

    return {
      rewardAmount: ethers.formatUnits(info.rewardAmount, 18),
      winner: info.winner,
      claimed: info.claimed
    };
  }

  // Check if a participant is registered for a tournament
  async isParticipantRegistered(tournamentId: string, participantAddress: string) {
    const contract = this.getTournamentEscrowContract();
    return await contract.isParticipantRegistered(tournamentId, participantAddress);
  }

  // Get all participants for a tournament
  // Note: This method requires a list of addresses to check against
  // It's not possible to get all participants directly from the contract
  async getTournamentParticipants(tournamentId: string, addressesToCheck: string[]) {
    const contract = this.getTournamentEscrowContract();
    const participants = [];

    // Check each address to see if it's registered
    for (const address of addressesToCheck) {
      try {
        const isRegistered = await contract.isParticipantRegistered(tournamentId, address);
        if (isRegistered) {
          participants.push({
            address,
            name: `Player ${participants.length + 1}` // Default name
          });
        }
      } catch (error) {
        console.error(`Error checking if ${address} is registered:`, error);
      }
    }

    return participants;
  }

  // Get participants from registration events
  // This is a more efficient way to get participants
  async getParticipantsFromEvents(tournamentId: string, provider: ethers.BrowserProvider) {
    const contract = this.getTournamentEscrowContract();

    // Create a filter for ParticipantRegistered events for this tournament
    const filter = contract.filters.ParticipantRegistered(tournamentId);

    // Get the events
    const events = await provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: contract.address,
      topics: filter.topics as string[]
    });

    // Parse the events to get participant addresses
    const participants = [];
    for (const event of events) {
      const parsedLog = contract.interface.parseLog(event);
      if (parsedLog && parsedLog.args && parsedLog.args.participant) {
        const participantAddress = parsedLog.args.participant;
        participants.push({
          address: participantAddress,
          name: `Player ${participants.length + 1}` // Default name
        });
      }
    }

    return participants;
  }
}

// Create singleton instance
export const contractService = new ContractService();
