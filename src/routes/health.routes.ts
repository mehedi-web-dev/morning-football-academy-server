import { Router, Request, Response } from 'express';
import { isDBConnected } from '../config/db.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbConnected = await isDBConnected();

  const healthData = {
    status: dbConnected ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbConnected ? 'connected' : 'disconnected',
      },
    },
  };

  const statusCode = dbConnected ? 200 : 503;
  res.status(statusCode).json({
    success: dbConnected,
    data: healthData,
  });
});

export default router;
