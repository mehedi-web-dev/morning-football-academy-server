import { Request, Response } from 'express';
import { Filter } from 'mongodb';
import { MatchRepository } from '../repositories/match.repository.js';
import { MatchDocument, MatchStatus } from '../types/match.types.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination.js';

export class MatchController {
  static async getAll(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const { status, competition, from, to, sortBy, sortOrder } = req.query as {
      status?: MatchStatus;
      competition?: string;
      from?: Date;
      to?: Date;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const filter: Filter<MatchDocument> = {};

    if (status) {
      filter.status = status;
    }

    if (competition) {
      filter.competition = { $regex: competition, $options: 'i' };
    }

    if (from || to) {
      filter.matchDate = {};
      if (from) filter.matchDate.$gte = new Date(from);
      if (to) filter.matchDate.$lte = new Date(to);
    }

    const sortField = sortBy || 'matchDate';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [matches, total] = await Promise.all([
      MatchRepository.findWithPagination(filter, { skip, limit, sort }),
      MatchRepository.count(filter),
    ]);

    const paginationMeta = buildPaginationMeta(total, page, limit);
    sendSuccess(res, matches, 'Matches retrieved successfully', 200, paginationMeta);
  }

  static async getUpcoming(req: Request, res: Response): Promise<void> {
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '5'), 10)), 50);
    const upcomingMatches = await MatchRepository.findUpcoming(limit);
    sendSuccess(res, upcomingMatches, 'Upcoming matches retrieved successfully');
  }

  static async getByStatus(req: Request, res: Response): Promise<void> {
    const status = req.params.status as MatchStatus;
    const matches = await MatchRepository.findByStatus(status);
    sendSuccess(res, matches, `Matches with status '${status}' retrieved successfully`);
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const match = await MatchRepository.findById(id);

    if (!match) {
      sendError(res, `Match with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, match, 'Match retrieved successfully');
  }

  static async create(req: Request, res: Response): Promise<void> {
    const created = await MatchRepository.create(req.body);
    sendSuccess(res, created, 'Match created successfully', 201);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const updated = await MatchRepository.update(id, req.body);

    if (!updated) {
      sendError(res, `Match with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, updated, 'Match updated successfully');
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const deleted = await MatchRepository.delete(id);

    if (!deleted) {
      sendError(res, `Match with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, { deleted: true, id }, 'Match deleted successfully');
  }
}
