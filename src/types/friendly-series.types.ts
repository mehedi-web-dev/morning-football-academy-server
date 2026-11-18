import { ObjectId } from 'mongodb';
import type { PublicPlayerDocument } from '../utils/publicPlayer.js';

export type FriendlySeriesFormat = 'best_of_3' | 'best_of_5';

export type FriendlySeriesStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export type FriendlyMatchStatus =
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'postponed'
  | 'cancelled';

export type FriendlyGoalType = 'normal' | 'own_goal';

export interface FriendlyMatchGoalEvent {
  playerId: ObjectId;
  teamId: ObjectId;
  type: FriendlyGoalType;
  minute?: number;
}

export interface FriendlyMatchResult {
  homeScore: number;
  awayScore: number;
  winnerTeamId: ObjectId | null; // null indicates a draw
  isDraw: boolean;
  notes?: string;
  goals: FriendlyMatchGoalEvent[];
}

export interface FriendlySeriesStats {
  teamAWins: number;
  teamBWins: number;
  draws: number;
  matchesPlayed: number;
  matchesRemaining: number;
  maxMatches: number; // 3 for bo3, 5 for bo5
  requiredWins: number; // 2 for bo3, 3 for bo5
  status: FriendlySeriesStatus;
  championTeamId: ObjectId | null;
  isDrawnSeries: boolean;
}

export interface FriendlySeriesDocument {
  _id?: ObjectId;
  name: string;
  slug: string;
  season: string;
  description?: string;
  format: FriendlySeriesFormat;
  teamAId: ObjectId;
  teamBId: ObjectId;
  status: FriendlySeriesStatus;
  startDate?: Date;
  endDate?: Date;
  venue?: string;
  championTeamId?: ObjectId | null;
  isDrawnSeries: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendlySeriesMatchDocument {
  _id?: ObjectId;
  seriesId: ObjectId;
  matchNumber: number; // 1 to 3 for bo3; 1 to 5 for bo5
  homeTeamId: ObjectId;
  awayTeamId: ObjectId;
  matchDate?: Date;
  kickOffTime?: string; // HH:mm format
  venue?: string;
  status: FriendlyMatchStatus;
  result?: FriendlyMatchResult;
  goals?: FriendlyMatchGoalEvent[];
  createdAt: Date;
  updatedAt: Date;
}

// DTO types for repository & service
export type CreateFriendlySeriesDTO = Omit<
  FriendlySeriesDocument,
  '_id' | 'createdAt' | 'updatedAt' | 'championTeamId' | 'isDrawnSeries'
> & {
  championTeamId?: ObjectId | null;
  isDrawnSeries?: boolean;
};

export type UpdateFriendlySeriesDTO = Partial<
  Omit<FriendlySeriesDocument, '_id' | 'createdAt' | 'updatedAt'>
>;

export type CreateFriendlyMatchDTO = Omit<
  FriendlySeriesMatchDocument,
  '_id' | 'createdAt' | 'updatedAt'
>;

export type UpdateFriendlyMatchDTO = Partial<
  Omit<FriendlySeriesMatchDocument, '_id' | 'seriesId' | 'createdAt' | 'updatedAt' | 'homeTeamId' | 'awayTeamId'>
> & {
  homeTeamId?: string | ObjectId;
  awayTeamId?: string | ObjectId;
};

export interface TeamSummary {
  _id: ObjectId;
  name: string;
  shortCode?: string;
  logo?: string;
  color?: string;
}

export interface TeamWithRoster extends TeamSummary {
  playerIds: ObjectId[];
}

export interface TopGoalScorerEntry {
  rank: number;
  playerId: ObjectId;
  playerName: string;
  playerImage?: string;
  teamId: ObjectId;
  teamName: string;
  teamColor?: string;
  totalGoals: number;
  matchesScored?: number;
}

export interface FriendlySeriesTeamPlayersResponse {
  seriesId: ObjectId;
  teamA: {
    _id: ObjectId;
    name: string;
    shortCode?: string;
    logo?: string;
    color?: string;
    players: PublicPlayerDocument[];
  };
  teamB: {
    _id: ObjectId;
    name: string;
    shortCode?: string;
    logo?: string;
    color?: string;
    players: PublicPlayerDocument[];
  };
}

export interface FriendlySeriesDetailResponse {
  series: FriendlySeriesDocument;
  teamA: TeamSummary;
  teamB: TeamSummary;
  stats: FriendlySeriesStats;
  championTeam?: TeamSummary | null;
}
