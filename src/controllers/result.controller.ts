import { Request, Response } from 'express';
import { Filter } from 'mongodb';
import { ResultRepository } from '../repositories/result.repository.js';
import { MatchRepository } from '../repositories/match.repository.js';
import { ResultDocument } from '../types/result.types.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination.js';

export class ResultController {
  static async getAll(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const { competition, sortBy, sortOrder } = req.query as {
      competition?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const filter: Filter<ResultDocument> = {};
    if (competition) {
      filter.competition = { $regex: competition, $options: 'i' };
    }

    const sortField = sortBy || 'matchDate';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [results, total] = await Promise.all([
      ResultRepository.findWithPagination(filter, { skip, limit, sort }),
      ResultRepository.count(filter),
    ]);

    const paginationMeta = buildPaginationMeta(total, page, limit);
    sendSuccess(res, results, 'Results retrieved successfully', 200, paginationMeta);
  }

  static async getRecent(req: Request, res: Response): Promise<void> {
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '5'), 10)), 50);
    const recent = await ResultRepository.findRecent(limit);
    sendSuccess(res, recent, 'Recent results retrieved successfully');
  }

  static async getByMatchId(req: Request, res: Response): Promise<void> {
    const matchId = req.params.matchId as string;
    const result = await ResultRepository.findByMatchId(matchId);

    if (!result) {
      sendError(res, `Result for match ID '${matchId}' not found`, 404);
      return;
    }

    sendSuccess(res, result, 'Match result retrieved successfully');
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const result = await ResultRepository.findById(id);

    if (!result) {
      sendError(res, `Result with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, result, 'Result retrieved successfully');
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { matchId } = req.body;

    // 1. Ensure referenced match exists
    const match = await MatchRepository.findById(matchId);
    if (!match) {
      sendError(res, `Referenced match with ID '${matchId}' does not exist`, 404);
      return;
    }

    // 2. Prevent duplicate results for the same match
    const existingResult = await ResultRepository.findByMatchId(matchId);
    if (existingResult) {
      sendError(res, `A result already exists for match ID '${matchId}'`, 409);
      return;
    }

    const created = await ResultRepository.create(req.body);

    // Optionally update match status to 'completed' if not already
    if (match.status !== 'completed') {
      await MatchRepository.update(matchId, { status: 'completed' });
    }

    sendSuccess(res, created, 'Result created successfully', 201);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const { matchId } = req.body;

    if (matchId) {
      const match = await MatchRepository.findById(matchId);
      if (!match) {
        sendError(res, `Referenced match with ID '${matchId}' does not exist`, 404);
        return;
      }

      const existingResult = await ResultRepository.findByMatchId(matchId);
      if (existingResult && existingResult._id?.toString() !== id) {
        sendError(res, `A result already exists for match ID '${matchId}'`, 409);
        return;
      }
    }

    const updated = await ResultRepository.update(id, req.body);
    if (!updated) {
      sendError(res, `Result with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, updated, 'Result updated successfully');
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const deleted = await ResultRepository.delete(id);

    if (!deleted) {
      sendError(res, `Result with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, { deleted: true, id }, 'Result deleted successfully');
  }
}
