import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import {
  FriendlySeriesMatchDocument,
  CreateFriendlyMatchDTO,
  UpdateFriendlyMatchDTO,
  FriendlyMatchResult,
  FriendlyMatchGoalEvent,
} from '../types/friendly-series.types.js';

export class FriendlySeriesMatchRepository {
  private static COLLECTION_NAME = 'friendly_series_matches';

  private static get collection(): Collection<FriendlySeriesMatchDocument> {
    return getDB().collection<FriendlySeriesMatchDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateFriendlyMatchDTO): Promise<FriendlySeriesMatchDocument> {
    const now = new Date();
    const seriesId =
      typeof data.seriesId === 'string' ? new ObjectId(data.seriesId) : data.seriesId;
    const homeTeamId =
      typeof data.homeTeamId === 'string' ? new ObjectId(data.homeTeamId) : data.homeTeamId;
    const awayTeamId =
      typeof data.awayTeamId === 'string' ? new ObjectId(data.awayTeamId) : data.awayTeamId;

    const goals: FriendlyMatchGoalEvent[] = (data.goals || []).map((g) => ({
      ...g,
      playerId: typeof g.playerId === 'string' ? new ObjectId(g.playerId) : g.playerId,
      teamId: typeof g.teamId === 'string' ? new ObjectId(g.teamId) : g.teamId,
    }));

    const doc: FriendlySeriesMatchDocument = {
      ...data,
      seriesId,
      homeTeamId,
      awayTeamId,
      status: data.status || 'scheduled',
      goals,
      createdAt: now,
      updatedAt: now,
    };

    if (data.matchDate && typeof data.matchDate === 'string') {
      doc.matchDate = new Date(data.matchDate);
    }

    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<FriendlySeriesMatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findBySeriesAndMatchNumber(
    seriesId: string | ObjectId,
    matchNumber: number
  ): Promise<FriendlySeriesMatchDocument | null> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    return this.collection.findOne({ seriesId: sId, matchNumber });
  }

  static async findBySeriesId(
    seriesId: string | ObjectId,
    filter: Filter<FriendlySeriesMatchDocument> = {}
  ): Promise<FriendlySeriesMatchDocument[]> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    return this.collection
      .find({ seriesId: sId, ...filter })
      .sort({ matchNumber: 1 })
      .toArray();
  }

  static async countBySeriesId(seriesId: string | ObjectId): Promise<number> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    return this.collection.countDocuments({ seriesId: sId });
  }

  static async countCompletedBySeriesId(seriesId: string | ObjectId): Promise<number> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    return this.collection.countDocuments({ seriesId: sId, status: 'completed' });
  }

  static async update(
    id: string | ObjectId,
    data: UpdateFriendlyMatchDTO
  ): Promise<FriendlySeriesMatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const { homeTeamId, awayTeamId, ...rest } = data;
    const updateData: Partial<FriendlySeriesMatchDocument> = { ...rest };

    if (homeTeamId) {
      updateData.homeTeamId =
        typeof homeTeamId === 'string' ? new ObjectId(homeTeamId) : homeTeamId;
    }
    if (awayTeamId) {
      updateData.awayTeamId =
        typeof awayTeamId === 'string' ? new ObjectId(awayTeamId) : awayTeamId;
    }
    if (data.matchDate && typeof data.matchDate === 'string') {
      updateData.matchDate = new Date(data.matchDate);
    }

    const updateDoc: UpdateFilter<FriendlySeriesMatchDocument> = {
      $set: {
        ...updateData,
        updatedAt: new Date(),
      },
    };

    return this.collection.findOneAndUpdate(
      { _id: objectId },
      updateDoc,
      { returnDocument: 'after' }
    );
  }

  static async updateResult(
    id: string | ObjectId,
    result: FriendlyMatchResult
  ): Promise<FriendlySeriesMatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const sanitizedGoals: FriendlyMatchGoalEvent[] = (result.goals || []).map((g) => ({
      ...g,
      playerId: typeof g.playerId === 'string' ? new ObjectId(g.playerId) : g.playerId,
      teamId: typeof g.teamId === 'string' ? new ObjectId(g.teamId) : g.teamId,
    }));

    const sanitizedResult: FriendlyMatchResult = {
      ...result,
      winnerTeamId: result.winnerTeamId
        ? typeof result.winnerTeamId === 'string'
          ? new ObjectId(result.winnerTeamId)
          : result.winnerTeamId
        : null,
      goals: sanitizedGoals,
    };

    const updateDoc: UpdateFilter<FriendlySeriesMatchDocument> = {
      $set: {
        result: sanitizedResult,
        goals: sanitizedGoals,
        status: 'completed',
        updatedAt: new Date(),
      },
    };

    return this.collection.findOneAndUpdate(
      { _id: objectId },
      updateDoc,
      { returnDocument: 'after' }
    );
  }

  static async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  static async deleteBySeriesId(seriesId: string | ObjectId): Promise<number> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const result = await this.collection.deleteMany({ seriesId: sId });
    return result.deletedCount;
  }
}
