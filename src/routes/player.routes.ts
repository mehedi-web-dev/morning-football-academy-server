import { Router } from 'express';
import { PlayerController } from '../controllers/player.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { idParamSchema, slugParamSchema } from '../validators/common.validator.js';
import {
  createPlayerSchema,
  updatePlayerSchema,
  playerQuerySchema,
} from '../validators/player.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public read routes
router.get('/', validateQuery(playerQuerySchema), asyncHandler(PlayerController.getAll));
router.get('/slug/:slug', validateParams(slugParamSchema), asyncHandler(PlayerController.getBySlug));
router.get('/:id', validateParams(idParamSchema), asyncHandler(PlayerController.getById));

// Protected admin write routes
router.post('/', requireAdmin, validateBody(createPlayerSchema), asyncHandler(PlayerController.create));
router.patch(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updatePlayerSchema),
  asyncHandler(PlayerController.update)
);
router.delete('/:id', requireAdmin, validateParams(idParamSchema), asyncHandler(PlayerController.delete));

export default router;
