import { z } from 'zod';
import { paginationQuerySchema } from './common.validator.js';

export const registrationStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export const genderEnum = z.enum(['male', 'female', 'other']);
export const dominantFootEnum = z.enum(['right', 'left', 'both']);
export const experienceLevelEnum = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'professional',
]);

const registrationFieldsSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address format'),
  phone: z.string().trim().min(6, 'Phone number must be at least 6 digits').max(20),
  dateOfBirth: z.coerce.date(),
  position: z.string().trim().min(2, 'Preferred position is required').max(50),
  experience: z.string().trim().min(2, 'Experience details required').max(500),
  message: z.string().trim().max(1000).optional(),
  gender: genderEnum,
  nationality: z.string().trim().min(2, 'Nationality is required').max(50),
  presentAddress: z.string().trim().min(5, 'Present address is required').max(300),
  district: z.string().trim().min(2, 'District is required').max(50),
  upazila: z.string().trim().min(2, 'Upazila is required').max(50),
  guardianName: z.string().trim().min(2, "Guardian's name is required").max(100),
  guardianPhone: z.string().trim().min(6, "Guardian's phone number is required").max(20),
  emergencyContactName: z.string().trim().min(2, 'Emergency contact name is required').max(100),
  emergencyContactPhone: z
    .string()
    .trim()
    .min(6, 'Emergency contact phone number is required')
    .max(20),
  primaryPosition: z.string().trim().min(2, 'Primary playing position is required').max(50),
  secondaryPosition: z.string().trim().max(50).optional(),
  preferredJerseyNumber: z.coerce
    .number()
    .int('Preferred jersey number must be a whole number')
    .min(1, 'Preferred jersey number must be between 1 and 99')
    .max(99, 'Preferred jersey number must be between 1 and 99'),
  dominantFoot: dominantFootEnum,
  height: z.coerce
    .number()
    .min(100, 'Height must be between 100 and 250 cm')
    .max(250, 'Height must be between 100 and 250 cm'),
  weight: z.coerce
    .number()
    .min(25, 'Weight must be between 25 and 200 kg')
    .max(200, 'Weight must be between 25 and 200 kg'),
  experienceLevel: experienceLevelEnum,
  yearsOfExperience: z.coerce
    .number()
    .int('Years of playing experience must be a whole number')
    .min(0, 'Years of playing experience cannot be negative')
    .max(50, 'Years of playing experience must be 50 or less'),
  previousClub: z.string().trim().max(200).optional(),
  previousTournaments: z.string().trim().max(300).optional(),
  achievements: z.string().trim().max(300).optional(),
  currentInstitution: z.string().trim().max(200).optional(),
  hasInjury: z.boolean(),
  injuryDetails: z.string().trim().max(500).optional(),
  allergies: z.string().trim().max(500).optional(),
  motivation: z.string().trim().min(2, 'Motivation for joining is required').max(1000),
  additionalNotes: z.string().trim().max(1000).optional(),
});

export const createRegistrationSchema = registrationFieldsSchema.superRefine((data, ctx) => {
  if (data.hasInjury && !data.injuryDetails?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['injuryDetails'],
      message: 'Injury details are required when an injury or physical limitation is reported',
    });
  }
});

export const updateRegistrationStatusSchema = z.object({
  status: registrationStatusEnum,
});

export const updateRegistrationSchema = registrationFieldsSchema.partial().extend({
  status: registrationStatusEnum.optional(),
});

export const registrationStatusParamSchema = z.object({
  status: registrationStatusEnum,
});

export const registrationQuerySchema = paginationQuerySchema.extend({
  status: registrationStatusEnum.optional(),
  search: z.string().trim().optional(),
});
