import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common.validator.js';

export const friendlySeriesFormatEnum = z.enum(['best_of_3', 'best_of_5']);

export const friendlySeriesStatusEnum = z.enum([
  'upcoming',
  'ongoing',
  'completed',
  'cancelled',
]);

export const friendlyMatchStatusEnum = z.enum([
  'scheduled',
  'live',
  'completed',
  'postponed',
  'cancelled',
]);

export const createFriendlySeriesSchema = z
  .object({
    name: z.string().trim().min(2, 'Series name must be at least 2 characters').max(100),
    slug: z
      .string()
      .trim()
      .min(2, 'Slug must be at least 2 characters')
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
    season: z.string().trim().min(2, 'Season is required').max(20),
    description: z.string().trim().max(1000).optional(),
    format: friendlySeriesFormatEnum,
    teamAId: objectIdSchema,
    teamBId: objectIdSchema,
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    venue: z.string().trim().max(150).optional(),
  })
  .refine((data) => data.teamAId !== data.teamBId, {
    message: 'Team A and Team B must be different teams',
    path: ['teamBId'],
  });

export const updateFriendlySeriesSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
      .optional(),
    season: z.string().trim().min(2).max(20).optional(),
    description: z.string().trim().max(1000).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    venue: z.string().trim().max(150).optional(),
    status: friendlySeriesStatusEnum.optional(),
  });

export const friendlySeriesQuerySchema = paginationQuerySchema.extend({
  status: friendlySeriesStatusEnum.optional(),
  format: friendlySeriesFormatEnum.optional(),
  season: z.string().trim().optional(),
  teamId: objectIdSchema.optional(),
});

export const scheduleFriendlyMatchSchema = z
  .object({
    matchNumber: z.coerce.number().int().min(1).max(5).optional(),
    homeTeamId: objectIdSchema,
    awayTeamId: objectIdSchema,
    matchDate: z.coerce.date().optional(),
    kickOffTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Kickoff time must be in HH:mm format')
      .optional(),
    venue: z.string().trim().min(2).max(150).optional(),
    status: friendlyMatchStatusEnum.optional(),
  })
  .refine((data) => data.homeTeamId !== data.awayTeamId, {
    message: 'Home team and away team must be different',
    path: ['awayTeamId'],
  });

export const updateFriendlyMatchScheduleSchema = z
  .object({
    matchDate: z.coerce.date().optional(),
    kickOffTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Kickoff time must be in HH:mm format')
      .optional(),
    venue: z.string().trim().min(2).max(150).optional(),
    status: friendlyMatchStatusEnum.optional(),
    homeTeamId: objectIdSchema.optional(),
    awayTeamId: objectIdSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.homeTeamId && data.awayTeamId) {
        return data.homeTeamId !== data.awayTeamId;
      }
      return true;
    },
    {
      message: 'Home team and away team must be different',
      path: ['awayTeamId'],
    }
  );

export const friendlyGoalTypeEnum = z.enum(['normal', 'own_goal']);

export const friendlyMatchGoalEventSchema = z.object({
  playerId: objectIdSchema,
  teamId: objectIdSchema,
  type: friendlyGoalTypeEnum,
  minute: z.number().int().min(1, 'Minute must be at least 1').max(130).optional(),
});

export const submitFriendlyMatchResultSchema = z.object({
  homeScore: z.number().int().nonnegative('Home score cannot be negative'),
  awayScore: z.number().int().nonnegative('Away score cannot be negative'),
  notes: z.string().trim().max(500).optional(),
  goals: z.array(friendlyMatchGoalEventSchema).optional(),
});

export const seriesIdParamSchema = z.object({
  id: objectIdSchema,
});

export const seriesMatchParamsSchema = z.object({
  id: objectIdSchema,
  matchId: objectIdSchema,
});
