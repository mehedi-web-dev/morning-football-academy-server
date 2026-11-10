import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common.validator.js';

export const createResultSchema = z.object({
  matchId: objectIdSchema,
  opponent: z.string().trim().min(2, 'Opponent is required').max(100),
  homeScore: z.number().int('Home score must be an integer').nonnegative('Home score cannot be negative'),
  awayScore: z.number().int('Away score must be an integer').nonnegative('Away score cannot be negative'),
  matchDate: z.coerce.date(),
  competition: z.string().trim().min(2, 'Competition is required').max(100),
  venue: z.string().trim().min(2, 'Venue is required').max(150),
});

export const updateResultSchema = createResultSchema.partial();

export const matchIdParamSchema = z.object({
  matchId: objectIdSchema,
});

export const resultQuerySchema = paginationQuerySchema.extend({
  competition: z.string().trim().optional(),
});
