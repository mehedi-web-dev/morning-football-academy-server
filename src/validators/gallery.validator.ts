import { z } from 'zod';
import { paginationQuerySchema } from './common.validator.js';

export const galleryMediaTypeEnum = z.enum(['image', 'video']);

export const createGallerySchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(150),
  description: z.string().trim().max(1000).optional(),
  mediaType: galleryMediaTypeEnum,
  mediaUrl: z.string().trim().min(1, 'Media URL is required'),
  thumbnailUrl: z.string().trim().optional(),
  category: z.string().trim().min(2, 'Category is required').max(50),
  isPublished: z.boolean().default(true),
});

export const updateGallerySchema = createGallerySchema.partial();

export const galleryCategoryParamSchema = z.object({
  category: z.string().trim().min(1, 'Category cannot be empty'),
});

export const galleryQuerySchema = paginationQuerySchema.extend({
  category: z.string().trim().optional(),
  mediaType: galleryMediaTypeEnum.optional(),
  isPublished: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});
