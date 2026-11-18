import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';
import { FriendlySeriesRepository } from '../repositories/friendly-series.repository.js';
import { FriendlySeriesMatchRepository } from '../repositories/friendly-series-match.repository.js';
import {
  FriendlySeriesDocument,
  FriendlySeriesMatchDocument,
  FriendlySeriesFormat,
  FriendlySeriesStatus,
  FriendlySeriesStats,
  FriendlyMatchResult,
  FriendlyMatchGoalEvent,
  TopGoalScorerEntry,
  FriendlySeriesTeamPlayersResponse,
  FriendlySeriesDetailResponse,
  UpdateFriendlySeriesDTO,
} from '../types/friendly-series.types.js';
import {
  createFriendlySeriesSchema,
  updateFriendlySeriesSchema,
  scheduleFriendlyMatchSchema,
  updateFriendlyMatchScheduleSchema,
  submitFriendlyMatchResultSchema,
} from '../validators/friendly-series.validator.js';
import { AppError } from '../middleware/error.middleware.js';
import { toPublicPlayer } from '../utils/publicPlayer.js';

export class AppServiceError extends Error implements AppError {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppServiceError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppServiceError.prototype);
  }
}

export class FriendlySeriesService {
  // Format configurations
  static readonly FORMAT_CONFIG: Record<
    FriendlySeriesFormat,
    { maxMatches: number; requiredWins: number }
  > = {
    best_of_3: { maxMatches: 3, requiredWins: 2 },
    best_of_5: { maxMatches: 5, requiredWins: 3 },
  };

  // ==========================================
  // 1. SERIES MANAGEMENT
  // ==========================================

  /**
   * Creates a new Friendly Series between exactly two existing academy teams.
   */
  static async createSeries(data: unknown): Promise<FriendlySeriesDocument> {
    const validated = createFriendlySeriesSchema.parse(data);

    // Check slug uniqueness
    const existingSlug = await FriendlySeriesRepository.findBySlug(validated.slug);
    if (existingSlug) {
      throw new AppServiceError(
        `Friendly series with slug "${validated.slug}" already exists`,
        409
      );
    }

    const teamAObjectId = new ObjectId(validated.teamAId);
    const teamBObjectId = new ObjectId(validated.teamBId);

    // Validate that both teams exist in the academy database
    const [teamA, teamB] = await Promise.all([
      FriendlySeriesRepository.findTeamById(teamAObjectId),
      FriendlySeriesRepository.findTeamById(teamBObjectId),
    ]);

    if (!teamA) {
      throw new AppServiceError(
        `Team A (ID: ${validated.teamAId}) does not exist in the academy database`,
        404
      );
    }
    if (!teamB) {
      throw new AppServiceError(
        `Team B (ID: ${validated.teamBId}) does not exist in the academy database`,
        404
      );
    }

    return FriendlySeriesRepository.create({
      name: validated.name,
      slug: validated.slug,
      season: validated.season,
      description: validated.description,
      format: validated.format,
      teamAId: teamAObjectId,
      teamBId: teamBObjectId,
      status: 'upcoming',
      startDate: validated.startDate,
      endDate: validated.endDate,
      venue: validated.venue,
      championTeamId: null,
      isDrawnSeries: false,
    });
  }

