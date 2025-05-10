import { Tournament } from '@/types/tournament';
import { TournamentType } from '@/utils/bracketUtils';

// Storage key for localStorage
const STORAGE_KEY = 'cyber_battlefield_tournaments';
const ID_COUNTER_KEY = 'cyber_battlefield_next_id';

// Initialize tournaments from localStorage or empty array
const loadTournamentsFromStorage = (): Tournament[] => {
  if (typeof window === 'undefined') return []; // Server-side rendering check

  try {
    const storedTournaments = localStorage.getItem(STORAGE_KEY);
    if (storedTournaments) {
      const parsed = JSON.parse(storedTournaments);

      // Convert string dates back to Date objects
      return parsed.map((tournament: Tournament) => ({
        ...tournament,
        startDate: new Date(tournament.startDate),
        registrationEndDate: new Date(tournament.registrationEndDate),
        lastUpdated: tournament.lastUpdated || Date.now()
      }));
    }
  } catch (error) {
    console.error('Error loading tournaments from storage:', error);
  }

  return [];
};

// Initialize next tournament ID from localStorage or start at 1
const loadNextIdFromStorage = (): number => {
  if (typeof window === 'undefined') return 1; // Server-side rendering check

  try {
    const storedId = localStorage.getItem(ID_COUNTER_KEY);
    if (storedId) {
      return parseInt(storedId, 10);
    }
  } catch (error) {
    console.error('Error loading next ID from storage:', error);
  }

  return 1;
};

// Save tournaments to localStorage
const saveTournamentsToStorage = (tournaments: Tournament[]): void => {
  if (typeof window === 'undefined') return; // Server-side rendering check

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  } catch (error) {
    console.error('Error saving tournaments to storage:', error);
  }
};

// Save next tournament ID to localStorage
const saveNextIdToStorage = (nextId: number): void => {
  if (typeof window === 'undefined') return; // Server-side rendering check

  try {
    localStorage.setItem(ID_COUNTER_KEY, nextId.toString());
  } catch (error) {
    console.error('Error saving next ID to storage:', error);
  }
};

// Initialize storage
let tournaments: Tournament[] = loadTournamentsFromStorage();
let nextTournamentId = loadNextIdFromStorage();

/**
 * Backend service to handle tournament operations while contract connection is being fixed
 */
export class BackendTournamentService {
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
      // Generate a new tournament ID
      const tournamentId = nextTournamentId.toString();
      nextTournamentId++;

      // Save the updated ID counter
      saveNextIdToStorage(nextTournamentId);

      // Convert dates to Date objects
      const startDate = new Date(tournamentData.startDate);
      const registrationEndDate = new Date(tournamentData.registrationEndDate);

      // Create the tournament object
      const tournament: Tournament = {
        id: tournamentId,
        name: tournamentData.name,
        description: tournamentData.description,
        game: tournamentData.gameId,
        creator: tournamentData.creator || '0x0000000000000000000000000000000000000000',
        tournamentType: tournamentData.tournamentType as TournamentType,
        maxParticipants: 0, // No fixed max participants
        currentParticipants: 0,
        participants: [],
        startDate,
        registrationEndDate,
        status: 'registration',
        rewardType: tournamentData.rewardType as 'token' | 'nft',
        rewardAmount: tournamentData.rewardAmount,
        rewardToken: tournamentData.rewardToken,
        rewardDistribution: tournamentData.rewardDistribution,
        hasEntryFee: tournamentData.hasEntryFee,
        entryFeeAmount: tournamentData.entryFeeAmount,
        entryFeeToken: tournamentData.entryFeeToken,
        brackets: [],
        lastUpdated: Date.now(),
      };

      // Store the tournament
      tournaments.push(tournament);

      // Save to localStorage
      saveTournamentsToStorage(tournaments);

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
      console.log(`Current tournaments in memory: ${tournaments.length}`);

      // Reload from storage to ensure we have the latest data
      tournaments = loadTournamentsFromStorage();

      const tournament = tournaments.find(t => t.id === tournamentId);

      if (tournament) {
        console.log(`Found tournament: ${tournament.name}`);
      } else {
        console.log(`Tournament with ID ${tournamentId} not found`);
      }

      return tournament || null;
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
      // Reload from storage to ensure we have the latest data
      tournaments = loadTournamentsFromStorage();
      return [...tournaments];
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
      const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
      if (tournamentIndex === -1) {
        throw new Error('Tournament not found');
      }

      const tournament = tournaments[tournamentIndex];

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

      // Update the tournament in the array
      tournaments[tournamentIndex] = tournament;

      // Save to localStorage
      saveTournamentsToStorage(tournaments);

      return true;
    } catch (error) {
      console.error(`Error registering for tournament ${tournamentId}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
export const backendTournamentService = new BackendTournamentService();
