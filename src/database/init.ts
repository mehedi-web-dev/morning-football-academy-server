import { Request, Response, NextFunction } from 'express';
import { Db } from 'mongodb';
import { connectDB } from '../config/db.js';
import { initializeIndexes } from './indexes.js';
import { initializeAdmin } from '../config/auth.js';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensures that the database connection is established, and required collection
 * indexes and single admin account are initialized exactly once per runtime instance.
 *
 * Concurrent calls during cold start share the same initialization promise.
 */
export async function ensureDatabaseInitialized(): Promise<Db> {
  const db = await connectDB();

  if (isInitialized) {
    return db;
  }

  if (initPromise) {
    await initPromise;
    return db;
  }

  initPromise = (async () => {
    try {
      // 1. Ensure collection indexes exist (idempotent createIndexes)
      try {
        await initializeIndexes(db);
      } catch (indexError) {
        console.warn('[Database] Warning: Failed to ensure indexes during initialization:', indexError);
      }

      // 2. Ensure initial authorized single admin exists (idempotent, never overwrites credentials)
      try {
        await initializeAdmin();
      } catch (authError) {
        console.warn('[Auth] Warning: Failed to initialize admin account during initialization:', authError);
      }

      isInitialized = true;
    } catch (err) {
      console.error('[Database] Error during database post-connect initialization:', err);
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
  return db;
}

/**
 * Resets the initialization state (used for testing and disconnection scenarios).
 */
export function resetInitializationState(): void {
  isInitialized = false;
  initPromise = null;
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
  // Let health endpoint report actual DB status without failing early with a 500
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
  } catch (error) {
    next(error);
  }
}
