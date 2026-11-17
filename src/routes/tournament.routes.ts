import { Router } from 'express';
import { TournamentController } from '../controllers/tournament.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validate.middleware.js';
import { slugParamSchema } from '../validators/common.validator.js';
import {
  createTournamentSchema,
  updateTournamentSchema,
  tournamentQuerySchema,
  registerTournamentTeamSchema,
  updateTournamentTeamSchema,
  scheduleTournamentMatchSchema,
  submitMatchResultSchema,
  tournamentMatchQuerySchema,
  tournamentIdParamSchema,
  teamIdParamSchema,
  tournamentMatchParamsSchema,
} from '../validators/tournament.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// ==========================================
// 1. SPECIFIC PUBLIC & TEAMS ROUTES (Pre-ID)
// ==========================================

// GET /tournaments - List tournaments with pagination & filter
router.get(
  '/',
  validateQuery(tournamentQuerySchema),
  asyncHandler(TournamentController.listTournaments)
);

// GET /tournaments/slug/:slug - Get tournament by slug
router.get(
  '/slug/:slug',
  validateParams(slugParamSchema),
  asyncHandler(TournamentController.getTournamentBySlug)
);

// GET /tournaments/teams/:teamId - Get team details by teamId
router.get(
  '/teams/:teamId',
  validateParams(teamIdParamSchema),
  asyncHandler(TournamentController.getTeamById)
);

// PATCH /tournaments/teams/:teamId - Update team details/roster (Admin)
router.patch(
  '/teams/:teamId',
  requireAdmin,
  validateParams(teamIdParamSchema),
  validateBody(updateTournamentTeamSchema),
  asyncHandler(TournamentController.updateTeam)
);

// DELETE /tournaments/teams/:teamId - Remove team (Admin)
router.delete(
  '/teams/:teamId',
  requireAdmin,
  validateParams(teamIdParamSchema),
  asyncHandler(TournamentController.deleteTeam)
);

// ==========================================
// 2. ADMIN TOURNAMENT CREATION
// ==========================================

// POST /tournaments - Create tournament (Admin)
router.post(
  '/',
  requireAdmin,
  validateBody(createTournamentSchema),
  asyncHandler(TournamentController.createTournament)
);

// ==========================================
// 3. TOURNAMENT-SPECIFIC PUBLIC ENDPOINTS
// ==========================================

// GET /tournaments/:id/teams - List tournament teams
router.get(
  '/:id/teams',
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.getTournamentTeams)
);

// GET /tournaments/:id/teams/:teamId - Get specific team in tournament
router.get(
  '/:id/teams/:teamId',
  validateParams(tournamentIdParamSchema.merge(teamIdParamSchema)),
  asyncHandler(TournamentController.getTeamById)
);

// GET /tournaments/:id/matches - List tournament matches
router.get(
  '/:id/matches',
  validateParams(tournamentIdParamSchema),
  validateQuery(tournamentMatchQuerySchema),
  asyncHandler(TournamentController.getTournamentMatches)
);

// GET /tournaments/:id/matches/:matchId - Get individual match
router.get(
  '/:id/matches/:matchId',
  validateParams(tournamentMatchParamsSchema),
  asyncHandler(TournamentController.getTournamentMatchById)
);

// GET /tournaments/:id/standings - Get league standings
router.get(
  '/:id/standings',
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.getStandings)
);

// GET /tournaments/:id/golden-boot - Get Golden Boot leaderboard
router.get(
  '/:id/golden-boot',
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.getGoldenBoot)
);

// GET /tournaments/:id - Get tournament details
router.get(
  '/:id',
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.getTournamentById)
);

// ==========================================
// 4. ADMIN TOURNAMENT MANAGEMENT ENDPOINTS
// ==========================================

// PATCH /tournaments/:id - Update tournament metadata
router.patch(
  '/:id',
  requireAdmin,
  validateParams(tournamentIdParamSchema),
  validateBody(updateTournamentSchema),
  asyncHandler(TournamentController.updateTournament)
);

// POST /tournaments/:id/cancel - Cancel tournament
router.post(
  '/:id/cancel',
  requireAdmin,
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.cancelTournament)
);

// DELETE /tournaments/:id - Delete tournament
router.delete(
  '/:id',
  requireAdmin,
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.deleteTournament)
);

// POST /tournaments/:id/teams - Register team to tournament
router.post(
  '/:id/teams',
  requireAdmin,
  validateParams(tournamentIdParamSchema),
  validateBody(registerTournamentTeamSchema),
  asyncHandler(TournamentController.registerTeam)
);

// POST /tournaments/:id/fixtures/generate - Generate 15 round-robin league matches
router.post(
  '/:id/fixtures/generate',
  requireAdmin,
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.generateFixtures)
);

// POST /tournaments/:id/final/generate - Generate Match 16 (Final) after 15 league matches
router.post(
  '/:id/final/generate',
  requireAdmin,
  validateParams(tournamentIdParamSchema),
  asyncHandler(TournamentController.generateFinalMatch)
);

// PATCH /tournaments/:id/matches/:matchId/schedule - Update match schedule
router.patch(
  '/:id/matches/:matchId/schedule',
  requireAdmin,
  validateParams(tournamentMatchParamsSchema),
  validateBody(scheduleTournamentMatchSchema),
  asyncHandler(TournamentController.scheduleMatch)
);

// PUT /tournaments/:id/matches/:matchId/result - Submit or correct match result
router.put(
  '/:id/matches/:matchId/result',
  requireAdmin,
  validateParams(tournamentMatchParamsSchema),
  validateBody(submitMatchResultSchema),
  asyncHandler(TournamentController.submitMatchResult)
);

export default router;
