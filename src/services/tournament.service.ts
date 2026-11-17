import { ObjectId, ClientSession } from 'mongodb';
import { getDB, getMongoClient } from '../config/db.js';
import {
  TournamentRepository,
  TournamentTeamRepository,
} from '../repositories/tournament.repository.js';
import {
  TournamentMatchRepository,
  MatchFilterOptions,
} from '../repositories/tournament-match.repository.js';
import {
  TournamentDocument,
  TournamentStatus,
  TournamentStage,
  TournamentMatchStatus,
  GoalType,
  TournamentTeamDocument,
  TournamentMatchDocument,
  CreateTournamentDTO,
  UpdateTournamentDTO,
  CreateTournamentMatchDTO,
  MatchResultDetails,
  MatchGoalEvent,
  TeamStanding,
  GoldenBootEntry,
} from '../types/tournament.types.js';
import {
  createTournamentSchema,
  updateTournamentSchema,
  registerTournamentTeamSchema,
  updateTournamentTeamSchema,
  scheduleTournamentMatchSchema,
  submitMatchResultSchema,
} from '../validators/tournament.validator.js';
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

export interface RegisterTeamInput {
  name: string;
  shortCode?: string;
  logo?: string;
  color?: string;
  playerIds: (string | ObjectId)[];
}

export interface UpdateTeamInput {
  name?: string;
  shortCode?: string;
  logo?: string;
  color?: string;
  playerIds?: (string | ObjectId)[];
}

export interface ScheduleMatchInput {
  matchDate?: Date | string;
  kickOffTime?: string;
  venue?: string;
  status?: TournamentMatchStatus;
}

export interface SubmitMatchResultInput {
  stage?: TournamentStage;
  homeScore: number;
  awayScore: number;
  regularTimeHomeScore?: number;
  regularTimeAwayScore?: number;
  extraTimeHomeScore?: number;
  extraTimeAwayScore?: number;
  wentToExtraTime?: boolean;
  wentToPenalties?: boolean;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
  winnerTeamId?: string | ObjectId | null;
  goals?: {
    playerId: string | ObjectId;
    teamId: string | ObjectId;
    minute?: number;
    type: GoalType;
  }[];
}

const VALID_LIFECYCLE_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ['teams_registered', 'cancelled'],
  teams_registered: ['draft', 'fixtures_generated', 'cancelled'],
  fixtures_generated: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * Executes a callback inside a MongoDB transaction if replica set transactions are supported.
 * Falls back gracefully to non-transactional execution in standalone/test environments.
 */
