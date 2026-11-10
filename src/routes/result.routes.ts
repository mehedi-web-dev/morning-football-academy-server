import { Router } from 'express';
import { ResultController } from '../controllers/result.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createResultSchema,
  updateResultSchema,
  matchIdParamSchema,
  resultQuerySchema,
} from '../validators/result.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public read routes (Note: /recent and /match/:matchId must be registered before /:id)
router.get('/', validateQuery(resultQuerySchema), asyncHandler(ResultController.getAll));
router.get('/recent', asyncHandler(ResultController.getRecent));
router.get('/match/:matchId', validateParams(matchIdParamSchema), asyncHandler(ResultController.getByMatchId));
router.get('/:id', validateParams(idParamSchema), asyncHandler(ResultController.getById));

// Protected admin write routes
router.post('/', requireAdmin, validateBody(createResultSchema), asyncHandler(ResultController.create));
router.patch(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updateResultSchema),
  asyncHandler(ResultController.update)
);
router.delete('/:id', requireAdmin, validateParams(idParamSchema), asyncHandler(ResultController.delete));

export default router;
