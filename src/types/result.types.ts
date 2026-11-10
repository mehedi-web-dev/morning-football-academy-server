import { ObjectId } from 'mongodb';

export interface ResultDocument {
  _id?: ObjectId;
  matchId: ObjectId;
  opponent: string;
  homeScore: number;
  awayScore: number;
  matchDate: Date;
  competition: string;
  venue: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateResultDTO = Omit<ResultDocument, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateResultDTO = Partial<CreateResultDTO>;
