import { Router } from 'express';
import { MatchController } from '../controllers/match.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createMatchSchema,
  updateMatchSchema,
  matchQuerySchema,
  matchStatusParamSchema,
} from '../validators/match.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public read routes (Note: /upcoming and /status/:status must be registered before /:id)
router.get('/', validateQuery(matchQuerySchema), asyncHandler(MatchController.getAll));
router.get('/upcoming', asyncHandler(MatchController.getUpcoming));
router.get('/status/:status', validateParams(matchStatusParamSchema), asyncHandler(MatchController.getByStatus));
router.get('/:id', validateParams(idParamSchema), asyncHandler(MatchController.getById));

// Protected admin write routes
router.post('/', requireAdmin, validateBody(createMatchSchema), asyncHandler(MatchController.create));
router.patch(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updateMatchSchema),
  asyncHandler(MatchController.update)
);
router.delete('/:id', requireAdmin, validateParams(idParamSchema), asyncHandler(MatchController.delete));

export default router;
