import { Router } from 'express';
import { RegistrationController } from '../controllers/registration.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createRegistrationSchema,
  updateRegistrationStatusSchema,
  updateRegistrationSchema,
  registrationStatusParamSchema,
  registrationQuerySchema,
} from '../validators/registration.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// 1. PUBLIC: Academy Registration Submission
router.post(
  '/',
  validateBody(createRegistrationSchema),
  asyncHandler(RegistrationController.submit)
);

// 2. PROTECTED ADMIN ROUTES: All reads, status updates, edits, deletes
router.get(
  '/',
  requireAdmin,
  validateQuery(registrationQuerySchema),
  asyncHandler(RegistrationController.getAll)
);

router.get(
  '/status/:status',
  requireAdmin,
  validateParams(registrationStatusParamSchema),
  asyncHandler(RegistrationController.getByStatus)
);

router.get(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  asyncHandler(RegistrationController.getById)
);

router.patch(
  '/:id/status',
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updateRegistrationStatusSchema),
  asyncHandler(RegistrationController.updateStatus)
);

router.patch(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validateBody(updateRegistrationSchema),
  asyncHandler(RegistrationController.update)
);

router.delete(
  '/:id',
  requireAdmin,
  validateParams(idParamSchema),
  asyncHandler(RegistrationController.delete)
);

export default router;
