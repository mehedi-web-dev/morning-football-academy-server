import { Request, Response } from 'express';
import { Filter } from 'mongodb';
import { GalleryRepository } from '../repositories/gallery.repository.js';
import { GalleryDocument, GalleryMediaType } from '../types/gallery.types.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination.js';

export class GalleryController {
  static async getAll(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const { category, mediaType, isPublished, sortBy, sortOrder } = req.query as {
      category?: string;
      mediaType?: GalleryMediaType;
      isPublished?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const filter: Filter<GalleryDocument> = {};

    // For public gallery, default to isPublished: true unless specified
    if (typeof isPublished === 'boolean') {
      filter.isPublished = isPublished;
    } else {
      filter.isPublished = true;
    }

    if (category) {
      filter.category = category;
    }

    if (mediaType) {
      filter.mediaType = mediaType;
    }

    const sortField = sortBy || 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [items, total] = await Promise.all([
      GalleryRepository.findWithPagination(filter, { skip, limit, sort }),
      GalleryRepository.count(filter),
    ]);

    const paginationMeta = buildPaginationMeta(total, page, limit);
    sendSuccess(res, items, 'Gallery items retrieved successfully', 200, paginationMeta);
  }

  static async getByCategory(req: Request, res: Response): Promise<void> {
    const category = req.params.category as string;
    const items = await GalleryRepository.findByCategory(category);
    sendSuccess(res, items, `Gallery items for category '${category}' retrieved successfully`);
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const item = await GalleryRepository.findById(id);

    if (!item) {
      sendError(res, `Gallery item with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, item, 'Gallery item retrieved successfully');
  }

  static async create(req: Request, res: Response): Promise<void> {
    const created = await GalleryRepository.create(req.body);
    sendSuccess(res, created, 'Gallery item created successfully', 201);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const updated = await GalleryRepository.update(id, req.body);

    if (!updated) {
      sendError(res, `Gallery item with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, updated, 'Gallery item updated successfully');
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const deleted = await GalleryRepository.delete(id);

    if (!deleted) {
      sendError(res, `Gallery item with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, { deleted: true, id }, 'Gallery item deleted successfully');
  }
}
