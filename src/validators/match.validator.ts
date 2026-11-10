import { z } from 'zod';
import { paginationQuerySchema } from './common.validator.js';

export const matchStatusEnum = z.enum(['upcoming', 'live', 'completed', 'postponed', 'cancelled']);
export const matchHomeAwayEnum = z.enum(['home', 'away']);

export const createMatchSchema = z.object({
  opponent: z.string().trim().min(2, 'Opponent name is required').max(100),
  opponentLogo: z.string().trim().optional(),
  competition: z.string().trim().min(2, 'Competition name is required').max(100),
  venue: z.string().trim().min(2, 'Venue is required').max(150),
  matchDate: z.coerce.date(),
  kickOffTime: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Kickoff time must be in HH:mm format'),
  homeAway: matchHomeAwayEnum,
  status: matchStatusEnum.default('upcoming'),
});

export const updateMatchSchema = createMatchSchema.partial();

export const matchQuerySchema = paginationQuerySchema.extend({
  status: matchStatusEnum.optional(),
  competition: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const matchStatusParamSchema = z.object({
  status: matchStatusEnum,
});
