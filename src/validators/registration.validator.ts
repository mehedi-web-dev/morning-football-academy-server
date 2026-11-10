import { z } from 'zod';
import { paginationQuerySchema } from './common.validator.js';

export const registrationStatusEnum = z.enum(['pending', 'approved', 'rejected']);

export const createRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address format'),
  phone: z.string().trim().min(6, 'Phone number must be at least 6 digits').max(20),
  dateOfBirth: z.coerce.date(),
  position: z.string().trim().min(2, 'Preferred position is required').max(50),
  experience: z.string().trim().min(2, 'Experience details required').max(500),
  message: z.string().trim().max(1000).optional(),
});

export const updateRegistrationStatusSchema = z.object({
  status: registrationStatusEnum,
});

export const updateRegistrationSchema = createRegistrationSchema.partial().extend({
  status: registrationStatusEnum.optional(),
});

export const registrationStatusParamSchema = z.object({
  status: registrationStatusEnum,
});

export const registrationQuerySchema = paginationQuerySchema.extend({
  status: registrationStatusEnum.optional(),
  search: z.string().trim().optional(),
});