async function withOptionalTransaction<T>(
  work: (session?: ClientSession) => Promise<T>
): Promise<T> {
  const client = getMongoClient();
  if (!client) {
    return work();
  }

  let session: ClientSession | null = null;
  try {
    session = client.startSession();
    let result: T;
    await session.withTransaction(async () => {
      result = await work(session!);
    });
    return result!;
  } catch (err: any) {
    if (
      err?.code === 20 ||
      err?.codeName === 'IllegalOperation' ||
      err?.message?.includes('replica set') ||
      err?.message?.includes('Transaction numbers are only allowed')
    ) {
      return work();
    }
    throw err;
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
}

export class TournamentService {
  // ==========================================
  // 1. TOURNAMENT MANAGEMENT & LIFECYCLE
  // ==========================================

  /**
   * Creates a new tournament in 'draft' status.
   */
  static async createTournament(data: unknown): Promise<TournamentDocument> {
    const validated = createTournamentSchema.parse(data);

    // Check slug uniqueness
    const existing = await TournamentRepository.findBySlug(validated.slug);
    if (existing) {
      throw new AppServiceError(
        `Tournament with slug "${validated.slug}" already exists`,
        409
      );
    }

    return TournamentRepository.create({
      ...validated,
      status: 'draft',
    });
  }

  static async getTournamentById(id: string | ObjectId): Promise<TournamentDocument> {
    const tournament = await TournamentRepository.findById(id);
    if (!tournament) {
      throw new AppServiceError('Tournament not found', 404);
    }
    return tournament;
  }

  static async getTournamentBySlug(slug: string): Promise<TournamentDocument> {
    const tournament = await TournamentRepository.findBySlug(slug);
    if (!tournament) {
      throw new AppServiceError(`Tournament with slug "${slug}" not found`, 404);
    }
    return tournament;
  }

  static async listTournaments(options: {
    page?: number;
    limit?: number;
    status?: TournamentStatus;
    season?: string;
  }): Promise<{ tournaments: TournamentDocument[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (options.status) {
      filter.status = options.status;
    }
    if (options.season) {
      filter.season = options.season;
    }

    const [tournaments, total] = await Promise.all([
      TournamentRepository.findWithPagination(filter, { skip, limit }),
      TournamentRepository.count(filter),
    ]);

    return { tournaments, total };
  }

  static async updateTournament(
    id: string | ObjectId,
    data: unknown
  ): Promise<TournamentDocument> {
    const tournament = await this.getTournamentById(id);
    const validated = updateTournamentSchema.parse(data);

    if (validated.slug && validated.slug !== tournament.slug) {
      const existing = await TournamentRepository.findBySlug(validated.slug);
      if (existing) {
        throw new AppServiceError(
          `Tournament with slug "${validated.slug}" already exists`,
          409
        );
      }
    }

    if (validated.status && validated.status !== tournament.status) {
      this.validateStatusTransition(tournament.status, validated.status);
    }

    const updated = await TournamentRepository.update(id, validated as UpdateTournamentDTO);
    if (!updated) {
      throw new AppServiceError('Failed to update tournament', 500);
    }
    return updated;
  }

  static validateStatusTransition(
    currentStatus: TournamentStatus,
    targetStatus: TournamentStatus
  ): void {
    if (currentStatus === targetStatus) return;

    const allowed = VALID_LIFECYCLE_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new AppServiceError(
        `Invalid tournament lifecycle transition from "${currentStatus}" to "${targetStatus}"`,
        400
      );
    }
  }

  static async cancelTournament(id: string | ObjectId): Promise<TournamentDocument> {
    const tournament = await this.getTournamentById(id);
    if (tournament.status === 'completed') {
      throw new AppServiceError('Cannot cancel a completed tournament', 400);
    }
    if (tournament.status === 'cancelled') {
      return tournament;
    }

    const updated = await TournamentRepository.update(id, { status: 'cancelled' });
    return updated!;
  }

  static async deleteTournament(id: string | ObjectId): Promise<boolean> {
    const tournament = await this.getTournamentById(id);

    // Can only delete if draft or cancelled
    if (tournament.status !== 'draft' && tournament.status !== 'cancelled') {
      throw new AppServiceError(
        'Tournaments with generated fixtures or in progress cannot be deleted. Cancel instead.',
        400
      );
    }

    // Cascade delete teams and matches
    await Promise.all([
      TournamentTeamRepository.deleteByTournamentId(id),
      TournamentMatchRepository.deleteByTournamentId(id),
    ]);

    return TournamentRepository.delete(id);
  }

  // ==========================================
  // 2. TEAM REGISTRATION & ROSTER
  // ==========================================

  /**
   * Registers a team in a tournament.
   * Requires 5 or 6 unique players per team.
   * Unlimited teams allowed (minimum 3 teams required to generate fixtures).
   * Protected against concurrent registration races.
   */
  static async registerTeam(
    tournamentId: string | ObjectId,
    input: RegisterTeamInput
  ): Promise<TournamentTeamDocument> {
    const tournament = await this.getTournamentById(tournamentId);

    if (tournament.status !== 'draft' && tournament.status !== 'teams_registered') {
      throw new AppServiceError(
        'Cannot register teams: Tournament is locked because fixtures are already generated or tournament has begun',
        400
      );
    }

    const normalizedInput = {
      ...input,
      playerIds: input.playerIds?.map((id) => id.toString()),
    };
    const validated = registerTournamentTeamSchema.parse(normalizedInput);
    const playerObjectIds = validated.playerIds.map((id) => new ObjectId(id));

    // 1. Validate that all players exist in the players collection
    const playerCheck = await TournamentTeamRepository.verifyPlayersExist(playerObjectIds);
    if (playerCheck.missingIds.length > 0) {
      throw new AppServiceError(
        `The following player IDs do not exist in the academy database: ${playerCheck.missingIds.join(', ')}`,
        400,
        { missingPlayerIds: playerCheck.missingIds }
      );
    }

    return withOptionalTransaction(async () => {
      // 2. Check for team name conflict in this tournament
      const existingTeams = await TournamentTeamRepository.findByTournamentId(tournamentId);
      if (existingTeams.some((t) => t.name.toLowerCase() === validated.name.toLowerCase())) {
        throw new AppServiceError(
          `A team named "${validated.name}" already exists in this tournament`,
          409
        );
      }

      // 3. Check for player conflicts across teams in this tournament
      const conflictingTeams = await TournamentTeamRepository.findTeamsWithAnyPlayer(
        tournamentId,
        playerObjectIds
      );
      if (conflictingTeams.length > 0) {
        throw new AppServiceError(
          `One or more selected players are already registered to another team (${conflictingTeams.map((t) => t.name).join(', ')}) in this tournament`,
          409
        );
      }

      // 4. Increment registered team count on the tournament document
      const db = getDB();
      await db
        .collection<TournamentDocument>('tournaments')
        .updateOne(
          { _id: tournament._id!, status: { $in: ['draft', 'teams_registered'] } },
          {
            $inc: { registeredTeamCount: 1 },
            $set: { updatedAt: new Date() },
          }
        );

      // 5. Insert team (with rollback of count if insert fails)
      let createdTeam: TournamentTeamDocument;
      try {
        createdTeam = await TournamentTeamRepository.create({
          tournamentId: tournament._id!,
          name: validated.name,
          shortCode: validated.shortCode,
          logo: validated.logo,
          color: validated.color,
          playerIds: playerObjectIds,
        });
      } catch (insertError: any) {
        await db.collection('tournaments').updateOne(
          { _id: tournament._id! },
          { $inc: { registeredTeamCount: -1 } }
        );
        if (insertError?.code === 11000) {
          throw new AppServiceError(
            'Unique constraint violation: Team name or one of the players is already registered in this tournament',
            409
          );
        }
        throw insertError;
      }

      // 6. Transition lifecycle to 'teams_registered' once at least 3 teams are registered
      const actualCount = await TournamentTeamRepository.countByTournamentId(tournamentId);
      if (actualCount >= 3 && tournament.status === 'draft') {
        await TournamentRepository.update(tournamentId, { status: 'teams_registered' });
      }

      return createdTeam;
    });
  }

  /**
   * Updates a team's information or player roster.
   */
  static async updateTeam(
    teamId: string | ObjectId,
    input: UpdateTeamInput
  ): Promise<TournamentTeamDocument> {
    const team = await TournamentTeamRepository.findById(teamId);
    if (!team) {
      throw new AppServiceError('Tournament team not found', 404);
    }

    const tournament = await this.getTournamentById(team.tournamentId);
    if (tournament.status !== 'draft' && tournament.status !== 'teams_registered') {
      throw new AppServiceError(
        'Cannot update team details or roster: Tournament is locked because fixtures are generated or matches have begun',
        400
      );
    }

    const normalizedInput = {
      ...input,
      playerIds: input.playerIds ? input.playerIds.map((id) => id.toString()) : undefined,
    };
    const validated = updateTournamentTeamSchema.parse(normalizedInput);

    if (validated.name && validated.name !== team.name) {
      const existingTeams = await TournamentTeamRepository.findByTournamentId(team.tournamentId);
      if (
        existingTeams.some(
          (t) =>
            t._id?.toString() !== team._id?.toString() &&
            t.name.toLowerCase() === validated.name!.toLowerCase()
        )
      ) {
        throw new AppServiceError(
          `A team named "${validated.name}" already exists in this tournament`,
          409
        );
      }
    }

    let updatedPlayerObjectIds: ObjectId[] | undefined;
    if (validated.playerIds) {
      updatedPlayerObjectIds = validated.playerIds.map((id) => new ObjectId(id));

      // Verify all players exist in players collection
      const playerCheck = await TournamentTeamRepository.verifyPlayersExist(updatedPlayerObjectIds);
      if (playerCheck.missingIds.length > 0) {
        throw new AppServiceError(
          `The following player IDs do not exist in the academy database: ${playerCheck.missingIds.join(', ')}`,
          400,
          { missingPlayerIds: playerCheck.missingIds }
        );
      }

      // Verify no player conflict with other teams in the same tournament
      const conflictingTeams = await TournamentTeamRepository.findTeamsWithAnyPlayer(
        team.tournamentId,
        updatedPlayerObjectIds,
        team._id
      );
      if (conflictingTeams.length > 0) {
        throw new AppServiceError(
          `One or more selected players are already registered to another team (${conflictingTeams.map((t) => t.name).join(', ')}) in this tournament`,
          409
        );
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (validated.name !== undefined) updatePayload.name = validated.name;
    if (validated.shortCode !== undefined) updatePayload.shortCode = validated.shortCode;
    if (validated.logo !== undefined) updatePayload.logo = validated.logo;
    if (validated.color !== undefined) updatePayload.color = validated.color;
    if (updatedPlayerObjectIds !== undefined) updatePayload.playerIds = updatedPlayerObjectIds;

    const updated = await TournamentTeamRepository.update(teamId, updatePayload);

    return updated!;
  }

  /**
   * Removes a team from a tournament.
   */
  static async deleteTeam(teamId: string | ObjectId): Promise<boolean> {
    const team = await TournamentTeamRepository.findById(teamId);
    if (!team) {
      throw new AppServiceError('Tournament team not found', 404);
    }

    const tournament = await this.getTournamentById(team.tournamentId);
    if (tournament.status !== 'draft' && tournament.status !== 'teams_registered') {
      throw new AppServiceError(
        'Cannot remove team: Tournament is locked because fixtures have already been generated',
        400
      );
    }

    const deleted = await TournamentTeamRepository.delete(teamId);

    // Atomically decrement registeredTeamCount and update status if < 3 teams remain
    const remainingCount = await TournamentTeamRepository.countByTournamentId(tournament._id!);
    const newStatus: TournamentStatus = remainingCount >= 3 ? tournament.status : 'draft';

    await getDB()
      .collection('tournaments')
      .updateOne(
        { _id: tournament._id! },
        {
          $inc: { registeredTeamCount: -1 },
          $set: { status: newStatus, updatedAt: new Date() },
        }
      );

    return deleted;
  }

  static async getTeams(tournamentId: string | ObjectId): Promise<TournamentTeamDocument[]> {
    return TournamentTeamRepository.findByTournamentId(tournamentId);
  }

  static async getTeamById(
    teamId: string | ObjectId
  ): Promise<TournamentTeamDocument & { players?: unknown[] }> {
    const team = await TournamentTeamRepository.findById(teamId);
    if (!team) {
      throw new AppServiceError('Tournament team not found', 404);
    }

    // Fetch public player data for roster
    const db = getDB();
    const players = await db
      .collection('players')
      .find(
        { _id: { $in: team.playerIds } },
        {
          projection: {
            _id: 1,
            fullName: 1,
            slug: 1,
            jerseyNumber: 1,
            position: 1,
            photo: 1,
            dateOfBirth: 1,
            dominantFoot: 1,
          },
        }
      )
      .toArray();

    return { ...team, players: (players as any[]).map(toPublicPlayer) };
  }

  // ==========================================
  // 3. ROUND-ROBIN FIXTURE GENERATION
  // ==========================================

  /**
   * Generates single round-robin fixtures for any N >= 3 registered teams.
   * Total N*(N-1)/2 matches.
   * Odd team counts generate N rounds with 1 bye per round.
   * Even team counts generate N-1 rounds with no byes.
   * Uses Berger table / Circle method algorithm.
   * Protected against concurrent generation and partial fixture creation.
   */
  static async generateFixtures(
    tournamentId: string | ObjectId
  ): Promise<TournamentMatchDocument[]> {
    const tId = typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    const tournament = await this.getTournamentById(tId);

    // Verify at least 3 teams exist
    const teams = await TournamentTeamRepository.findByTournamentId(tId);
    if (teams.length < 3) {
      throw new AppServiceError(
        `Cannot generate fixtures: Tournament must have at least 3 teams registered (currently has ${teams.length})`,
        400
      );
    }

    if (tournament.status !== 'teams_registered') {
      throw new AppServiceError(
        `Cannot generate fixtures: Tournament status must be "teams_registered" (current status is "${tournament.status}")`,
        400
      );
    }

    // Verify every team has 5 or 6 players
    for (const team of teams) {
      if (!team.playerIds || team.playerIds.length < 5 || team.playerIds.length > 6) {
        throw new AppServiceError(
          `Cannot generate fixtures: Team "${team.name}" must have 5 or 6 players (currently has ${team.playerIds?.length ?? 0})`,
          400
        );
      }
    }

    // Concurrency check: Ensure no fixtures exist already
    const fixturesExist = await TournamentMatchRepository.hasFixtures(tId);
    if (fixturesExist) {
      throw new AppServiceError(
        'Fixtures have already been generated for this tournament',
        409
      );
    }

    // Atomic status transition lock: Prevents duplicate concurrent generation
    const lockResult = await getDB()
      .collection<TournamentDocument>('tournaments')
      .findOneAndUpdate(
        { _id: tId, status: 'teams_registered' },
        { $set: { status: 'fixtures_generated', updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
    if (!lockResult) {
      throw new AppServiceError(
        'Cannot generate fixtures: Tournament is not in "teams_registered" status or fixtures are already being generated',
        409
      );
    }

    try {
      // Generalized Single Round-Robin (Circle Method / Berger Table)
      // Supports any N >= 3 teams.
      const n = teams.length;
      const isOdd = n % 2 !== 0;

      // If odd number of teams, introduce a dummy 'null' (BYE) team
      // so total participants M is even.
      const teamList: (ObjectId | null)[] = teams.map((t) => t._id!);
      if (isOdd) {
        teamList.push(null);
      }

      const totalParticipants = teamList.length; // M (even)
      const totalRounds = totalParticipants - 1; // R (N if odd, N-1 if even)
      const matchesPerRound = totalParticipants / 2;

      const fixturesToCreate: CreateTournamentMatchDTO[] = [];
      let matchNumber = 1;

      // In the circle method, teamList[0] is fixed, and teamList[1..M-1] rotate
      const currentRotation = [...teamList];

      for (let round = 0; round < totalRounds; round++) {
        const roundNum = round + 1;

        for (let i = 0; i < matchesPerRound; i++) {
          const team1 = currentRotation[i];
          const team2 = currentRotation[totalParticipants - 1 - i];

          // If either participant is null, the other has a BYE in this round
          if (!team1 || !team2) {
            continue;
          }

          // Home/Away balance:
          // Alternate home and away to achieve balanced schedules
          let homeTeamId: ObjectId;
          let awayTeamId: ObjectId;

          if (i === 0) {
            // For the pairing involving the fixed position (index 0)
            if (round % 2 === 0) {
              homeTeamId = team1;
              awayTeamId = team2;
            } else {
              homeTeamId = team2;
              awayTeamId = team1;
            }
          } else {
            // For all other pairings
            if ((i + round) % 2 === 0) {
              homeTeamId = team1;
              awayTeamId = team2;
            } else {
              homeTeamId = team2;
              awayTeamId = team1;
            }
          }

          fixturesToCreate.push({
            tournamentId: tId,
            stage: 'league',
            round: roundNum,
            matchNumber: matchNumber++,
            homeTeamId,
            awayTeamId,
            status: 'scheduled',
            goals: [],
          });
        }

        // Rotate elements at indices 1 to M-1 clockwise:
        // Pop the last element and insert it at index 1
        const fixed = currentRotation[0];
        const rotating = currentRotation.slice(1);
        const last = rotating.pop()!;
        rotating.unshift(last);
        currentRotation.splice(0, currentRotation.length, fixed, ...rotating);
      }

      const createdFixtures = await TournamentMatchRepository.createMany(fixturesToCreate);
      return createdFixtures;
    } catch (error) {
      // Rollback status and partial fixtures on any failure
      await TournamentMatchRepository.deleteByTournamentId(tId);
      await TournamentRepository.update(tId, { status: 'teams_registered' });
      throw error;
    }
  }

  // ==========================================
  // 4. LEAGUE STANDINGS & TIE-BREAKER
  // ==========================================

  /**
   * Dynamically calculates league standings from completed league matches.
   * Standings tie-breakers:
   * 1. Points (Win = 3, Draw = 1, Loss = 0)
   * 2. Goal Difference (GF - GA)
   * 3. Goals For (GF)
   * 4. Head-to-head points among tied teams (mini-table)
   * 5. Head-to-head goal difference among tied teams (mini-table)
   * 6. Fewest Goals Against in overall tournament
   * 7. Alphabetical team name fallback
   */
  static async getStandings(tournamentId: string | ObjectId): Promise<TeamStanding[]> {
    const tId = typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    await this.getTournamentById(tId);

    const [teams, completedMatches] = await Promise.all([
      TournamentTeamRepository.findByTournamentId(tId),
      TournamentMatchRepository.findCompletedLeagueMatches(tId),
    ]);

    // Initialize standings map
    const standingsMap = new Map<string, TeamStanding>();
    for (const team of teams) {
      standingsMap.set(team._id!.toString(), {
        rank: 0,
        teamId: team._id!,
        teamName: team.name,
        teamShortCode: team.shortCode,
        teamLogo: team.logo,
        teamColor: team.color,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      });
    }

    // Accumulate stats from completed league matches
    for (const match of completedMatches) {
      const hId = match.homeTeamId.toString();
      const aId = match.awayTeamId.toString();

      const homeStanding = standingsMap.get(hId);
      const awayStanding = standingsMap.get(aId);

      if (!homeStanding || !awayStanding) continue;

      const homeScore = match.result?.homeScore ?? 0;
      const awayScore = match.result?.awayScore ?? 0;

      homeStanding.played += 1;
      homeStanding.goalsFor += homeScore;
      homeStanding.goalsAgainst += awayScore;

      awayStanding.played += 1;
      awayStanding.goalsFor += awayScore;
      awayStanding.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        homeStanding.won += 1;
        homeStanding.points += 3;
        awayStanding.lost += 1;
      } else if (awayScore > homeScore) {
        awayStanding.won += 1;
        awayStanding.points += 3;
        homeStanding.lost += 1;
      } else {
        homeStanding.drawn += 1;
        homeStanding.points += 1;
        awayStanding.drawn += 1;
        awayStanding.points += 1;
      }
    }

    for (const standing of standingsMap.values()) {
      standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
    }

    const allStandings = Array.from(standingsMap.values());

    // Group teams into tied buckets based on (Points, Goal Difference, Goals For)
    const bucketsMap = new Map<string, TeamStanding[]>();
    for (const standing of allStandings) {
      const key = `${standing.points}:${standing.goalDifference}:${standing.goalsFor}`;
      const bucket = bucketsMap.get(key) || [];
      bucket.push(standing);
      bucketsMap.set(key, bucket);
    }

    // Sort bucket keys descending by Points, GD, GF
    const sortedBucketKeys = Array.from(bucketsMap.keys()).sort((k1, k2) => {
      const [pts1, gd1, gf1] = k1.split(':').map(Number);
      const [pts2, gd2, gf2] = k2.split(':').map(Number);

      if (pts2 !== pts1) return pts2 - pts1;
      if (gd2 !== gd1) return gd2 - gd1;
      return gf2 - gf1;
    });

    const finalStandings: TeamStanding[] = [];

    // Resolve each bucket
    for (const key of sortedBucketKeys) {
      const bucket = bucketsMap.get(key)!;

      if (bucket.length === 1) {
        finalStandings.push(bucket[0]);
        continue;
      }

      // 2 or more teams tied on Points, GD, and GF:
      // Calculate mini-table among all tied teams in this bucket
      const bucketTeamIdSet = new Set(bucket.map((t) => t.teamId.toString()));
      const h2hStats = new Map<
        string,
        { points: number; gf: number; ga: number; gd: number }
      >();

      for (const t of bucket) {
        h2hStats.set(t.teamId.toString(), { points: 0, gf: 0, ga: 0, gd: 0 });
      }

      for (const match of completedMatches) {
        const hId = match.homeTeamId.toString();
        const aId = match.awayTeamId.toString();

        if (bucketTeamIdSet.has(hId) && bucketTeamIdSet.has(aId)) {
          const hStat = h2hStats.get(hId)!;
          const aStat = h2hStats.get(aId)!;

          const hScore = match.result?.homeScore ?? 0;
          const aScore = match.result?.awayScore ?? 0;

          hStat.gf += hScore;
          hStat.ga += aScore;
          aStat.gf += aScore;
          aStat.ga += hScore;

          if (hScore > aScore) {
            hStat.points += 3;
          } else if (aScore > hScore) {
            aStat.points += 3;
          } else {
            hStat.points += 1;
            aStat.points += 1;
          }
        }
      }

      for (const stat of h2hStats.values()) {
        stat.gd = stat.gf - stat.ga;
      }

      // Sort bucket using tie-breaker rules 4-7
      bucket.sort((a, b) => {
        const aH2H = h2hStats.get(a.teamId.toString())!;
        const bH2H = h2hStats.get(b.teamId.toString())!;

        // 4. Head-to-head points among tied teams
        if (bH2H.points !== aH2H.points) {
          return bH2H.points - aH2H.points;
        }

        // 5. Head-to-head goal difference among tied teams
        if (bH2H.gd !== aH2H.gd) {
          return bH2H.gd - aH2H.gd;
        }

        // 6. Fewest Goals Against in overall tournament (lower is better)
        if (a.goalsAgainst !== b.goalsAgainst) {
          return a.goalsAgainst - b.goalsAgainst;
        }

        // 7. Alphabetical team name fallback
        return a.teamName.toLowerCase().localeCompare(b.teamName.toLowerCase());
      });

      finalStandings.push(...bucket);
    }

    // Assign sequential ranks 1 through N
    finalStandings.forEach((standing, index) => {
      standing.rank = index + 1;
    });

    return finalStandings;
  }

  // ==========================================
  // 5. GOLDEN BOOT CALCULATOR
  // ==========================================

  /**
   * Calculates Golden Boot rankings from all completed matches (league + final).
   * Rules:
   * - Regular and extra-time goals count.
   * - Penalty shootout kicks do NOT count.
   * - Own goals do NOT count for the scorer.
   * - Only completed matches count.
   * - Players with equal goals share the same rank.
   * - Safe public player projections only.
   */
  static async getGoldenBoot(
    tournamentId: string | ObjectId
  ): Promise<GoldenBootEntry[]> {
    const tId = typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    await this.getTournamentById(tId);

    const [completedMatches, teams] = await Promise.all([
      TournamentMatchRepository.findCompletedTournamentMatches(tId),
      TournamentTeamRepository.findByTournamentId(tId),
    ]);

    const playerTeamMap = new Map<string, TournamentTeamDocument>();
    for (const team of teams) {
      for (const pId of team.playerIds) {
        playerTeamMap.set(pId.toString(), team);
      }
    }

    // Tally eligible goals
    const goalsTally = new Map<string, { playerId: ObjectId; goalsCount: number }>();

    for (const match of completedMatches) {
      for (const goal of match.goals) {
        // Own goals and shootout kicks are excluded
        if (goal.type === 'own_goal') continue;

        if (goal.type === 'regular' || goal.type === 'extra_time') {
          const pidStr = goal.playerId.toString();
          const current = goalsTally.get(pidStr);
          if (current) {
            current.goalsCount += 1;
          } else {
            goalsTally.set(pidStr, {
              playerId: goal.playerId,
              goalsCount: 1,
            });
          }
        }
      }
    }

    if (goalsTally.size === 0) {
      return [];
    }

    const playerObjectIds = Array.from(goalsTally.values()).map((g) => g.playerId);

    // Fetch public player data safely from players collection
    const db = getDB();
    const players = await db
      .collection('players')
      .find(
        { _id: { $in: playerObjectIds } },
        {
          projection: {
            _id: 1,
            fullName: 1,
            jerseyNumber: 1,
            position: 1,
            photo: 1,
          },
        }
      )
      .toArray();

    const playerDetailsMap = new Map(players.map((p) => [p._id.toString(), p]));

    const entries: GoldenBootEntry[] = Array.from(goalsTally.values()).map((item) => {
      const pidStr = item.playerId.toString();
      const pDoc = playerDetailsMap.get(pidStr);
      const teamDoc = playerTeamMap.get(pidStr);

      return {
        rank: 0,
        playerId: item.playerId,
        playerFullName: pDoc?.fullName || 'Unknown Player',
        jerseyNumber: pDoc?.jerseyNumber ?? 0,
        position: pDoc?.position || 'Forward',
        photo: pDoc?.photo,
        teamId: teamDoc?._id || new ObjectId(),
        teamName: teamDoc?.name || 'Unknown Team',
        teamColor: teamDoc?.color,
        goalsCount: item.goalsCount,
      };
    });

    // Sort by goals descending, then player name ascending
    entries.sort((a, b) => {
      if (b.goalsCount !== a.goalsCount) {
        return b.goalsCount - a.goalsCount;
      }
      return a.playerFullName.localeCompare(b.playerFullName);
    });

    // Standard competition ranking ("1224" rule: ties share rank)
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].goalsCount < entries[i - 1].goalsCount) {
        currentRank = i + 1;
      }
      entries[i].rank = currentRank;
    }

    return entries;
  }

  // ==========================================
  // 6. FINAL QUALIFICATION & FIXTURE
  // ==========================================

  /**
   * Generates the Final Match after all league matches are completed.
   * Rank 1 team qualifies as home team; Rank 2 team qualifies as away team.
   */
  static async generateFinalMatch(
    tournamentId: string | ObjectId
  ): Promise<TournamentMatchDocument> {
    const tId = typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    const tournament = await this.getTournamentById(tId);

    if (tournament.status === 'cancelled') {
      throw new AppServiceError('Cannot generate final for a cancelled tournament', 400);
    }

    // Check if final match already exists
    const existingFinalMatches = await TournamentMatchRepository.findAll({
      tournamentId: tId,
      stage: 'final',
    });
    if (existingFinalMatches.length > 0) {
      throw new AppServiceError('Final match has already been generated', 409);
    }

    // Verify all league matches are completed
    const allLeagueMatches = await TournamentMatchRepository.findMatches(tId, { stage: 'league' });
    if (allLeagueMatches.length === 0) {
      throw new AppServiceError(
        'Cannot generate final match: No league fixtures exist for this tournament',
        400
      );
    }

    const totalLeagueMatches = allLeagueMatches.length;
    const completedLeagueMatches = allLeagueMatches.filter((m) => m.status === 'completed').length;

    if (completedLeagueMatches < totalLeagueMatches) {
      throw new AppServiceError(
        `Cannot generate final match: All ${totalLeagueMatches} league matches must be completed first (currently ${completedLeagueMatches}/${totalLeagueMatches} completed)`,
        400
      );
    }

    // Calculate final standings
    const standings = await this.getStandings(tId);
    if (standings.length < 2) {
      throw new AppServiceError('Insufficient teams to generate final match', 400);
    }

    const rank1Team = standings[0];
    const rank2Team = standings[1];

    // Create final match fixture (numbered dynamically: totalLeagueMatches + 1)
    const finalMatchNumber = totalLeagueMatches + 1;
    const finalMatch = await TournamentMatchRepository.create({
      tournamentId: tId,
      stage: 'final',
      matchNumber: finalMatchNumber,
      homeTeamId: rank1Team.teamId,
      awayTeamId: rank2Team.teamId,
      status: 'scheduled',
      goals: [],
    });

    // Link finalMatchId on tournament
    await TournamentRepository.update(tId, {
      finalMatchId: finalMatch._id,
    });

    return finalMatch;
  }

  // ==========================================
  // 7. MATCH MANAGEMENT & RESULT SUBMISSION
  // ==========================================

  static async scheduleMatch(
    matchId: string | ObjectId,
    input: ScheduleMatchInput
  ): Promise<TournamentMatchDocument> {
    const validated = scheduleTournamentMatchSchema.parse(input);
    const updated = await TournamentMatchRepository.updateSchedule(matchId, validated);
    if (!updated) {
      throw new AppServiceError('Match not found', 404);
    }
    return updated;
  }

  static async getMatches(
    tournamentId: string | ObjectId,
    filter?: MatchFilterOptions
  ): Promise<TournamentMatchDocument[]> {
    return TournamentMatchRepository.findMatches(tournamentId, filter);
  }

  static async getMatchById(
    matchId: string | ObjectId
  ): Promise<TournamentMatchDocument> {
    const match = await TournamentMatchRepository.findById(matchId);
    if (!match) {
      throw new AppServiceError('Tournament match not found', 404);
    }
    return match;
  }

  /**
   * Submits or corrects a match result.
   * Full football score and goal event validation:
   * - Score matches goal event count
   * - Goal scorer belongs to credited team (or opponent for own goals)
   * - Validates extra time and penalty shootouts
   * - Updates tournament lifecycle to 'in_progress' or 'completed'
   * - Automatically updates standings and Golden Boot
   */
  static async submitMatchResult(
    tournamentId: string | ObjectId,
    matchId: string | ObjectId,
    input: SubmitMatchResultInput
  ): Promise<TournamentMatchDocument> {
    const tId = typeof tournamentId === 'string' ? new ObjectId(tournamentId) : tournamentId;
    const mId = typeof matchId === 'string' ? new ObjectId(matchId) : matchId;

    const tournament = await this.getTournamentById(tId);
    if (tournament.status === 'cancelled') {
      throw new AppServiceError('Cannot submit result for a cancelled tournament', 400);
    }

    const match = await TournamentMatchRepository.findById(mId);
    if (!match) {
      throw new AppServiceError('Tournament match not found', 404);
    }
    if (match.tournamentId.toString() !== tId.toString()) {
      throw new AppServiceError('Match does not belong to the specified tournament', 400);
    }
    if (match.status === 'cancelled') {
      throw new AppServiceError('Cannot submit result for a cancelled match', 400);
    }

    // Normalize payload IDs to strings for Zod validation
    let resolvedWinnerInput = input.winnerTeamId;
    if (!resolvedWinnerInput && match.stage === 'final') {
      if (
        input.wentToPenalties &&
        input.homePenaltyScore !== undefined &&
        input.awayPenaltyScore !== undefined
      ) {
        if (input.homePenaltyScore > input.awayPenaltyScore) {
          resolvedWinnerInput = match.homeTeamId;
        } else if (input.awayPenaltyScore > input.homePenaltyScore) {
          resolvedWinnerInput = match.awayTeamId;
        }
      } else if (input.homeScore > input.awayScore) {
        resolvedWinnerInput = match.homeTeamId;
      } else if (input.awayScore > input.homeScore) {
        resolvedWinnerInput = match.awayTeamId;
      }
    }

    const normalizedInput = {
      ...input,
      stage: match.stage,
      winnerTeamId:
        resolvedWinnerInput !== undefined && resolvedWinnerInput !== null
          ? resolvedWinnerInput.toString()
          : resolvedWinnerInput,
      goals: (input.goals || []).map((g) => ({
        ...g,
        playerId: g.playerId ? g.playerId.toString() : g.playerId,
        teamId: g.teamId ? g.teamId.toString() : g.teamId,
      })),
    };

    // Validate payload with Zod schema (checks stage rules, final shootout rules, etc.)
    const validated = submitMatchResultSchema.parse(normalizedInput);

    // Fetch home and away teams to validate rosters
    const [homeTeam, awayTeam] = await Promise.all([
      TournamentTeamRepository.findById(match.homeTeamId),
      TournamentTeamRepository.findById(match.awayTeamId),
    ]);

    if (!homeTeam || !awayTeam) {
      throw new AppServiceError('One or both match teams could not be found', 500);
    }

    const homePlayerIds = new Set(homeTeam.playerIds.map((p) => p.toString()));
    const awayPlayerIds = new Set(awayTeam.playerIds.map((p) => p.toString()));

    const homeTeamIdStr = match.homeTeamId.toString();
    const awayTeamIdStr = match.awayTeamId.toString();

    let calculatedHomeScore = 0;
    let calculatedAwayScore = 0;

    const validatedGoals: MatchGoalEvent[] = [];

    // Validate each goal event
    for (let i = 0; i < validated.goals.length; i++) {
      const goal = validated.goals[i];
      const goalTeamIdStr = goal.teamId.toString();
      const goalPlayerIdStr = goal.playerId.toString();

      // Team must be either home or away
      if (goalTeamIdStr !== homeTeamIdStr && goalTeamIdStr !== awayTeamIdStr) {
        throw new AppServiceError(
          `Goal #${i + 1}: Team ID must match either the home or away team of this match`,
          400
        );
      }

      if (goal.type === 'regular' || goal.type === 'extra_time') {
        if (goalTeamIdStr === homeTeamIdStr) {
          if (!homePlayerIds.has(goalPlayerIdStr)) {
            throw new AppServiceError(
              `Goal #${i + 1}: Scorer does not belong to the credited home team (${homeTeam.name})`,
              400
            );
          }
          calculatedHomeScore += 1;
        } else {
          if (!awayPlayerIds.has(goalPlayerIdStr)) {
            throw new AppServiceError(
              `Goal #${i + 1}: Scorer does not belong to the credited away team (${awayTeam.name})`,
              400
            );
          }
          calculatedAwayScore += 1;
        }
      } else if (goal.type === 'own_goal') {
        // Own goal convention:
        // teamId is the credited team (the beneficiary whose score increments)
        // playerId is the player who committed the own goal, belonging to the OPPOSING team
        if (goalTeamIdStr === homeTeamIdStr) {
          if (!awayPlayerIds.has(goalPlayerIdStr)) {
            throw new AppServiceError(
              `Goal #${i + 1}: Own-goal scorer credited to ${homeTeam.name} must belong to opponent ${awayTeam.name}`,
              400
            );
          }
          calculatedHomeScore += 1;
        } else {
          if (!homePlayerIds.has(goalPlayerIdStr)) {
            throw new AppServiceError(
              `Goal #${i + 1}: Own-goal scorer credited to ${awayTeam.name} must belong to opponent ${homeTeam.name}`,
              400
            );
          }
          calculatedAwayScore += 1;
        }
      }

      validatedGoals.push({
        playerId: new ObjectId(goalPlayerIdStr),
        teamId: new ObjectId(goalTeamIdStr),
        minute: goal.minute,
        type: goal.type,
      });
    }

    // Verify football score consistency
    if (validated.homeScore !== calculatedHomeScore) {
      throw new AppServiceError(
        `Home score (${validated.homeScore}) does not match the total goal events credited to home team (${calculatedHomeScore})`,
        400
      );
    }
    if (validated.awayScore !== calculatedAwayScore) {
      throw new AppServiceError(
        `Away score (${validated.awayScore}) does not match the total goal events credited to away team (${calculatedAwayScore})`,
        400
      );
    }

    // Winner team validation
    let resolvedWinnerTeamId: ObjectId | null = null;

    if (match.stage === 'league') {
      if (validated.homeScore > validated.awayScore) {
        resolvedWinnerTeamId = match.homeTeamId;
      } else if (validated.awayScore > validated.homeScore) {
        resolvedWinnerTeamId = match.awayTeamId;
      } else {
        resolvedWinnerTeamId = null; // Draw
      }
    } else {
      // Final stage: Must have a winner
      if (validated.wentToPenalties) {
        if (
          validated.homePenaltyScore === undefined ||
          validated.awayPenaltyScore === undefined
        ) {
          throw new AppServiceError(
            'Penalty shootout scores must be provided for tied final matches',
            400
          );
        }
        if (validated.homePenaltyScore === validated.awayPenaltyScore) {
          throw new AppServiceError('Penalty shootout cannot end in a draw', 400);
        }
        resolvedWinnerTeamId =
          validated.homePenaltyScore > validated.awayPenaltyScore
            ? match.homeTeamId
            : match.awayTeamId;
      } else {
        if (validated.homeScore === validated.awayScore) {
          throw new AppServiceError(
            'Final match tied after playing time must be decided by penalty shootout',
            400
          );
        }
        resolvedWinnerTeamId =
          validated.homeScore > validated.awayScore
            ? match.homeTeamId
            : match.awayTeamId;
      }
    }

    const resultDetails: MatchResultDetails = {
      homeScore: validated.homeScore,
      awayScore: validated.awayScore,
      regularTimeHomeScore: validated.regularTimeHomeScore,
      regularTimeAwayScore: validated.regularTimeAwayScore,
      extraTimeHomeScore: validated.extraTimeHomeScore,
      extraTimeAwayScore: validated.extraTimeAwayScore,
      wentToExtraTime: validated.wentToExtraTime,
      wentToPenalties: validated.wentToPenalties,
      homePenaltyScore: validated.homePenaltyScore,
      awayPenaltyScore: validated.awayPenaltyScore,
      winnerTeamId: resolvedWinnerTeamId,
    };

    // Save match result atomically
    const updatedMatch = await TournamentMatchRepository.updateResult(mId, {
      result: resultDetails,
      goals: validatedGoals,
      status: 'completed',
    });

    // Update tournament lifecycle
    if (tournament.status === 'fixtures_generated') {
      await TournamentRepository.update(tId, { status: 'in_progress' });
    }

    // If final match completed, finalize tournament and calculate Golden Boot winner
    if (match.stage === 'final') {
      const goldenBootList = await this.getGoldenBoot(tId);
      const topScorerId = goldenBootList.length > 0 ? goldenBootList[0].playerId : undefined;

      await TournamentRepository.update(tId, {
        status: 'completed',
        winnerTeamId: resolvedWinnerTeamId || undefined,
        goldenBootPlayerId: topScorerId,
        endDate: new Date(),
      });
    }

    return updatedMatch!;
  }
}
