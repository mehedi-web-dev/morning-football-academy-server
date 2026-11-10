import { Router } from 'express';
import { GalleryController } from '../controllers/gallery.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createGallerySchema,
  updateGallerySchema,
  galleryCategoryParamSchema,
  galleryQuerySchema,
} from '../validators/gallery.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public read routes (Note: /category/:category must be registered before /:id)
router.get('/', validateQuery(galleryQuerySchema), asyncHandler(GalleryController.getAll));
router.get(
  '/category/:category',
  validateParams(galleryCategoryParamSchema),
  asyncHandler(GalleryController.getByCategory)
);
router.get('/:id', validateParams(idParamSchema), asyncHandler(GalleryController.getById));

// Protected admin write routes
router.post('/', requireAdmin, validateBody(createGallerySchema), asyncHandler(GalleryController.create));
router.patch(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updateGallerySchema),
  asyncHandler(GalleryController.update)
);
router.delete('/:id', requireAdmin, validateParams(idParamSchema), asyncHandler(GalleryController.delete));

export default router;
