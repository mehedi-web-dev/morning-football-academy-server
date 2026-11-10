import { Router } from 'express';
import healthRouter from './health.routes.js';
import playerRouter from './player.routes.js';
import matchRouter from './match.routes.js';
import resultRouter from './result.routes.js';
import galleryRouter from './gallery.routes.js';
import registrationRouter from './registration.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/players', playerRouter);
router.use('/matches', matchRouter);
router.use('/results', resultRouter);
router.use('/gallery', galleryRouter);
router.use('/registrations', registrationRouter);

export default router;
