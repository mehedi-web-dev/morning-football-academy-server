import { Request, Response } from 'express';
import { Filter } from 'mongodb';
import { PlayerRepository } from '../repositories/player.repository.js';
import { PlayerDocument } from '../types/player.types.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination.js';

export class PlayerController {
  static async getAll(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const { search, position, isActive, sortBy, sortOrder } = req.query as {
      search?: string;
      position?: string;
      isActive?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const filter: Filter<PlayerDocument> = {};

    if (search) {
      filter.fullName = { $regex: search, $options: 'i' };
    }

    if (position) {
      filter.position = position;
    }

    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }

    const sortField = sortBy || 'jerseyNumber';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [players, total] = await Promise.all([
      PlayerRepository.findWithPagination(filter, { skip, limit, sort }),
      PlayerRepository.count(filter),
    ]);

    const paginationMeta = buildPaginationMeta(total, page, limit);
    sendSuccess(res, players, 'Players retrieved successfully', 200, paginationMeta);
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const player = await PlayerRepository.findById(id);

    if (!player) {
      sendError(res, `Player with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, player, 'Player retrieved successfully');
  }

  static async getBySlug(req: Request, res: Response): Promise<void> {
    const slug = req.params.slug as string;
    const player = await PlayerRepository.findBySlug(slug);

    if (!player) {
      sendError(res, `Player with slug '${slug}' not found`, 404);
      return;
    }

    sendSuccess(res, player, 'Player retrieved successfully');
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { slug } = req.body;
    const existing = await PlayerRepository.findBySlug(slug);
    if (existing) {
      sendError(res, `Player with slug '${slug}' already exists`, 409);
      return;
    }

    const created = await PlayerRepository.create(req.body);
    sendSuccess(res, created, 'Player created successfully', 201);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const { slug } = req.body;

    if (slug) {
      const existing = await PlayerRepository.findBySlug(slug);
      if (existing && existing._id?.toString() !== id) {
        sendError(res, `Player with slug '${slug}' already exists`, 409);
        return;
      }
    }

    const updated = await PlayerRepository.update(id, req.body);
    if (!updated) {
      sendError(res, `Player with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, updated, 'Player updated successfully');
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const deleted = await PlayerRepository.delete(id);

    if (!deleted) {
      sendError(res, `Player with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, { deleted: true, id }, 'Player deleted successfully');
  }
}
