import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import {
  TournamentDocument,
  CreateTournamentDTO,
  UpdateTournamentDTO,
  TournamentTeamDocument,
  CreateTournamentTeamDTO,
  UpdateTournamentTeamDTO,
  TournamentRules,
} from '../types/tournament.types.js';

const DEFAULT_TOURNAMENT_RULES: TournamentRules = {
  minTeams: 3,
  maxTeams: null,
  minPlayersPerTeam: 5,
  maxPlayersPerTeam: 6,
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  hasExtraTimeInFinal: true,
  hasPenaltiesInFinal: true,
};

export class TournamentRepository {
  private static COLLECTION_NAME = 'tournaments';

  private static get collection(): Collection<TournamentDocument> {
    return getDB().collection<TournamentDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateTournamentDTO): Promise<TournamentDocument> {
    const now = new Date();
    const doc: TournamentDocument = {
      ...data,
      status: data.status || 'draft',
      rules: {
        ...DEFAULT_TOURNAMENT_RULES,
        ...(data.rules || {}),
      },
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<TournamentDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findBySlug(slug: string): Promise<TournamentDocument | null> {
    return this.collection.findOne({ slug: slug.toLowerCase().trim() });
  }

  static async findAll(filter: Filter<TournamentDocument> = {}): Promise<TournamentDocument[]> {
    return this.collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  static async findWithPagination(
    filter: Filter<TournamentDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<TournamentDocument[]> {
    const sort = options.sort || { createdAt: -1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  static async count(filter: Filter<TournamentDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  static async update(
    id: string | ObjectId,
    data: UpdateTournamentDTO
  ): Promise<TournamentDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: Partial<TournamentDocument> = { ...data };

    if (data.finalMatchId && typeof data.finalMatchId === 'string') {
      updateData.finalMatchId = new ObjectId(data.finalMatchId);
    }
    if (data.winnerTeamId && typeof data.winnerTeamId === 'string') {
      updateData.winnerTeamId = new ObjectId(data.winnerTeamId);
    }
    if (data.goldenBootPlayerId && typeof data.goldenBootPlayerId === 'string') {
      updateData.goldenBootPlayerId = new ObjectId(data.goldenBootPlayerId);
    }

    const updateDoc: UpdateFilter<TournamentDocument> = {
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
}

export class TournamentTeamRepository {
  private static COLLECTION_NAME = 'tournament_teams';

  private static get collection(): Collection<TournamentTeamDocument> {
    return getDB().collection<TournamentTeamDocument>(this.COLLECTION_NAME);
  }

  static async create(data: CreateTournamentTeamDTO): Promise<TournamentTeamDocument> {
    const now = new Date();
    const tournamentId =
      typeof data.tournamentId === 'string'
        ? new ObjectId(data.tournamentId)
        : data.tournamentId;

    const playerIds = data.playerIds.map((pid) =>
      typeof pid === 'string' ? new ObjectId(pid) : pid
    );

    const doc: TournamentTeamDocument = {
      ...data,
      tournamentId,
      playerIds,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<TournamentTeamDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  static async findByTournamentId(
    tournamentId: string | ObjectId
  ): Promise<TournamentTeamDocument[]> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    return this.collection.find({ tournamentId: tId }).sort({ name: 1 }).toArray();
  }

  static async countByTournamentId(tournamentId: string | ObjectId): Promise<number> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    return this.collection.countDocuments({ tournamentId: tId });
  }

  static async update(
    id: string | ObjectId,
    data: UpdateTournamentTeamDTO
  ): Promise<TournamentTeamDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: Partial<TournamentTeamDocument> = { ...data };

    if (data.playerIds) {
      updateData.playerIds = data.playerIds.map((pid) =>
        typeof pid === 'string' ? new ObjectId(pid) : pid
      );
    }

    const updateDoc: UpdateFilter<TournamentTeamDocument> = {
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

  static async deleteByTournamentId(tournamentId: string | ObjectId): Promise<number> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    const result = await this.collection.deleteMany({ tournamentId: tId });
    return result.deletedCount;
  }

  /**
   * Finds any teams in the specified tournament that already contain ANY of the given player IDs.
   * Ensures that no player belongs to multiple teams in the same tournament.
   */
  static async findTeamsWithAnyPlayer(
    tournamentId: string | ObjectId,
    playerIds: (string | ObjectId)[],
    excludeTeamId?: string | ObjectId
  ): Promise<TournamentTeamDocument[]> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    const pIds = playerIds.map((pid) =>
      typeof pid === 'string' ? new ObjectId(pid) : pid
    );

    const filter: Filter<TournamentTeamDocument> = {
      tournamentId: tId,
      playerIds: { $in: pIds },
    };

    if (excludeTeamId) {
      const exId =
        typeof excludeTeamId === 'string' ? new ObjectId(excludeTeamId) : excludeTeamId;
      filter._id = { $ne: exId };
    }

    return this.collection.find(filter).toArray();
  }

  /**
   * Verifies that all given player IDs exist in the existing 'players' collection.
   * Returns the count of found players and any missing IDs.
   */
  static async verifyPlayersExist(
    playerIds: (string | ObjectId)[]
  ): Promise<{ existingCount: number; missingIds: string[] }> {
    const pIds = playerIds.map((pid) =>
      typeof pid === 'string' ? new ObjectId(pid) : pid
    );

    const playersCollection = getDB().collection('players');
    const existingPlayers = await playersCollection
      .find({ _id: { $in: pIds } }, { projection: { _id: 1 } })
      .toArray();

    const existingIdSet = new Set(existingPlayers.map((p) => p._id.toString()));
    const missingIds = playerIds
      .map((pid) => pid.toString())
      .filter((idStr) => !existingIdSet.has(idStr));

    return {
      existingCount: existingPlayers.length,
      missingIds,
    };
  }
}
