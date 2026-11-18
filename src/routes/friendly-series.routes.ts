import { Router } from 'express';
import { FriendlySeriesController } from '../controllers/friendly-series.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validate.middleware.js';
import { slugParamSchema } from '../validators/common.validator.js';
import {
  createFriendlySeriesSchema,
  updateFriendlySeriesSchema,
  friendlySeriesQuerySchema,
  scheduleFriendlyMatchSchema,
  updateFriendlyMatchScheduleSchema,
  submitFriendlyMatchResultSchema,
  seriesIdParamSchema,
  seriesMatchParamsSchema,
} from '../validators/friendly-series.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// ==========================================
// 1. PUBLIC SERIES ROUTES
// ==========================================

// GET / - List friendly series with pagination & filters
router.get(
  '/',
  validateQuery(friendlySeriesQuerySchema),
  asyncHandler(FriendlySeriesController.listSeries)
);

// GET /slug/:slug - Get series by slug
router.get(
  '/slug/:slug',
  validateParams(slugParamSchema),
  asyncHandler(FriendlySeriesController.getSeriesBySlug)
);

// GET /:id - Get series by ID
router.get(
  '/:id',
  validateParams(seriesIdParamSchema),
  asyncHandler(FriendlySeriesController.getSeriesById)
);

// GET /:id/standings - View series statistics, standings, and champion status
router.get(
  '/:id/standings',
  validateParams(seriesIdParamSchema),
  asyncHandler(FriendlySeriesController.getSeriesStats)
);

// GET /:id/top-scorers - View top goal scorers leaderboard
router.get(
  '/:id/top-scorers',
  validateParams(seriesIdParamSchema),
  asyncHandler(FriendlySeriesController.getTopScorers)
);

// GET /:id/players - View players of both teams in the series separated by team
router.get(
  '/:id/players',
  validateParams(seriesIdParamSchema),
  asyncHandler(FriendlySeriesController.getSeriesPlayers)
);

// GET /:id/matches - List all matches in a series
router.get(
  '/:id/matches',
  validateParams(seriesIdParamSchema),
  asyncHandler(FriendlySeriesController.getMatches)
);

// GET /:id/matches/:matchId - View specific match details
router.get(
  '/:id/matches/:matchId',
  validateParams(seriesMatchParamsSchema),
  asyncHandler(FriendlySeriesController.getMatchById)
);

// ==========================================
// 2. ADMIN SERIES MANAGEMENT ROUTES
// ==========================================

// POST / - Create friendly series (Admin)
router.post(
  '/',
  requireAdmin,
  validateBody(createFriendlySeriesSchema),
  asyncHandler(FriendlySeriesController.createSeries)
);

// PATCH /:id - Update series details (Admin)
router.patch(
  '/:id',
  requireAdmin,
  validateParams(seriesIdParamSchema),
  validateBody(updateFriendlySeriesSchema),
  asyncHandler(FriendlySeriesController.updateSeries)
);

// DELETE /:id - Delete series (Admin)
router.delete(
  '/:id',
  requireAdmin,
  validateParams(seriesIdParamSchema),
  asyncHandler(FriendlySeriesController.deleteSeries)
);

// POST /:id/matches - Schedule a match in the series (Admin)
router.post(
  '/:id/matches',
  requireAdmin,
  validateParams(seriesIdParamSchema),
  validateBody(scheduleFriendlyMatchSchema),
  asyncHandler(FriendlySeriesController.scheduleMatch)
);

// PATCH /:id/matches/:matchId/schedule - Update match schedule (Admin)
router.patch(
  '/:id/matches/:matchId/schedule',
  requireAdmin,
  validateParams(seriesMatchParamsSchema),
  validateBody(updateFriendlyMatchScheduleSchema),
  asyncHandler(FriendlySeriesController.updateMatchSchedule)
);

// POST /:id/matches/:matchId/result - Record match result (Admin)
router.post(
  '/:id/matches/:matchId/result',
  requireAdmin,
  validateParams(seriesMatchParamsSchema),
  validateBody(submitFriendlyMatchResultSchema),
  asyncHandler(FriendlySeriesController.submitMatchResult)
);

// PUT /:id/matches/:matchId/result - Correct match result (Admin)
router.put(
  '/:id/matches/:matchId/result',
  requireAdmin,
  validateParams(seriesMatchParamsSchema),
  validateBody(submitFriendlyMatchResultSchema),
  asyncHandler(FriendlySeriesController.submitMatchResult)
);

// PATCH /:id/matches/:matchId/result - Correct match result (Admin)
router.patch(
  '/:id/matches/:matchId/result',
  requireAdmin,
  validateParams(seriesMatchParamsSchema),
  validateBody(submitFriendlyMatchResultSchema),
  asyncHandler(FriendlySeriesController.submitMatchResult)
);

export default router;
