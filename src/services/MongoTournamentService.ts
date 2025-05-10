import { Tournament } from '@/types/tournament';
import { TournamentType } from '@/utils/bracketUtils';
import connectToDatabase from '@/lib/mongodb';
import TournamentModel from '@/models/Tournament';

/**
 * MongoDB service to handle tournament operations
 */
export class MongoTournamentService {
  /**
   * Create a new tournament
   */
  async createTournament(tournamentData: {
    name: string;
    description: string;
    gameId: string;
    tournamentType: string;
    registrationEndDate: string;
    startDate: string;
    rewardType: string;
    rewardTokenAddress: string;
    rewardToken: string;
    rewardAmount: string;
    rewardDistribution: {
      first: number;
      second: number;
      third: number;
      fourth: number;
    };
    hasEntryFee: boolean;
    entryFeeAmount: string;
    entryFeeToken: string;
    platformFee: string;
    creator?: string;
  }): Promise<string> {
    try {
      // Connect to the database
      await connectToDatabase();

      // Generate a new tournament ID (timestamp + random)
      const tournamentId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Convert dates to Date objects
      const startDate = new Date(tournamentData.startDate);
      const registrationEndDate = new Date(tournamentData.registrationEndDate);

      // Create the tournament object
      const tournament = new TournamentModel({
        id: tournamentId,
        name: tournamentData.name,
        description: tournamentData.description,
        game: tournamentData.gameId,
        creator: tournamentData.creator || '0x0000000000000000000000000000000000000000',
        tournamentType: tournamentData.tournamentType,
        maxParticipants: 0, // No fixed max participants
        currentParticipants: 0,
        participants: [],
        startDate,
        registrationEndDate,
        status: 'registration',
        rewardType: tournamentData.rewardType,
        rewardAmount: tournamentData.rewardAmount,
        rewardToken: tournamentData.rewardToken,
        rewardDistribution: tournamentData.rewardDistribution,
        hasEntryFee: tournamentData.hasEntryFee,
        entryFeeAmount: tournamentData.entryFeeAmount,
        entryFeeToken: tournamentData.entryFeeToken,
        brackets: [],
        lastUpdated: Date.now(),
      });

      // Save to MongoDB
      await tournament.save();

      // Return the tournament ID
      return tournamentId;
    } catch (error) {
      console.error('Error creating tournament:', error);
      throw new Error(`Failed to create tournament: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a tournament by ID
   */
  async getTournament(tournamentId: string): Promise<Tournament | null> {
    try {
      console.log(`Looking for tournament with ID: ${tournamentId}`);

      // Connect to the database
      await connectToDatabase();

      // Find the tournament in MongoDB
      const tournament = await TournamentModel.findOne({ id: tournamentId });

      if (tournament) {
        console.log(`Found tournament: ${tournament.name}`);
        return tournament.toJSON() as Tournament;
      } else {
        console.log(`Tournament with ID ${tournamentId} not found`);
        return null;
      }
    } catch (error) {
      console.error(`Error getting tournament ${tournamentId}:`, error);
      return null;
    }
  }

  /**
   * Get all tournaments
   */
  async getAllTournaments(): Promise<Tournament[]> {
    try {
      // Connect to the database
      await connectToDatabase();

      // Get all tournaments from MongoDB
      const tournaments = await TournamentModel.find({}).sort({ createdAt: -1 });
      
      return tournaments.map(t => t.toJSON() as Tournament);
    } catch (error) {
      console.error('Error getting all tournaments:', error);
      return [];
    }
  }

  /**
   * Register a participant for a tournament
   */
  async registerForTournament(tournamentId: string, participant: { address: string; name: string }): Promise<boolean> {
    try {
      // Connect to the database
      await connectToDatabase();

      // Find the tournament
      const tournament = await TournamentModel.findOne({ id: tournamentId });
      
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Check if registration is still open
      if (new Date() > tournament.registrationEndDate) {
        throw new Error('Registration period has ended');
      }

      // Check if participant is already registered
      if (tournament.participants.some(p => p.address === participant.address)) {
        throw new Error('Already registered for this tournament');
      }

      // Add participant
      tournament.participants.push(participant);
      tournament.currentParticipants++;
      tournament.lastUpdated = Date.now();

      // Save to MongoDB
      await tournament.save();

      return true;
    } catch (error) {
      console.error(`Error registering for tournament ${tournamentId}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
export const mongoTournamentService = new MongoTournamentService();
