import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import {
  contentSecurityPolicy,
  crossOriginOpenerPolicy,
  crossOriginResourcePolicy,
  originAgentCluster,
  referrerPolicy,
  strictTransportSecurity,
  xContentTypeOptions,
  xDnsPrefetchControl,
  xDownloadOptions,
  xFrameOptions,
  xPermittedCrossDomainPolicies,
  xPoweredBy,
  xXssProtection,
} from 'helmet';
import morgan from 'morgan';
import { toNodeHandler } from 'better-auth/node';
import { env } from './config/env.js';
import { auth } from './config/auth.js';
import { databaseMiddleware } from './database/init.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

const app: Application = express();

// Trust the immediate first-hop reverse proxy (Vercel Edge / API Gateway)
// Accurately populates req.secure, req.protocol, and req.ip without trusting arbitrary proxy chains
app.set('trust proxy', 1);

// Validate and sanitize paths for safe Vercel URL normalization
function isValidNormalizedPath(p: string): boolean {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//')) {
    return false;
  }
  // Disallow null bytes, control characters, backslashes, and path traversal
  if (/[\0\r\n\\]/.test(p) || p.includes('/../') || p.endsWith('/..') || p === '..') {
    return false;
  }
  // Disallow circular routing to internal serverless entrypoints
  const basePath = p.split('?')[0].replace(/\/+$/, '');
  if (basePath === '/api/index' || basePath === '/api/index.js' || basePath === '/api') {
    return false;
  }
  return true;
}

// Hardened request path normalization for Vercel Edge rewrites
app.use((req, _res, next) => {
  // Only attempt normalization if req.url matches the Vercel rewrite destination
  const isRewrittenEntrypoint =
    req.url === '/api' ||
    req.url === '/api/index' ||
    req.url === '/api/index.js' ||
    req.url.startsWith('/api/index?') ||
    req.url.startsWith('/api?');

  if (!isRewrittenEntrypoint) {
    return next();
  }

  // Strictly accept only the Vercel platform-managed 'x-matched-path' header.
  // Never trust user-controlled or arbitrary headers like x-forwarded-uri.
  const rawMatchedPath = req.headers['x-matched-path'];
  const matchedPath = Array.isArray(rawMatchedPath) ? rawMatchedPath[0] : rawMatchedPath;

  if (matchedPath && isValidNormalizedPath(matchedPath)) {
    const queryIndex = req.url.indexOf('?');
    const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
    const normalizedUrl = matchedPath.includes('?') ? matchedPath : `${matchedPath}${queryString}`;
    req.url = normalizedUrl;
    req.originalUrl = normalizedUrl;
  }

  next();
});

// Security HTTP headers (comprehensive Helmet security suite)
app.use([
  contentSecurityPolicy(),
  crossOriginOpenerPolicy(),
  crossOriginResourcePolicy(),
  originAgentCluster(),
  referrerPolicy(),
  strictTransportSecurity(),
  xContentTypeOptions(),
  xDnsPrefetchControl(),
  xDownloadOptions(),
  xFrameOptions(),
  xPermittedCrossDomainPolicies(),
  xPoweredBy(),
  xXssProtection(),
]);

// Production frontend origin definition
const PRODUCTION_FRONTEND_ORIGIN = 'https://morning-football-academy.vercel.app';

function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin.trim());
}

// Construct strictly allowed origins based on environment
const allowedOrigins: string[] = [PRODUCTION_FRONTEND_ORIGIN];

if (env.CLIENT_URL) {
  const isLocal = isLocalhostOrigin(env.CLIENT_URL);
  // In production, strictly reject localhost origins even if configured in CLIENT_URL
  if (env.NODE_ENV === 'production') {
    if (!isLocal && env.CLIENT_URL !== PRODUCTION_FRONTEND_ORIGIN) {
      allowedOrigins.push(env.CLIENT_URL);
    }
  } else {
    allowedOrigins.push(env.CLIENT_URL);
  }
}

if (env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  );
}

const normalizedAllowedOrigins = Array.from(
  new Set(allowedOrigins.map((o) => o.trim().replace(/\/+$/, '')))
);

// Strict CORS configuration supporting credentials for authorized origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman, health checks)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');

      // In production, strictly reject any localhost origin
      if (env.NODE_ENV === 'production' && isLocalhostOrigin(normalizedOrigin)) {
        return callback(null, false);
      }

      if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Reject all unauthorized origins (no permissive fallback)
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

// HTTP request logger
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Ensure database connection and one-time initialization before Auth or API execution
app.use(databaseMiddleware);

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
