import { z } from 'zod';
import { ObjectId } from 'mongodb';

export const objectIdSchema = z
  .string()
  .trim()
  .refine((val) => ObjectId.isValid(val) && new ObjectId(val).toString() === val, {
    message: 'Invalid MongoDB ObjectId format',
  });

export const idParamSchema = z.object({
  id: objectIdSchema,
});

export const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug cannot be empty')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
