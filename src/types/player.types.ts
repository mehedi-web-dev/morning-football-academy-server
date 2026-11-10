import { ObjectId } from 'mongodb';

export type PlayerPosition = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward';

export interface PlayerStatistics {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
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
  statistics: PlayerStatistics;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePlayerDTO = Omit<PlayerDocument, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdatePlayerDTO = Partial<CreatePlayerDTO>;
