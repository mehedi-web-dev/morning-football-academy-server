import { ObjectId } from 'mongodb';

export type PlayerPosition = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward';
export type PlayerStatus = 'active' | 'injured' | 'inactive';
export type DominantFoot = 'right' | 'left' | 'both';

export interface PlayerStatistics {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  minutesPlayed?: number;
  yellowCards?: number;
  redCards?: number;
  rating?: number;
  manOfTheMatch?: number;
  saves?: number;
}

export interface PlayerDocument {
  _id?: ObjectId;
  fullName: string;
  slug: string;
  jerseyNumber: number;
  position: PlayerPosition | string;
  nationality: string;
  dateOfBirth: Date;
  height?: string;
  weight?: string;
  bio?: string;
  photo: string;
  phoneNumber?: string;
  email?: string;
  currentAddress?: string;
  guardianName?: string;
  guardianPhone?: string;
  secondaryPosition?: string;
  dominantFoot?: DominantFoot;
  playingExperienceYears?: number;
  previousClub?: string;
  previousTournaments?: string;
  achievements?: string;
  playerStatus?: PlayerStatus;
  joiningDate?: Date;
  trainingGroup?: string;
  coachNotes?: string;
  statistics: PlayerStatistics;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePlayerDTO = Omit<PlayerDocument, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdatePlayerDTO = Partial<CreatePlayerDTO>;
