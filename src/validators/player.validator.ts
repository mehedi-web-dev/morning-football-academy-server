import { z } from 'zod';
import { paginationQuerySchema } from './common.validator.js';

export const playerStatisticsSchema = z.object({
  appearances: z.number().int().nonnegative().default(0),
  goals: z.number().int().nonnegative().default(0),
  assists: z.number().int().nonnegative().default(0),
  cleanSheets: z.number().int().nonnegative().default(0),
});

export const createPlayerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  jerseyNumber: z.number().int().min(1, 'Jersey number must be at least 1').max(99, 'Jersey number must be under 100'),
  position: z.enum(['Goalkeeper', 'Defender', 'Midfielder', 'Forward']),
  nationality: z.string().trim().min(2).max(60),
  dateOfBirth: z.coerce.date(),
  height: z.string().trim().max(20).optional(),
  weight: z.string().trim().max(20).optional(),
  bio: z.string().trim().max(2000).optional(),
  photo: z.string().trim().min(1, 'Photo URL or path is required'),
  statistics: playerStatisticsSchema.default({
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
  }),
  isActive: z.boolean().default(true),
});

export const updatePlayerSchema = createPlayerSchema.partial();

export const playerQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  position: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});
