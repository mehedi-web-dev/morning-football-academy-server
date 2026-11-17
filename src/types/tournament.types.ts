import { ObjectId } from 'mongodb';

export type TournamentStatus =
  | 'draft'
  | 'teams_registered'
  | 'fixtures_generated'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TournamentStage = 'league' | 'final';

export type TournamentMatchStatus =
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'postponed'
  | 'cancelled';

export type GoalType = 'regular' | 'extra_time' | 'own_goal';

export interface TournamentRules {
  minTeams: number; // Minimum 3 teams
  maxTeams: number | null; // Unlimited teams (null)
  minPlayersPerTeam: number; // Minimum 5 players per team
  maxPlayersPerTeam: number; // Maximum 6 players per team
  pointsForWin: number; // 3
  pointsForDraw: number; // 1
  pointsForLoss: number; // 0
  hasExtraTimeInFinal: boolean; // true
  hasPenaltiesInFinal: boolean; // true
  // Optional for backward compatibility with legacy tournament records
  teamsCount?: number;
  playersPerTeam?: number;
}

export interface MatchGoalEvent {
  playerId: ObjectId;
  teamId: ObjectId;
  minute?: number;
  type: GoalType;
}

export interface MatchResultDetails {
  homeScore: number; // Total match score: regular + extra time
  awayScore: number; // Total match score: regular + extra time
  regularTimeHomeScore?: number;
  regularTimeAwayScore?: number;
  extraTimeHomeScore?: number;
  extraTimeAwayScore?: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  homePenaltyScore?: number; // Penalty shootout kicks (never count toward Golden Boot)
  awayPenaltyScore?: number; // Penalty shootout kicks (never count toward Golden Boot)
  winnerTeamId?: ObjectId | null; // null for drawn league matches, required for final
}

export interface TournamentDocument {
  _id?: ObjectId;
  name: string;
  slug: string;
  season: string;
  description?: string;
  status: TournamentStatus;
  startDate: Date;
  endDate?: Date;
  venue?: string;
  rules: TournamentRules;
  registeredTeamCount?: number;
  finalMatchId?: ObjectId;
  winnerTeamId?: ObjectId;
  goldenBootPlayerId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentTeamDocument {
  _id?: ObjectId;
  tournamentId: ObjectId;
  name: string;
  shortCode?: string;
  logo?: string;
  color?: string;
  playerIds: ObjectId[]; // 5 or 6 player ObjectIds (no substitutes)
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentMatchDocument {
  _id?: ObjectId;
  tournamentId: ObjectId;
  stage: TournamentStage;
  round?: number; // 1 to R for league matches; null for final
  matchNumber: number; // 1 to M for league; M+1 for final
  homeTeamId: ObjectId;
  awayTeamId: ObjectId;
  matchDate?: Date;
  kickOffTime?: string; // HH:mm format
  venue?: string;
  status: TournamentMatchStatus;
  result?: MatchResultDetails;
  goals: MatchGoalEvent[]; // Normal play & extra time goals ONLY (no shootout kicks)
  createdAt: Date;
  updatedAt: Date;
}

// DTOs for repository and service layers
export type CreateTournamentDTO = Omit<
  TournamentDocument,
  '_id' | 'createdAt' | 'updatedAt' | 'finalMatchId' | 'winnerTeamId' | 'goldenBootPlayerId' | 'rules'
> & {
  rules?: Partial<TournamentRules>;
};

export type UpdateTournamentDTO = Partial<
  Omit<TournamentDocument, '_id' | 'createdAt' | 'updatedAt'>
>;

export type CreateTournamentTeamDTO = Omit<
  TournamentTeamDocument,
  '_id' | 'createdAt' | 'updatedAt'
>;

export type UpdateTournamentTeamDTO = Partial<
  Omit<TournamentTeamDocument, '_id' | 'tournamentId' | 'createdAt' | 'updatedAt'>
>;

export type CreateTournamentMatchDTO = Omit<
  TournamentMatchDocument,
  '_id' | 'createdAt' | 'updatedAt'
>;

export type UpdateTournamentMatchDTO = Partial<
  Omit<TournamentMatchDocument, '_id' | 'tournamentId' | 'createdAt' | 'updatedAt'>
>;

// Calculation outputs
export interface TeamStanding {
  rank: number;
  teamId: ObjectId;
  teamName: string;
  teamShortCode?: string;
  teamLogo?: string;
  teamColor?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GoldenBootEntry {
  rank: number;
  playerId: ObjectId;
  playerFullName: string;
  jerseyNumber: number;
  position: string;
  photo?: string;
  teamId: ObjectId;
  teamName: string;
  teamColor?: string;
  goalsCount: number;
}
