import { Request, Response } from 'express';
import { TournamentService } from '../services/tournament.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination.js';
import { TournamentStatus } from '../types/tournament.types.js';

export class TournamentController {
  // ==========================================
  // TOURNAMENTS
  // ==========================================

  static async createTournament(req: Request, res: Response): Promise<void> {
    const tournament = await TournamentService.createTournament(req.body);
    sendSuccess(res, tournament, 'Tournament created successfully', 201);
  }

  static async listTournaments(req: Request, res: Response): Promise<void> {
    const { page, limit } = getPaginationOptions(req.query);
    const { status, season } = req.query as {
      status?: TournamentStatus;
      season?: string;
    };

    const { tournaments, total } = await TournamentService.listTournaments({
      page,
      limit,
      status,
      season,
    });

    const paginationMeta = buildPaginationMeta(total, page, limit);
    sendSuccess(
      res,
      tournaments,
      'Tournaments retrieved successfully',
      200,
      paginationMeta
    );
  }

  static async getTournamentById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const tournament = await TournamentService.getTournamentById(id);
    sendSuccess(res, tournament, 'Tournament retrieved successfully');
  }

  static async getTournamentBySlug(req: Request, res: Response): Promise<void> {
    const slug = req.params.slug as string;
    const tournament = await TournamentService.getTournamentBySlug(slug);
    sendSuccess(res, tournament, 'Tournament retrieved successfully');
  }

  static async updateTournament(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const updated = await TournamentService.updateTournament(id, req.body);
    sendSuccess(res, updated, 'Tournament updated successfully');
  }

  static async cancelTournament(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const cancelled = await TournamentService.cancelTournament(id);
    sendSuccess(res, cancelled, 'Tournament cancelled successfully');
  }

  static async deleteTournament(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await TournamentService.deleteTournament(id);
    sendSuccess(
      res,
      { deleted: true, id },
      'Tournament deleted successfully'
    );
  }

  // ==========================================
  // TEAMS
  // ==========================================

  static async getTournamentTeams(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const teams = await TournamentService.getTeams(id);
    sendSuccess(res, teams, 'Tournament teams retrieved successfully');
  }

  static async getTeamById(req: Request, res: Response): Promise<void> {
    const teamId = (req.params.teamId || req.params.id) as string;
    const team = await TournamentService.getTeamById(teamId);
    sendSuccess(res, team, 'Tournament team retrieved successfully');
  }

  static async registerTeam(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const team = await TournamentService.registerTeam(id, req.body);
    sendSuccess(res, team, 'Tournament team registered successfully', 201);
  }

  static async updateTeam(req: Request, res: Response): Promise<void> {
    const teamId = req.params.teamId as string;
    const updated = await TournamentService.updateTeam(teamId, req.body);
    sendSuccess(res, updated, 'Tournament team updated successfully');
  }

  static async deleteTeam(req: Request, res: Response): Promise<void> {
    const teamId = req.params.teamId as string;
    await TournamentService.deleteTeam(teamId);
    sendSuccess(
      res,
      { deleted: true, teamId },
      'Tournament team deleted successfully'
    );
  }

  // ==========================================
  // FIXTURES & MATCHES
  // ==========================================

  static async generateFixtures(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const fixtures = await TournamentService.generateFixtures(id);
    sendSuccess(res, fixtures, 'Tournament fixtures generated successfully', 201);
  }

  static async getTournamentMatches(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const matches = await TournamentService.getMatches(id, req.query);
    sendSuccess(res, matches, 'Tournament matches retrieved successfully');
  }

  static async getTournamentMatchById(req: Request, res: Response): Promise<void> {
    const matchId = (req.params.matchId || req.params.id) as string;
    const match = await TournamentService.getMatchById(matchId);
    sendSuccess(res, match, 'Tournament match retrieved successfully');
  }

  static async scheduleMatch(req: Request, res: Response): Promise<void> {
    const matchId = (req.params.matchId || req.params.id) as string;
    const updated = await TournamentService.scheduleMatch(matchId, req.body);
    sendSuccess(res, updated, 'Match schedule updated successfully');
  }

  static async submitMatchResult(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const matchId = req.params.matchId as string;
    const updated = await TournamentService.submitMatchResult(
      id,
      matchId,
      req.body
    );
    sendSuccess(res, updated, 'Match result submitted successfully');
  }

  // ==========================================
  // STANDINGS & LEADERBOARDS
  // ==========================================

  static async getStandings(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const standings = await TournamentService.getStandings(id);
    sendSuccess(res, standings, 'Tournament standings retrieved successfully');
  }

  static async getGoldenBoot(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const goldenBoot = await TournamentService.getGoldenBoot(id);
    sendSuccess(res, goldenBoot, 'Golden Boot rankings retrieved successfully');
  }

  // ==========================================
  // FINAL QUALIFICATION
  // ==========================================

  static async generateFinalMatch(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const finalMatch = await TournamentService.generateFinalMatch(id);
    sendSuccess(res, finalMatch, 'Final match generated successfully', 201);
  }
}
