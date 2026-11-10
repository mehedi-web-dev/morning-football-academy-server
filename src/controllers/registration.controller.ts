import { Request, Response } from 'express';
import { Filter } from 'mongodb';
import { RegistrationRepository } from '../repositories/registration.repository.js';
import { RegistrationDocument, RegistrationStatus } from '../types/registration.types.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination.js';

export class RegistrationController {
  // Public submission endpoint
  static async submit(req: Request, res: Response): Promise<void> {
    const created = await RegistrationRepository.create(req.body);
    sendSuccess(
      res,
      created,
      'Academy registration submitted successfully. Our team will review your application.',
      201
    );
  }

  // Admin: Get all with pagination & filters
  static async getAll(req: Request, res: Response): Promise<void> {
    const { page, limit, skip } = getPaginationOptions(req.query);
    const { status, search, sortBy, sortOrder } = req.query as {
      status?: RegistrationStatus;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const filter: Filter<RegistrationDocument> = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const sortField = sortBy || 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const [registrations, total] = await Promise.all([
      RegistrationRepository.findWithPagination(filter, { skip, limit, sort }),
      RegistrationRepository.count(filter),
    ]);

    const paginationMeta = buildPaginationMeta(total, page, limit);
    sendSuccess(res, registrations, 'Registrations retrieved successfully', 200, paginationMeta);
  }

  // Admin: Filter by status
  static async getByStatus(req: Request, res: Response): Promise<void> {
    const status = req.params.status as RegistrationStatus;
    const registrations = await RegistrationRepository.findByStatus(status);
    sendSuccess(res, registrations, `Registrations with status '${status}' retrieved successfully`);
  }

  // Admin: Get by ID
  static async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const registration = await RegistrationRepository.findById(id);

    if (!registration) {
      sendError(res, `Registration with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, registration, 'Registration retrieved successfully');
  }

  // Admin: Update status
  static async updateStatus(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const { status } = req.body as { status: RegistrationStatus };

    const updated = await RegistrationRepository.updateStatus(id, status);
    if (!updated) {
      sendError(res, `Registration with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, updated, `Registration status updated to '${status}' successfully`);
  }

  // Admin: Update registration details
  static async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const updated = await RegistrationRepository.update(id, req.body);

    if (!updated) {
      sendError(res, `Registration with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, updated, 'Registration updated successfully');
  }

  // Admin: Delete registration
  static async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const deleted = await RegistrationRepository.delete(id);

    if (!deleted) {
      sendError(res, `Registration with ID ${id} not found`, 404);
      return;
    }

    sendSuccess(res, { deleted: true, id }, 'Registration deleted successfully');
  }
}
