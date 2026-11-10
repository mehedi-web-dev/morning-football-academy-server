import { Response } from 'express';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200,
  pagination?: PaginationMeta
): void {
  const responseBody: Record<string, unknown> = {
    success: true,
    message,
    data,
  };

  if (pagination) {
    responseBody.pagination = pagination;
  }

  res.status(statusCode).json(responseBody);
}

export function sendError(
  res: Response,
  message = 'Error description',
  statusCode = 500,
  details?: unknown
): void {
  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}
