import { PaginationMeta } from './apiResponse.js';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export function getPaginationOptions(
  query: { page?: unknown; limit?: unknown },
  defaultLimit = 10,
  maxLimit = 100
): PaginationOptions {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const rawLimit = parseInt(String(query.limit || defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
