import { ObjectId } from 'mongodb';

export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'postponed' | 'cancelled';
export type MatchVenueType = 'home' | 'away';

export interface MatchDocument {
  _id?: ObjectId;
  opponent: string;
  opponentLogo?: string;
  competition: string;
  venue: string;
  matchDate: Date;
  kickOffTime: string;
  homeAway: MatchVenueType;
  status: MatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateMatchDTO = Omit<MatchDocument, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateMatchDTO = Partial<CreateMatchDTO>;
