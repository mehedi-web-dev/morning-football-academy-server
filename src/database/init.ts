import { Request, Response, NextFunction } from 'express';
import { Db } from 'mongodb';
import { connectDB } from '../config/db.js';
import { initializeIndexes } from './indexes.js';
import { initializeAdmin } from '../config/auth.js';
import { env } from '../config/env.js';

interface InitGlobalState {
  isInitialized: boolean;
  initPromise: Promise<Db> | null;
}

const globalForInit = globalThis as unknown as {
  __initGlobalState?: InitGlobalState;
};

if (!globalForInit.__initGlobalState) {
  globalForInit.__initGlobalState = {
    isInitialized: false,
    initPromise: null,
  };
}

const initState = globalForInit.__initGlobalState;

/**
 * Ensures that the database connection is established, and required collection
 * indexes and single admin account are initialized exactly once per runtime instance.
 *
 * Concurrent calls during cold start share the same initialization promise.
 */
export async function ensureDatabaseInitialized(): Promise<Db> {
  // Fast path: if already fully initialized, return the active database immediately
  if (initState.isInitialized) {
    return await connectDB();
  }

  // If initialization is in progress by another concurrent request, join it
  if (initState.initPromise) {
    return await initState.initPromise;
  }

  initState.initPromise = (async () => {
    try {
      // 1. Establish database connection (concurrency-safe singleton)
      const db = await connectDB();

      // 2. Ensure collection indexes exist (idempotent createIndexes)
      try {
        await initializeIndexes(db);
      } catch (indexError) {
        console.warn('[Database] Warning: Failed to ensure indexes during initialization:', indexError);
      }

      // 3. Ensure initial authorized single admin exists (idempotent, concurrency-safe)
      try {
        await initializeAdmin();
      } catch (authError) {
        console.warn('[Auth] Warning: Failed to initialize admin account during initialization:', authError);
      }

      initState.isInitialized = true;
      return db;
    } catch (err: any) {
      console.error('[Database] Error during database post-connect initialization:', err);
      if (err && typeof err === 'object') {
        err.statusCode = 503;
      }
      throw err;
    } finally {
      initState.initPromise = null;
    }
  })();

  return await initState.initPromise;
}

/**
 * Resets the initialization state (used for testing and disconnection scenarios).
 */
export function resetInitializationState(): void {
  initState.isInitialized = false;
  initState.initPromise = null;
}

/**
 * Express middleware that guarantees an active database connection and one-time
 * setup before downstream authentication handlers or API repositories are accessed.
 */
export async function databaseMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Let health endpoint report actual DB status without failing early with a 503
  if (
    req.path === '/health' ||
    req.path === '/api/v1/health' ||
    req.originalUrl === '/api/v1/health' ||
    req.path === '/' ||
    req.originalUrl === '/'
  ) {
    return next();
  }

  try {
    await ensureDatabaseInitialized();
    next();
  } catch (error: any) {
    console.error(
      `[DatabaseMiddleware] Database initialization failed for ${req.method} ${req.originalUrl}:`,
      error?.message || error
    );
    const dbError: any = new Error(
      'Database service is currently unavailable. Please retry shortly.'
    );
    dbError.statusCode = 503;
    dbError.details = env.NODE_ENV === 'development' ? error?.message : undefined;
    next(dbError);
  }
}