  static async getSeriesById(id: string | ObjectId): Promise<FriendlySeriesDetailResponse> {
    const series = await FriendlySeriesRepository.findById(id);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }
    return this.buildDetailResponse(series);
  }

  static async getSeriesBySlug(slug: string): Promise<FriendlySeriesDetailResponse> {
    const series = await FriendlySeriesRepository.findBySlug(slug);
    if (!series) {
      throw new AppServiceError(`Friendly series with slug "${slug}" not found`, 404);
    }
    return this.buildDetailResponse(series);
  }

  static async listSeries(options: {
    page?: number;
    limit?: number;
    status?: FriendlySeriesStatus;
    format?: FriendlySeriesFormat;
    season?: string;
    teamId?: string | ObjectId;
  }): Promise<{
    series: FriendlySeriesDetailResponse[];
    total: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (options.status) filter.status = options.status;
    if (options.format) filter.format = options.format;
    if (options.season) filter.season = options.season;
    if (options.teamId) {
      const tId = typeof options.teamId === 'string' ? new ObjectId(options.teamId) : options.teamId;
      filter.$or = [{ teamAId: tId }, { teamBId: tId }];
    }

    const [docs, total] = await Promise.all([
      FriendlySeriesRepository.findWithPagination(filter, { skip, limit }),
      FriendlySeriesRepository.count(filter),
    ]);

    const seriesWithDetails = await Promise.all(
      docs.map((doc) => this.buildDetailResponse(doc))
    );

    return { series: seriesWithDetails, total };
  }

  static async updateSeries(
    id: string | ObjectId,
    data: unknown
  ): Promise<FriendlySeriesDocument> {
    const series = await FriendlySeriesRepository.findById(id);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }

    const validated = updateFriendlySeriesSchema.parse(data);

    if (validated.slug && validated.slug !== series.slug) {
      const existing = await FriendlySeriesRepository.findBySlug(validated.slug);
      if (existing) {
        throw new AppServiceError(
          `Friendly series with slug "${validated.slug}" already exists`,
          409
        );
      }
    }

    const updated = await FriendlySeriesRepository.update(id, validated as UpdateFriendlySeriesDTO);
    if (!updated) {
      throw new AppServiceError('Failed to update friendly series', 500);
    }
    return updated;
  }

  static async deleteSeries(id: string | ObjectId): Promise<boolean> {
    const series = await FriendlySeriesRepository.findById(id);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }

    // Cascade delete matches
    await FriendlySeriesMatchRepository.deleteBySeriesId(id);
    return FriendlySeriesRepository.delete(id);
  }

  // ==========================================
  // 2. MATCH MANAGEMENT
  // ==========================================

  /**
   * Schedules a match in the friendly series.
   * Enforces format maximums (3 for bo3, 5 for bo5) and prevents scheduling
   * after the series is already completed.
   */
  static async scheduleMatch(
    seriesId: string | ObjectId,
    data: unknown
  ): Promise<FriendlySeriesMatchDocument> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const series = await FriendlySeriesRepository.findById(sId);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }

    if (series.status === 'completed') {
      throw new AppServiceError(
        'Cannot schedule matches: Friendly series is already completed',
        400
      );
    }
    if (series.status === 'cancelled') {
      throw new AppServiceError(
        'Cannot schedule matches: Friendly series is cancelled',
        400
      );
    }

    const config = this.FORMAT_CONFIG[series.format];
    const validated = scheduleFriendlyMatchSchema.parse(data);

    const homeTeamObjectId = new ObjectId(validated.homeTeamId);
    const awayTeamObjectId = new ObjectId(validated.awayTeamId);

    // Validate that home and away teams match the series teams (teamA and teamB)
    const validTeamIds = [series.teamAId.toString(), series.teamBId.toString()];
    if (
      !validTeamIds.includes(homeTeamObjectId.toString()) ||
      !validTeamIds.includes(awayTeamObjectId.toString())
    ) {
      throw new AppServiceError(
        'Match teams must be the two teams assigned to this friendly series',
        400
      );
    }

    // Determine match number: if not provided, auto-assign next available number
    const existingMatches = await FriendlySeriesMatchRepository.findBySeriesId(sId);
    const existingNumbers = new Set(existingMatches.map((m) => m.matchNumber));

    let matchNumber = validated.matchNumber;
    if (!matchNumber) {
      matchNumber = existingMatches.length + 1;
    }

    if (matchNumber > config.maxMatches) {
      throw new AppServiceError(
        `Match number ${matchNumber} exceeds the maximum of ${config.maxMatches} matches for ${series.format}`,
        400
      );
    }

    if (existingNumbers.has(matchNumber)) {
      throw new AppServiceError(
        `Match #${matchNumber} already exists in this friendly series`,
        409
      );
    }

    return FriendlySeriesMatchRepository.create({
      seriesId: sId,
      matchNumber,
      homeTeamId: homeTeamObjectId,
      awayTeamId: awayTeamObjectId,
      matchDate: validated.matchDate,
      kickOffTime: validated.kickOffTime,
      venue: validated.venue || series.venue,
      status: validated.status || 'scheduled',
    });
  }

  static async updateMatchSchedule(
    seriesId: string | ObjectId,
    matchId: string | ObjectId,
    data: unknown
  ): Promise<FriendlySeriesMatchDocument> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const mId = typeof matchId === 'string' ? new ObjectId(matchId) : matchId;

    const [series, match] = await Promise.all([
      FriendlySeriesRepository.findById(sId),
      FriendlySeriesMatchRepository.findById(mId),
    ]);

    if (!series) throw new AppServiceError('Friendly series not found', 404);
    if (!match) throw new AppServiceError('Friendly match not found', 404);
    if (!match.seriesId.equals(sId)) {
      throw new AppServiceError('Match does not belong to the specified friendly series', 400);
    }

    const validated = updateFriendlyMatchScheduleSchema.parse(data);

    if (validated.homeTeamId || validated.awayTeamId) {
      const newHome = validated.homeTeamId
        ? new ObjectId(validated.homeTeamId)
        : match.homeTeamId;
      const newAway = validated.awayTeamId
        ? new ObjectId(validated.awayTeamId)
        : match.awayTeamId;

      const validTeamIds = [series.teamAId.toString(), series.teamBId.toString()];
      if (
        !validTeamIds.includes(newHome.toString()) ||
        !validTeamIds.includes(newAway.toString())
      ) {
        throw new AppServiceError(
          'Match teams must be the two teams assigned to this friendly series',
          400
        );
      }
    }

    const updated = await FriendlySeriesMatchRepository.update(mId, validated);
    if (!updated) {
      throw new AppServiceError('Failed to update match schedule', 500);
    }
    return updated;
  }

  static async getMatches(seriesId: string | ObjectId): Promise<FriendlySeriesMatchDocument[]> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    return FriendlySeriesMatchRepository.findBySeriesId(sId);
  }

  static async getMatchById(
    seriesId: string | ObjectId,
    matchId: string | ObjectId
  ): Promise<FriendlySeriesMatchDocument> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const mId = typeof matchId === 'string' ? new ObjectId(matchId) : matchId;

    const match = await FriendlySeriesMatchRepository.findById(mId);
    if (!match) {
      throw new AppServiceError('Friendly match not found', 404);
    }
    if (!match.seriesId.equals(sId)) {
      throw new AppServiceError('Match does not belong to the specified friendly series', 400);
    }
    return match;
  }

  // ==========================================
  // 3. MATCH RESULT & STANDINGS RECALCULATION
  // ==========================================

  /**
   * Enters or corrects a match result in a friendly series.
   * If the match is not yet completed, prevents entering new results if the series
   * is already completed.
   * Authorized admin corrections of already completed matches are always permitted
   * and dynamically recompute the entire series status and champion.
   */
  static async submitMatchResult(
    seriesId: string | ObjectId,
    matchId: string | ObjectId,
    data: unknown
  ): Promise<{ match: FriendlySeriesMatchDocument; stats: FriendlySeriesStats }> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const mId = typeof matchId === 'string' ? new ObjectId(matchId) : matchId;

    const [series, match] = await Promise.all([
      FriendlySeriesRepository.findById(sId),
      FriendlySeriesMatchRepository.findById(mId),
    ]);

    if (!series) throw new AppServiceError('Friendly series not found', 404);
    if (!match) throw new AppServiceError('Friendly match not found', 404);
    if (!match.seriesId.equals(sId)) {
      throw new AppServiceError('Match does not belong to the specified friendly series', 400);
    }
    if (series.status === 'cancelled') {
      throw new AppServiceError('Cannot submit result for a cancelled series', 400);
    }
    if (match.status === 'cancelled') {
      throw new AppServiceError('Cannot submit result for a cancelled match', 400);
    }

    // Do not allow new results if series is already completed, unless correcting an already completed match
    const isCorrection = match.status === 'completed';
    if (series.status === 'completed' && !isCorrection) {
      throw new AppServiceError(
        'Cannot submit match result: Friendly series is already completed',
        400
      );
    }

    const validated = submitFriendlyMatchResultSchema.parse(data);

    // Fetch home and away teams with player rosters to validate goal scorers
    const [homeTeam, awayTeam] = await Promise.all([
      FriendlySeriesRepository.findTeamWithRoster(match.homeTeamId),
      FriendlySeriesRepository.findTeamWithRoster(match.awayTeamId),
    ]);

    if (!homeTeam || !awayTeam) {
      throw new AppServiceError('One or both match teams could not be found in the database', 500);
    }

    const homePlayerIds = new Set(homeTeam.playerIds.map((p) => p.toString()));
    const awayPlayerIds = new Set(awayTeam.playerIds.map((p) => p.toString()));
    const homeTeamIdStr = match.homeTeamId.toString();
    const awayTeamIdStr = match.awayTeamId.toString();

    let calculatedHomeScore = 0;
    let calculatedAwayScore = 0;
    const validatedGoals: FriendlyMatchGoalEvent[] = [];

    if (validated.goals !== undefined) {
      if (validated.goals.length > 0) {
        const rawGoalPlayerIds = validated.goals.map((g) => new ObjectId(g.playerId));
        const db = getDB();
        const existingPlayers = await db
          .collection('players')
          .find({ _id: { $in: rawGoalPlayerIds } }, { projection: { _id: 1 } })
          .toArray();
        const existingPlayerIdSet = new Set(existingPlayers.map((p) => p._id.toString()));

        for (let i = 0; i < validated.goals.length; i++) {
          const goal = validated.goals[i];
          const pidStr = goal.playerId.toString();
          const tidStr = goal.teamId.toString();

          if (!existingPlayerIdSet.has(pidStr)) {
            throw new AppServiceError(
              `Goal #${i + 1}: Player ID (${goal.playerId}) does not exist in the academy database`,
              400
            );
          }

          if (tidStr !== homeTeamIdStr && tidStr !== awayTeamIdStr) {
            throw new AppServiceError(
              `Goal #${i + 1}: Credited team ID must match either the home or away team of this match`,
              400
            );
          }

          if (goal.type === 'normal') {
            if (tidStr === homeTeamIdStr) {
              if (!homePlayerIds.has(pidStr)) {
                throw new AppServiceError(
                  `Goal #${i + 1}: Scorer does not belong to credited home team (${homeTeam.name})`,
                  400
                );
              }
              calculatedHomeScore += 1;
            } else {
              if (!awayPlayerIds.has(pidStr)) {
                throw new AppServiceError(
                  `Goal #${i + 1}: Scorer does not belong to credited away team (${awayTeam.name})`,
                  400
                );
              }
              calculatedAwayScore += 1;
            }
          } else if (goal.type === 'own_goal') {
            // Own goal is credited to the beneficiary team, but scored by opponent
            if (tidStr === homeTeamIdStr) {
              if (!awayPlayerIds.has(pidStr)) {
                throw new AppServiceError(
                  `Goal #${i + 1}: Own-goal scorer credited to ${homeTeam.name} must belong to opponent ${awayTeam.name}`,
                  400
                );
              }
              calculatedHomeScore += 1;
            } else {
              if (!homePlayerIds.has(pidStr)) {
                throw new AppServiceError(
                  `Goal #${i + 1}: Own-goal scorer credited to ${awayTeam.name} must belong to opponent ${homeTeam.name}`,
                  400
                );
              }
              calculatedAwayScore += 1;
            }
          }

          validatedGoals.push({
            playerId: new ObjectId(pidStr),
            teamId: new ObjectId(tidStr),
            type: goal.type,
            minute: goal.minute,
          });
        }
      }

      // Verify football score consistency
      if (calculatedHomeScore !== validated.homeScore) {
        throw new AppServiceError(
          `Home score (${validated.homeScore}) does not match the total goal events credited to home team (${calculatedHomeScore})`,
          400
        );
      }
      if (calculatedAwayScore !== validated.awayScore) {
        throw new AppServiceError(
          `Away score (${validated.awayScore}) does not match the total goal events credited to away team (${calculatedAwayScore})`,
          400
        );
      }
    }

    // Determine winner or draw
    let winnerTeamId: ObjectId | null = null;
    let isDraw = false;

    if (validated.homeScore > validated.awayScore) {
      winnerTeamId = match.homeTeamId;
      isDraw = false;
    } else if (validated.awayScore > validated.homeScore) {
      winnerTeamId = match.awayTeamId;
      isDraw = false;
    } else {
      winnerTeamId = null;
      isDraw = true;
    }

    const matchResult: FriendlyMatchResult = {
      homeScore: validated.homeScore,
      awayScore: validated.awayScore,
      winnerTeamId,
      isDraw,
      notes: validated.notes,
      goals: validatedGoals,
    };

    // Update match result (replaces previous goals cleanly on corrections)
    const updatedMatch = await FriendlySeriesMatchRepository.updateResult(mId, matchResult);
    if (!updatedMatch) {
      throw new AppServiceError('Failed to record match result', 500);
    }

    // Recalculate entire series standings from scratch
    const stats = await this.recalculateSeriesStatus(sId);

    return { match: updatedMatch, stats };
  }

  /**
   * Recalculates series statistics and lifecycle status directly from completed matches.
   * Guarantees that:
   * - Draws do not increase wins or count as losses.
   * - Champion is assigned when a team reaches requiredWins.
   * - If maxMatches is completed and neither team reaches requiredWins, series is drawn.
   */
  static async recalculateSeriesStatus(seriesId: string | ObjectId): Promise<FriendlySeriesStats> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const series = await FriendlySeriesRepository.findById(sId);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }

    const matches = await FriendlySeriesMatchRepository.findBySeriesId(sId);
    const stats = this.computeStats(series, matches);

    // Update series document with authoritative recomputed status
    await FriendlySeriesRepository.update(sId, {
      status: stats.status,
      championTeamId: stats.championTeamId,
      isDrawnSeries: stats.isDrawnSeries,
      endDate: stats.status === 'completed' ? (series.endDate || new Date()) : undefined,
    });

    return stats;
  }

  /**
   * Pure calculation function: derives statistics and status from matches and format.
   */
  static computeStats(
    series: FriendlySeriesDocument,
    matches: FriendlySeriesMatchDocument[]
  ): FriendlySeriesStats {
    const config = this.FORMAT_CONFIG[series.format];
    const completedMatches = matches.filter(
      (m) => m.status === 'completed' && m.result !== undefined
    );

    let teamAWins = 0;
    let teamBWins = 0;
    let draws = 0;

    for (const m of completedMatches) {
      const res = m.result!;
      if (res.isDraw || !res.winnerTeamId) {
        draws += 1;
      } else if (res.winnerTeamId.equals(series.teamAId)) {
        teamAWins += 1;
      } else if (res.winnerTeamId.equals(series.teamBId)) {
        teamBWins += 1;
      }
    }

    const matchesPlayed = completedMatches.length;
    const matchesRemaining = Math.max(0, config.maxMatches - matchesPlayed);

    let status: FriendlySeriesStatus = 'upcoming';
    let championTeamId: ObjectId | null = null;
    let isDrawnSeries = false;

    // Check if Team A won the series
    if (teamAWins >= config.requiredWins) {
      status = 'completed';
      championTeamId = series.teamAId;
      isDrawnSeries = false;
    }
    // Check if Team B won the series
    else if (teamBWins >= config.requiredWins) {
      status = 'completed';
      championTeamId = series.teamBId;
      isDrawnSeries = false;
    }
    // Check if maximum matches reached without any champion (Drawn Series)
    else if (matchesPlayed >= config.maxMatches) {
      status = 'completed';
      championTeamId = null;
      isDrawnSeries = true;
    }
    // If some matches have been played but series is ongoing
    else if (matchesPlayed > 0) {
      status = 'ongoing';
      championTeamId = null;
      isDrawnSeries = false;
    } else {
      status = series.status === 'cancelled' ? 'cancelled' : 'upcoming';
      championTeamId = null;
      isDrawnSeries = false;
    }

    return {
      teamAWins,
      teamBWins,
      draws,
      matchesPlayed,
      matchesRemaining,
      maxMatches: config.maxMatches,
      requiredWins: config.requiredWins,
      status,
      championTeamId,
      isDrawnSeries,
    };
  }

  static async getSeriesStats(seriesId: string | ObjectId): Promise<FriendlySeriesStats> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const series = await FriendlySeriesRepository.findById(sId);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }
    const matches = await FriendlySeriesMatchRepository.findBySeriesId(sId);
    return this.computeStats(series, matches);
  }

  /**
   * Calculates Top Goal Scorer statistics across all completed matches in a friendly series.
   * Rules:
   * - Only counts normal goals.
   * - Excludes own goals.
   * - Ordered by totalGoals descending, then player name alphabetically.
   * - Equal goals share the same rank.
   */
  static async getTopScorers(seriesId: string | ObjectId): Promise<TopGoalScorerEntry[]> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const series = await FriendlySeriesRepository.findById(sId);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }

    const [completedMatches, teamA, teamB] = await Promise.all([
      FriendlySeriesMatchRepository.findBySeriesId(sId, { status: 'completed' }),
      FriendlySeriesRepository.findTeamWithRoster(series.teamAId),
      FriendlySeriesRepository.findTeamWithRoster(series.teamBId),
    ]);

    const playerTeamMap = new Map<string, { teamId: ObjectId; teamName: string; teamColor?: string }>();
    if (teamA) {
      for (const pId of teamA.playerIds) {
        playerTeamMap.set(pId.toString(), {
          teamId: teamA._id,
          teamName: teamA.name,
          teamColor: teamA.color,
        });
      }
    }
    if (teamB) {
      for (const pId of teamB.playerIds) {
        playerTeamMap.set(pId.toString(), {
          teamId: teamB._id,
          teamName: teamB.name,
          teamColor: teamB.color,
        });
      }
    }

    // Tally normal goals by player
    const playerTally = new Map<
      string,
      {
        playerId: ObjectId;
        goalsCount: number;
        matchesScoredSet: Set<string>;
      }
    >();

    for (const match of completedMatches) {
      const matchGoals = match.result?.goals || match.goals || [];
      const matchIdStr = match._id!.toString();

      for (const goal of matchGoals) {
        // Exclude own goals!
        if (goal.type === 'own_goal') continue;

        if (goal.type === 'normal') {
          const pidStr = goal.playerId.toString();
          const current = playerTally.get(pidStr);
          if (current) {
            current.goalsCount += 1;
            current.matchesScoredSet.add(matchIdStr);
          } else {
            const matchesSet = new Set<string>();
            matchesSet.add(matchIdStr);
            playerTally.set(pidStr, {
              playerId: goal.playerId,
              goalsCount: 1,
              matchesScoredSet: matchesSet,
            });
          }
        }
      }
    }

    if (playerTally.size === 0) {
      return [];
    }

    const playerObjectIds = Array.from(playerTally.values()).map((p) => p.playerId);

    const db = getDB();
    const players = await db
      .collection('players')
      .find(
        { _id: { $in: playerObjectIds } },
        { projection: { _id: 1, fullName: 1, photo: 1 } }
      )
      .toArray();

    const playerDetailsMap = new Map(players.map((p) => [p._id.toString(), p]));

    const entries: TopGoalScorerEntry[] = Array.from(playerTally.values()).map((item) => {
      const pidStr = item.playerId.toString();
      const pDoc = playerDetailsMap.get(pidStr);
      const teamInfo = playerTeamMap.get(pidStr);

      return {
        rank: 0,
        playerId: item.playerId,
        playerName: pDoc?.fullName || 'Unknown Player',
        playerImage: pDoc?.photo,
        teamId: teamInfo?.teamId || new ObjectId(),
        teamName: teamInfo?.teamName || 'Unknown Team',
        teamColor: teamInfo?.teamColor,
        totalGoals: item.goalsCount,
        matchesScored: item.matchesScoredSet.size,
      };
    });

    // Sort: 1. Total goals descending, 2. Player name ascending
    entries.sort((a, b) => {
      if (b.totalGoals !== a.totalGoals) {
        return b.totalGoals - a.totalGoals;
      }
      return a.playerName.localeCompare(b.playerName);
    });

    // Standard competition ranking ("1224" rule: ties share rank)
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].totalGoals < entries[i - 1].totalGoals) {
        currentRank = i + 1;
      }
      entries[i].rank = currentRank;
    }

    return entries;
  }

  /**
   * Retrieves players belonging to both teams in the friendly series, separated by team.
   * Public player projection applied to protect player privacy.
   */
  static async getSeriesPlayers(
    seriesId: string | ObjectId
  ): Promise<FriendlySeriesTeamPlayersResponse> {
    const sId = typeof seriesId === 'string' ? new ObjectId(seriesId) : seriesId;
    const series = await FriendlySeriesRepository.findById(sId);
    if (!series) {
      throw new AppServiceError('Friendly series not found', 404);
    }

    const [teamA, teamB] = await Promise.all([
      FriendlySeriesRepository.findTeamWithRoster(series.teamAId),
      FriendlySeriesRepository.findTeamWithRoster(series.teamBId),
    ]);

    const db = getDB();
    const [playersA, playersB] = await Promise.all([
      teamA && teamA.playerIds.length > 0
        ? db
            .collection('players')
            .find({ _id: { $in: teamA.playerIds } })
            .toArray()
        : [],
      teamB && teamB.playerIds.length > 0
        ? db
            .collection('players')
            .find({ _id: { $in: teamB.playerIds } })
            .toArray()
        : [],
    ]);

    const publicPlayersA = (playersA as any[]).map(toPublicPlayer);
    const publicPlayersB = (playersB as any[]).map(toPublicPlayer);

    return {
      seriesId: series._id!,
      teamA: {
        _id: series.teamAId,
        name: teamA?.name || 'Team A',
        shortCode: teamA?.shortCode,
        logo: teamA?.logo,
        color: teamA?.color,
        players: publicPlayersA,
      },
      teamB: {
        _id: series.teamBId,
        name: teamB?.name || 'Team B',
        shortCode: teamB?.shortCode,
        logo: teamB?.logo,
        color: teamB?.color,
        players: publicPlayersB,
      },
    };
  }

  private static async buildDetailResponse(
    series: FriendlySeriesDocument
  ): Promise<FriendlySeriesDetailResponse> {
    const [teamA, teamB, matches] = await Promise.all([
      FriendlySeriesRepository.findTeamById(series.teamAId),
      FriendlySeriesRepository.findTeamById(series.teamBId),
      FriendlySeriesMatchRepository.findBySeriesId(series._id!),
    ]);

    const stats = this.computeStats(series, matches);

    let championTeam: any = null;
    if (stats.championTeamId) {
      if (stats.championTeamId.equals(series.teamAId)) {
        championTeam = teamA;
      } else if (stats.championTeamId.equals(series.teamBId)) {
        championTeam = teamB;
      } else {
        championTeam = await FriendlySeriesRepository.findTeamById(stats.championTeamId);
      }
    }

    return {
      series,
      teamA: teamA || {
        _id: series.teamAId,
        name: 'Team A',
      },
      teamB: teamB || {
        _id: series.teamBId,
        name: 'Team B',
      },
      stats,
      championTeam,
    };
  }
}
