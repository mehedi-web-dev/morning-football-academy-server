import { z } from 'zod';
import { paginationQuerySchema } from './common.validator.js';

export const playerStatusEnum = z.enum(['active', 'injured', 'inactive']);
export const dominantFootEnum = z.enum(['right', 'left', 'both']);

export const playerStatisticsSchema = z.object({
  appearances: z.number().int().nonnegative().default(0),
  goals: z.number().int().nonnegative().default(0),
  assists: z.number().int().nonnegative().default(0),
  cleanSheets: z.number().int().nonnegative().default(0),
  minutesPlayed: z.number().int().nonnegative().max(100000).default(0),
  yellowCards: z.number().int().nonnegative().max(1000).default(0),
  redCards: z.number().int().nonnegative().max(1000).default(0),
  rating: z.number().min(0).max(10).default(0),
  manOfTheMatch: z.number().int().nonnegative().max(10000).default(0),
  saves: z.number().int().nonnegative().max(100000).default(0),
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
  phoneNumber: z.string().trim().min(6).max(20).optional(),
  email: z.string().trim().email('Invalid email address format').max(100).optional(),
  currentAddress: z.string().trim().max(300).optional(),
  guardianName: z.string().trim().max(100).optional(),
  guardianPhone: z.string().trim().min(6).max(20).optional(),
  secondaryPosition: z.string().trim().max(50).optional(),
  dominantFoot: dominantFootEnum.optional(),
  playingExperienceYears: z.number().int().min(0).max(50).optional(),
  previousClub: z.string().trim().max(200).optional(),
  previousTournaments: z.string().trim().max(300).optional(),
  achievements: z.string().trim().max(300).optional(),
  playerStatus: playerStatusEnum.optional(),
  joiningDate: z.coerce.date().optional(),
  trainingGroup: z.string().trim().max(100).optional(),
  coachNotes: z.string().trim().max(2000).optional(),
  statistics: playerStatisticsSchema.default({
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    minutesPlayed: 0,
    yellowCards: 0,
    redCards: 0,
    rating: 0,
    manOfTheMatch: 0,
    saves: 0,
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
