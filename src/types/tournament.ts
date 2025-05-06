import { Bracket, Participant, TournamentType } from '@/utils/bracketUtils';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  game: string;
  creator: string;
  tournamentType: TournamentType;
  maxParticipants: number;
  currentParticipants: number;
  participants: Participant[];
  startDate: Date;
  registrationEndDate: Date;
  status: 'registration' | 'active' | 'completed';
  rewardType: 'token' | 'nft';
  rewardAmount: string;
  rewardToken: string;
  rewardDistribution: {
    first: number;
    second: number;
    third: number;
    fourth: number;
  };
  hasEntryFee: boolean;
  entryFeeAmount: string;
  entryFeeToken: string;
  entryFeeTokenAddress?: string;
  brackets: Bracket[];
  lastUpdated?: number; // Timestamp to force React to detect changes
}
