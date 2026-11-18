import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import {
  FriendlySeriesDocument,
  CreateFriendlySeriesDTO,
  UpdateFriendlySeriesDTO,
  TeamSummary,
  TeamWithRoster,
} from '../types/friendly-series.types.js';

export class FriendlySeriesRepository {
  private static COLLECTION_NAME = 'friendly_series';

  private static get collection(): Collection<FriendlySeriesDocument> {
    return getDB().collection<FriendlySeriesDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateFriendlySeriesDTO): Promise<FriendlySeriesDocument> {
    const now = new Date();
    const teamAId =
      typeof data.teamAId === 'string' ? new ObjectId(data.teamAId) : data.teamAId;
    const teamBId =
      typeof data.teamBId === 'string' ? new ObjectId(data.teamBId) : data.teamBId;

    const doc: FriendlySeriesDocument = {
      ...data,
      teamAId,
      teamBId,
      status: data.status || 'upcoming',
      championTeamId: data.championTeamId || null,
      isDrawnSeries: data.isDrawnSeries ?? false,
      createdAt: now,
      updatedAt: now,
    };

    if (data.startDate && typeof data.startDate === 'string') {
      doc.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      doc.endDate = new Date(data.endDate);
    }

    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<FriendlySeriesDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findBySlug(slug: string): Promise<FriendlySeriesDocument | null> {
    return this.collection.findOne({ slug: slug.toLowerCase().trim() });
  }

  static async findAll(
    filter: Filter<FriendlySeriesDocument> = {}
  ): Promise<FriendlySeriesDocument[]> {
    return this.collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  static async findWithPagination(
    filter: Filter<FriendlySeriesDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<FriendlySeriesDocument[]> {
    const sort = options.sort || { createdAt: -1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  static async count(filter: Filter<FriendlySeriesDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  static async update(
    id: string | ObjectId,
    data: UpdateFriendlySeriesDTO
  ): Promise<FriendlySeriesDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: Partial<FriendlySeriesDocument> = { ...data };

    if (data.teamAId && typeof data.teamAId === 'string') {
      updateData.teamAId = new ObjectId(data.teamAId);
    }
    if (data.teamBId && typeof data.teamBId === 'string') {
      updateData.teamBId = new ObjectId(data.teamBId);
    }
    if (data.championTeamId && typeof data.championTeamId === 'string') {
      updateData.championTeamId = new ObjectId(data.championTeamId);
    }
    if (data.startDate && typeof data.startDate === 'string') {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      updateData.endDate = new Date(data.endDate);
    }

    const updateDoc: UpdateFilter<FriendlySeriesDocument> = {
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

  static async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  /**
   * Helper to fetch an academy team by ID from existing tournament_teams (or teams).
   * Validates team existence and extracts safe summary info.
   */
  static async findTeamById(teamId: string | ObjectId): Promise<TeamSummary | null> {
    const objectId = typeof teamId === 'string' ? new ObjectId(teamId) : teamId;
    const db = getDB();

    // Check tournament_teams first
    const teamDoc = await db.collection('tournament_teams').findOne(
      { _id: objectId },
      { projection: { _id: 1, name: 1, shortCode: 1, logo: 1, color: 1 } }
    );

    if (teamDoc) {
      return {
        _id: teamDoc._id,
        name: teamDoc.name,
        shortCode: teamDoc.shortCode,
        logo: teamDoc.logo,
        color: teamDoc.color,
      };
    }

    // Fallback: check generic 'teams' collection if it exists
    const genericTeam = await db.collection('teams').findOne(
      { _id: objectId },
      { projection: { _id: 1, name: 1, shortCode: 1, logo: 1, color: 1 } }
    );

    if (genericTeam) {
      return {
        _id: genericTeam._id,
        name: genericTeam.name,
        shortCode: genericTeam.shortCode,
        logo: genericTeam.logo,
        color: genericTeam.color,
      };
    }

    return null;
  }

  /**
   * Helper to fetch an academy team along with its registered player IDs roster.
   */
  static async findTeamWithRoster(teamId: string | ObjectId): Promise<TeamWithRoster | null> {
    const objectId = typeof teamId === 'string' ? new ObjectId(teamId) : teamId;
    const db = getDB();

    const teamDoc = await db.collection('tournament_teams').findOne(
      { _id: objectId },
      { projection: { _id: 1, name: 1, shortCode: 1, logo: 1, color: 1, playerIds: 1 } }
    );

    if (teamDoc) {
      return {
        _id: teamDoc._id,
        name: teamDoc.name,
        shortCode: teamDoc.shortCode,
        logo: teamDoc.logo,
        color: teamDoc.color,
        playerIds: (teamDoc.playerIds || []).map((pid: any) =>
          typeof pid === 'string' ? new ObjectId(pid) : pid
        ),
      };
    }

    const genericTeam = await db.collection('teams').findOne(
      { _id: objectId },
      { projection: { _id: 1, name: 1, shortCode: 1, logo: 1, color: 1, playerIds: 1 } }
    );

    if (genericTeam) {
      return {
        _id: genericTeam._id,
        name: genericTeam.name,
        shortCode: genericTeam.shortCode,
        logo: genericTeam.logo,
        color: genericTeam.color,
        playerIds: (genericTeam.playerIds || []).map((pid: any) =>
          typeof pid === 'string' ? new ObjectId(pid) : pid
        ),
      };
    }

    return null;
  }
}
