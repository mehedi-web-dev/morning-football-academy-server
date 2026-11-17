import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common.validator.js';

export const tournamentStatusEnum = z.enum([
  'draft',
  'teams_registered',
  'fixtures_generated',
  'in_progress',
  'completed',
  'cancelled',
]);

export const tournamentStageEnum = z.enum(['league', 'final']);

export const tournamentMatchStatusEnum = z.enum([
  'scheduled',
  'live',
  'completed',
  'postponed',
  'cancelled',
]);

export const goalTypeEnum = z.enum(['regular', 'extra_time', 'own_goal']);

export const createTournamentSchema = z.object({
  name: z.string().trim().min(2, 'Tournament name must be at least 2 characters').max(100),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  season: z.string().trim().min(2, 'Season is required').max(20),
  description: z.string().trim().max(1000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  venue: z.string().trim().max(150).optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial().extend({
  status: tournamentStatusEnum.optional(),
});

export const tournamentQuerySchema = paginationQuerySchema.extend({
  status: tournamentStatusEnum.optional(),
  season: z.string().trim().optional(),
});

// Team registration schema: Exactly 5 or 6 unique player IDs required
export const registerTournamentTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(80),
  shortCode: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Short code must be uppercase alphanumeric')
    .optional(),
  logo: z.string().trim().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a valid hex code (e.g. #B9F66B)')
    .optional(),
  playerIds: z
    .array(objectIdSchema)
    .min(5, 'A team must have at least 5 players')
    .max(6, 'A team cannot have more than 6 players')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'All player IDs assigned to the team must be unique',
    }),
});

export const updateTournamentTeamSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  shortCode: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Short code must be uppercase alphanumeric')
    .optional(),
  logo: z.string().trim().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a valid hex code')
    .optional(),
  playerIds: z
    .array(objectIdSchema)
    .min(5, 'A team must have at least 5 players')
    .max(6, 'A team cannot have more than 6 players')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'All player IDs assigned to the team must be unique',
    })
    .optional(),
});

export const scheduleTournamentMatchSchema = z.object({
  matchDate: z.coerce.date().optional(),
  kickOffTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Kickoff time must be in HH:mm format')
    .optional(),
  venue: z.string().trim().min(2).max(150).optional(),
  status: tournamentMatchStatusEnum.optional(),
});

export const matchGoalEventSchema = z.object({
  playerId: objectIdSchema,
  teamId: objectIdSchema,
  minute: z.number().int().min(1, 'Minute must be at least 1').max(130).optional(),
  type: goalTypeEnum,
});

// Match result submission schema supporting league matches (draws allowed)
// and final matches (extra time and penalty shootout supported, must have a winner)
export const submitMatchResultSchema = z
  .object({
    stage: tournamentStageEnum.default('league'),
    homeScore: z.number().int().nonnegative('Home score cannot be negative'),
    awayScore: z.number().int().nonnegative('Away score cannot be negative'),
    regularTimeHomeScore: z.number().int().nonnegative().optional(),
    regularTimeAwayScore: z.number().int().nonnegative().optional(),
    extraTimeHomeScore: z.number().int().nonnegative().optional(),
    extraTimeAwayScore: z.number().int().nonnegative().optional(),
    wentToExtraTime: z.boolean().default(false),
    wentToPenalties: z.boolean().default(false),
    homePenaltyScore: z.number().int().nonnegative().optional(),
    awayPenaltyScore: z.number().int().nonnegative().optional(),
    winnerTeamId: objectIdSchema.nullable().optional(),
    goals: z.array(matchGoalEventSchema).default([]),
  })
  .superRefine((data, ctx) => {
    // 1. Final match requirements
    if (data.stage === 'final') {
      if (!data.winnerTeamId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['winnerTeamId'],
          message: 'A final match cannot end in a draw; a winner team ID must be specified',
        });
      }

      // If scores are tied after regular + extra time, penalties must resolve it
      if (data.homeScore === data.awayScore) {
        if (!data.wentToPenalties) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['wentToPenalties'],
            message: 'Tied final matches must be decided by penalty shootout (wentToPenalties must be true)',
          });
        }
        if (data.homePenaltyScore === undefined || data.awayPenaltyScore === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['homePenaltyScore'],
            message: 'Both home and away penalty scores must be recorded for shootout',
          });
        } else if (data.homePenaltyScore === data.awayPenaltyScore) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['homePenaltyScore'],
            message: 'Penalty shootout cannot end in a draw; one team must win',
          });
        }
      }
    }

    // 2. League match constraints (no penalty shootouts in league stage)
    if (data.stage === 'league') {
      if (data.wentToPenalties) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['wentToPenalties'],
          message: 'League matches do not have penalty shootouts (draws are allowed)',
        });
      }
      if (data.homeScore === data.awayScore && data.winnerTeamId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['winnerTeamId'],
          message: 'Drawn league matches must have null for winnerTeamId',
        });
      }
    }
  });

export const tournamentMatchQuerySchema = paginationQuerySchema.extend({
  round: z.coerce.number().int().min(1).optional(),
  stage: tournamentStageEnum.optional(),
  status: tournamentMatchStatusEnum.optional(),
  teamId: objectIdSchema.optional(),
});

export const tournamentIdParamSchema = z.object({
  id: objectIdSchema,
});

export const teamIdParamSchema = z.object({
  teamId: objectIdSchema,
});

export const tournamentMatchParamsSchema = z.object({
  id: objectIdSchema,
  matchId: objectIdSchema,
});

export const matchIdParamSchema = z.object({
  matchId: objectIdSchema,
});
