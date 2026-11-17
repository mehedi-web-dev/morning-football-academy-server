import { Collection, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { getDB } from '../config/db.js';
import {
  TournamentMatchDocument,
  CreateTournamentMatchDTO,
  UpdateTournamentMatchDTO,
  TournamentStage,
  TournamentMatchStatus,
  MatchResultDetails,
  MatchGoalEvent,
} from '../types/tournament.types.js';

export interface MatchFilterOptions {
  stage?: TournamentStage;
  round?: number;
  status?: TournamentMatchStatus;
  teamId?: string | ObjectId;
}

export class TournamentMatchRepository {
  private static COLLECTION_NAME = 'tournament_matches';

  private static get collection(): Collection<TournamentMatchDocument> {
    return getDB().collection<TournamentMatchDocument>(this.COLLECTION_NAME);
  }

  /**
   * Bulk creates tournament match fixtures using insertMany.
   */
  static async createMany(
    matches: CreateTournamentMatchDTO[]
  ): Promise<TournamentMatchDocument[]> {
    if (!matches || matches.length === 0) {
      return [];
    }

    const now = new Date();
    const docs: TournamentMatchDocument[] = matches.map((match) => {
      const tournamentId =
        typeof match.tournamentId === 'string'
          ? new ObjectId(match.tournamentId)
          : match.tournamentId;
      const homeTeamId =
        typeof match.homeTeamId === 'string'
          ? new ObjectId(match.homeTeamId)
          : match.homeTeamId;
      const awayTeamId =
        typeof match.awayTeamId === 'string'
          ? new ObjectId(match.awayTeamId)
          : match.awayTeamId;

      const goals: MatchGoalEvent[] = (match.goals || []).map((g) => ({
        ...g,
        playerId: typeof g.playerId === 'string' ? new ObjectId(g.playerId) : g.playerId,
        teamId: typeof g.teamId === 'string' ? new ObjectId(g.teamId) : g.teamId,
      }));

      const doc: TournamentMatchDocument = {
        ...match,
        tournamentId,
        homeTeamId,
        awayTeamId,
        goals,
        createdAt: now,
        updatedAt: now,
      };

      if (match.matchDate) {
        doc.matchDate =
          typeof match.matchDate === 'string' ? new Date(match.matchDate) : match.matchDate;
      }

      return doc;
    });

    const result = await this.collection.insertMany(docs);
    return docs.map((doc, index) => ({
      ...doc,
      _id: result.insertedIds[index],
    }));
  }

  /**
   * Creates a single tournament match (e.g. creating the final match fixture).
   */
  static async create(match: CreateTournamentMatchDTO): Promise<TournamentMatchDocument> {
    const now = new Date();
    const tournamentId =
      typeof match.tournamentId === 'string'
        ? new ObjectId(match.tournamentId)
        : match.tournamentId;
    const homeTeamId =
      typeof match.homeTeamId === 'string'
        ? new ObjectId(match.homeTeamId)
        : match.homeTeamId;
    const awayTeamId =
      typeof match.awayTeamId === 'string'
        ? new ObjectId(match.awayTeamId)
        : match.awayTeamId;

    const goals: MatchGoalEvent[] = (match.goals || []).map((g) => ({
      ...g,
      playerId: typeof g.playerId === 'string' ? new ObjectId(g.playerId) : g.playerId,
      teamId: typeof g.teamId === 'string' ? new ObjectId(g.teamId) : g.teamId,
    }));

    const doc: TournamentMatchDocument = {
      ...match,
      tournamentId,
      homeTeamId,
      awayTeamId,
      goals,
      createdAt: now,
      updatedAt: now,
    };

    if (match.matchDate) {
      doc.matchDate =
        typeof match.matchDate === 'string' ? new Date(match.matchDate) : match.matchDate;
    }

    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  /**
   * Finds a tournament match by its MongoDB ObjectId.
   */
  static async findById(id: string | ObjectId): Promise<TournamentMatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return this.collection.findOne({ _id: objectId });
  }

  /**
   * Finds a match by tournament ID and match number (1-15 for league, 16 for final).
   */
  static async findByTournamentAndMatchNumber(
    tournamentId: string | ObjectId,
    matchNumber: number
  ): Promise<TournamentMatchDocument | null> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    return this.collection.findOne({ tournamentId: tId, matchNumber });
  }

  /**
   * Lists matches by tournament with optional stage, round, status, or team filters.
   */
  static async findMatches(
    tournamentId: string | ObjectId,
    filter?: MatchFilterOptions
  ): Promise<TournamentMatchDocument[]> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;

    const query: Filter<TournamentMatchDocument> = { tournamentId: tId };

    if (filter?.stage) {
      query.stage = filter.stage;
    }
    if (filter?.round !== undefined) {
      query.round = filter.round;
    }
    if (filter?.status) {
      query.status = filter.status;
    }
    if (filter?.teamId) {
      const teamObjectId =
        typeof filter.teamId === 'string' ? new ObjectId(filter.teamId) : filter.teamId;
      query.$or = [{ homeTeamId: teamObjectId }, { awayTeamId: teamObjectId }];
    }

    return this.collection.find(query).sort({ matchNumber: 1 }).toArray();
  }

  /**
   * Lists all matches matching a generic filter.
   */
  static async findAll(
    filter: Filter<TournamentMatchDocument> = {}
  ): Promise<TournamentMatchDocument[]> {
    return this.collection.find(filter).sort({ matchNumber: 1 }).toArray();
  }

  /**
   * Finds matches with pagination and sorting.
   */
  static async findWithPagination(
    filter: Filter<TournamentMatchDocument> = {},
    options: { skip: number; limit: number; sort?: Record<string, 1 | -1> }
  ): Promise<TournamentMatchDocument[]> {
    const sort = options.sort || { matchNumber: 1 };
    return this.collection
      .find(filter)
      .sort(sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();
  }

  /**
   * Counts matches matching a filter.
   */
  static async count(filter: Filter<TournamentMatchDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  /**
   * Updates match schedule (date, kickoff time, venue, status).
   */
  static async updateSchedule(
    id: string | ObjectId,
    schedule: {
      matchDate?: Date | string;
      kickOffTime?: string;
      venue?: string;
      status?: TournamentMatchStatus;
    }
  ): Promise<TournamentMatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: Partial<TournamentMatchDocument> = {};

    if (schedule.matchDate !== undefined) {
      updateData.matchDate =
        typeof schedule.matchDate === 'string'
          ? new Date(schedule.matchDate)
          : schedule.matchDate;
    }
    if (schedule.kickOffTime !== undefined) {
      updateData.kickOffTime = schedule.kickOffTime;
    }
    if (schedule.venue !== undefined) {
      updateData.venue = schedule.venue;
    }
    if (schedule.status !== undefined) {
      updateData.status = schedule.status;
    }

    const updateDoc: UpdateFilter<TournamentMatchDocument> = {
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

  /**
   * Updates match result: scores, extra time, penalty shootout, winner, and player goal events.
   * Goals array contains regular and extra time goals only; penalty shootout kicks are never stored in goals.
   */
  static async updateResult(
    id: string | ObjectId,
    data: {
      result: MatchResultDetails;
      goals: MatchGoalEvent[];
      status?: TournamentMatchStatus;
    }
  ): Promise<TournamentMatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const sanitizedResult: MatchResultDetails = {
      ...data.result,
      winnerTeamId: data.result.winnerTeamId
        ? typeof data.result.winnerTeamId === 'string'
          ? new ObjectId(data.result.winnerTeamId)
          : data.result.winnerTeamId
        : data.result.winnerTeamId === null
        ? null
        : undefined,
    };

    const sanitizedGoals: MatchGoalEvent[] = data.goals.map((g) => ({
      ...g,
      playerId: typeof g.playerId === 'string' ? new ObjectId(g.playerId) : g.playerId,
      teamId: typeof g.teamId === 'string' ? new ObjectId(g.teamId) : g.teamId,
    }));

    const updateDoc: UpdateFilter<TournamentMatchDocument> = {
      $set: {
        result: sanitizedResult,
        goals: sanitizedGoals,
        status: data.status || 'completed',
        updatedAt: new Date(),
      },
    };

    return this.collection.findOneAndUpdate(
      { _id: objectId },
      updateDoc,
      { returnDocument: 'after' }
    );
  }

  /**
   * Counts completed league matches in a tournament (total 15 for complete round robin).
   */
  static async countCompletedLeagueMatches(
    tournamentId: string | ObjectId
  ): Promise<number> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    return this.collection.countDocuments({
      tournamentId: tId,
      stage: 'league',
      status: 'completed',
    });
  }

  /**
   * Retrieves all completed league matches in a tournament for league table / standings calculation.
   */
  static async findCompletedLeagueMatches(
    tournamentId: string | ObjectId
  ): Promise<TournamentMatchDocument[]> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    return this.collection
      .find({
        tournamentId: tId,
        stage: 'league',
        status: 'completed',
      })
      .sort({ matchNumber: 1 })
      .toArray();
  }

  /**
   * Retrieves all completed matches in a tournament (league + final) for Golden Boot calculation.
   */
  static async findCompletedTournamentMatches(
    tournamentId: string | ObjectId
  ): Promise<TournamentMatchDocument[]> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    return this.collection
      .find({
        tournamentId: tId,
        status: 'completed',
      })
      .sort({ matchNumber: 1 })
      .toArray();
  }

  /**
   * Checks whether fixtures already exist for the tournament.
   */
  static async hasFixtures(tournamentId: string | ObjectId): Promise<boolean> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    const match = await this.collection.findOne(
      { tournamentId: tId },
      { projection: { _id: 1 } }
    );
    return match !== null;
  }

  /**
   * General update method for match document.
   */
  static async update(
    id: string | ObjectId,
    data: UpdateTournamentMatchDTO
  ): Promise<TournamentMatchDocument | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: Partial<TournamentMatchDocument> = { ...data };

    if (data.homeTeamId && typeof data.homeTeamId === 'string') {
      updateData.homeTeamId = new ObjectId(data.homeTeamId);
    }
    if (data.awayTeamId && typeof data.awayTeamId === 'string') {
      updateData.awayTeamId = new ObjectId(data.awayTeamId);
    }
    if (data.matchDate && typeof data.matchDate === 'string') {
      updateData.matchDate = new Date(data.matchDate);
    }
    if (data.goals) {
      updateData.goals = data.goals.map((g) => ({
        ...g,
        playerId: typeof g.playerId === 'string' ? new ObjectId(g.playerId) : g.playerId,
        teamId: typeof g.teamId === 'string' ? new ObjectId(g.teamId) : g.teamId,
      }));
    }
    if (data.result && data.result.winnerTeamId && typeof data.result.winnerTeamId === 'string') {
      updateData.result = {
        ...data.result,
        winnerTeamId: new ObjectId(data.result.winnerTeamId),
      };
    }

    const updateDoc: UpdateFilter<TournamentMatchDocument> = {
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

  /**
   * Deletes a single match by ID.
   */
  static async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  /**
   * Deletes all matches associated with a tournament.
   */
  static async deleteByTournamentId(tournamentId: string | ObjectId): Promise<number> {
    const tId =
      typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    const result = await this.collection.deleteMany({ tournamentId: tId });
    return result.deletedCount;
  }
}
