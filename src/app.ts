import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import * as helmetModule from 'helmet';
import morgan from 'morgan';
import { toNodeHandler } from 'better-auth/node';
import { env } from './config/env.js';
import { auth } from './config/auth.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

const helmet = helmetModule.default ?? helmetModule;

const app: Application = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration supporting session cookies across origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) {
        return callback(null, true);
      }
      const allowedOrigins = [
        env.CLIENT_URL,
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5000',
      ];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in development
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

// HTTP request logger
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Official Better Auth Express handler (mounted before Express body parsers)
app.all('/api/auth/{*splat}', toNodeHandler(auth));

// Body parsers for general API routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Morning Football Academy API',
    version: '1.0.0',
    documentation: '/api/v1',
    authEndpoints: '/api/auth',
    healthCheck: '/api/v1/health',
  });
});

// Mount API v1 routes
app.use('/api/v1', apiRoutes);

// Handle 404 Not Found
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
