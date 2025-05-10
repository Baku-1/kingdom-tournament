import mongoose, { Schema, Document } from 'mongoose';
import { Tournament as TournamentType } from '@/types/tournament';

// Define the participant schema
const ParticipantSchema = new Schema({
  address: { type: String, required: true },
  name: { type: String, required: true }
});

// Define the match schema
const MatchSchema = new Schema({
  id: { type: Number, required: true },
  position: { type: Number, required: true },
  player1: { type: ParticipantSchema, default: null },
  player2: { type: ParticipantSchema, default: null },
  winner: { type: ParticipantSchema, default: null },
  loser: { type: ParticipantSchema, default: null },
  status: { type: String, enum: ['pending', 'completed', 'bye'], default: 'pending' },
  matchType: { type: String, default: 'regular' }
});

// Define the bracket schema
const BracketSchema = new Schema({
  bracketType: { type: String, required: true },
  round: { type: Number, required: true },
  matches: [MatchSchema]
});

// Define the reward distribution schema
const RewardDistributionSchema = new Schema({
  first: { type: Number, required: true, default: 100 },
  second: { type: Number, required: true, default: 0 },
  third: { type: Number, required: true, default: 0 },
  fourth: { type: Number, required: true, default: 0 }
});

// Define the tournament schema
const TournamentSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  game: { type: String, required: true },
  creator: { type: String, required: true },
  tournamentType: { type: String, enum: ['single-elimination', 'double-elimination'], required: true },
  maxParticipants: { type: Number, default: 0 },
  currentParticipants: { type: Number, default: 0 },
  participants: [ParticipantSchema],
  startDate: { type: Date, required: true },
  registrationEndDate: { type: Date, required: true },
  status: { type: String, enum: ['registration', 'active', 'completed'], default: 'registration' },
  rewardType: { type: String, enum: ['token', 'nft'], required: true },
  rewardAmount: { type: String, required: true },
  rewardToken: { type: String },
  rewardDistribution: { type: RewardDistributionSchema, default: { first: 100, second: 0, third: 0, fourth: 0 } },
  hasEntryFee: { type: Boolean, default: false },
  entryFeeAmount: { type: String, default: '0' },
  entryFeeToken: { type: String, default: 'RON' },
  brackets: [BracketSchema],
  lastUpdated: { type: Number, default: () => Date.now() }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      // Convert MongoDB _id to id if needed
      ret.id = ret.id || ret._id.toString();
      delete ret._id;
      delete ret.__v;

      // Convert date strings to Date objects
      ret.startDate = new Date(ret.startDate);
      ret.registrationEndDate = new Date(ret.registrationEndDate);

      return ret;
    }
  }
});

// Create and export the model
export default mongoose.models.Tournament || mongoose.model<TournamentType & Document>('Tournament', TournamentSchema);
