import { Request, Response } from 'express';
import { FriendlySeriesService } from '../services/friendly-series.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination.js';
import {
  FriendlySeriesStatus,
  FriendlySeriesFormat,
} from '../types/friendly-series.types.js';

export class FriendlySeriesController {
  // ==========================================
  // 1. SERIES ENDPOINTS
  // ==========================================

  static async createSeries(req: Request, res: Response): Promise<void> {
    const series = await FriendlySeriesService.createSeries(req.body);
    sendSuccess(res, series, 'Friendly series created successfully', 201);
  }

  static async listSeries(req: Request, res: Response): Promise<void> {
    const { page, limit } = getPaginationOptions(req.query);
    const { status, format, season, teamId } = req.query as {
      status?: FriendlySeriesStatus;
      format?: FriendlySeriesFormat;
      season?: string;
      teamId?: string;
    };

    const { series, total } = await FriendlySeriesService.listSeries({
      page,
      limit,
      status,
      format,
      season,
      teamId,
    });

    const paginationMeta = buildPaginationMeta(total, page, limit);
    sendSuccess(
      res,
      series,
      'Friendly series retrieved successfully',
      200,
      paginationMeta
    );
  }

  static async getSeriesById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const seriesDetail = await FriendlySeriesService.getSeriesById(id);
    sendSuccess(res, seriesDetail, 'Friendly series details retrieved successfully');
  }

  static async getSeriesBySlug(req: Request, res: Response): Promise<void> {
    const slug = req.params.slug as string;
    const seriesDetail = await FriendlySeriesService.getSeriesBySlug(slug);
    sendSuccess(res, seriesDetail, 'Friendly series details retrieved successfully');
  }

  static async updateSeries(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const updated = await FriendlySeriesService.updateSeries(id, req.body);
    sendSuccess(res, updated, 'Friendly series updated successfully');
  }

  static async deleteSeries(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await FriendlySeriesService.deleteSeries(id);
    sendSuccess(res, { deleted: true }, 'Friendly series deleted successfully');
  }

  static async getSeriesStats(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const stats = await FriendlySeriesService.getSeriesStats(id);
    sendSuccess(res, stats, 'Friendly series statistics retrieved successfully');
  }

  static async getTopScorers(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const topScorers = await FriendlySeriesService.getTopScorers(id);
    sendSuccess(res, topScorers, 'Friendly series top scorers retrieved successfully');
  }

  static async getSeriesPlayers(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const players = await FriendlySeriesService.getSeriesPlayers(id);
    sendSuccess(res, players, 'Friendly series team players retrieved successfully');
  }

  // ==========================================
  // 2. MATCH ENDPOINTS
  // ==========================================

  static async scheduleMatch(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const match = await FriendlySeriesService.scheduleMatch(id, req.body);
    sendSuccess(res, match, 'Friendly match scheduled successfully', 201);
  }

  static async updateMatchSchedule(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const matchId = req.params.matchId as string;
    const match = await FriendlySeriesService.updateMatchSchedule(id, matchId, req.body);
    sendSuccess(res, match, 'Friendly match schedule updated successfully');
  }

  static async getMatches(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const matches = await FriendlySeriesService.getMatches(id);
    sendSuccess(res, matches, 'Friendly series matches retrieved successfully');
  }

  static async getMatchById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const matchId = req.params.matchId as string;
    const match = await FriendlySeriesService.getMatchById(id, matchId);
    sendSuccess(res, match, 'Friendly match retrieved successfully');
  }

  static async submitMatchResult(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const matchId = req.params.matchId as string;
    const result = await FriendlySeriesService.submitMatchResult(id, matchId, req.body);
    sendSuccess(res, result, 'Friendly match result recorded successfully');
  }
}
