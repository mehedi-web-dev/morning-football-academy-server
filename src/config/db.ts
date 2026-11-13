import { MongoClient, Db } from 'mongodb';
import { env } from './env.js';

interface MongoGlobalState {
  client: MongoClient | null;
  db: Db | null;
  connectionPromise: Promise<Db> | null;
}

const globalForMongo = globalThis as unknown as {
  __mongoGlobalState?: MongoGlobalState;
};

if (!globalForMongo.__mongoGlobalState) {
  globalForMongo.__mongoGlobalState = {
    client: null,
    db: null,
    connectionPromise: null,
  };
}

const state = globalForMongo.__mongoGlobalState;

export async function connectDB(): Promise<Db> {
  if (state.db && state.client) {
    return state.db;
  }

  if (state.connectionPromise) {
    return await state.connectionPromise;
  }

  if (!env.MONGODB_URI) {
    console.warn('[Database] MONGODB_URI is not set. Database connection skipped.');
    const error: any = new Error('MONGODB_URI is not defined in environment variables');
    error.statusCode = 503;
    throw error;
  }

  state.connectionPromise = (async () => {
    try {
      const client = new MongoClient(env.MONGODB_URI, {
        readPreference: 'primaryPreferred',
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
      });

      await client.connect();
      const db = client.db(env.DB_NAME);
      state.client = client;
      state.db = db;
      console.log(`[Database] Successfully connected to MongoDB database: ${env.DB_NAME}`);
      return db;
    } catch (error: any) {
      console.error('[Database] Failed to connect to MongoDB:', error?.message || error);
      state.client = null;
      state.db = null;
      if (error && typeof error === 'object') {
        error.statusCode = 503;
      }
      throw error;
    } finally {
      state.connectionPromise = null;
    }
  })();

  return await state.connectionPromise;
}

export function getDB(): Db {
  if (!state.db) {
    const error: any = new Error(
      'Database is not initialized. Database service unavailable.'
    );
    error.statusCode = 503;
    throw error;
  }
  return state.db;
}

export async function getDBAsync(): Promise<Db> {
  if (state.db && state.client) {
    return state.db;
  }
  return await connectDB();
}

export function getMongoClient(): MongoClient | null {
  return state.client;
}

export async function isDBConnected(): Promise<boolean> {
  try {
    const activeDb = state.db || (await connectDB());
    await activeDb.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeDB(): Promise<void> {
  state.connectionPromise = null;
  if (state.client) {
    await state.client.close();
    state.client = null;
    state.db = null;
    console.log('[Database] MongoDB connection closed.');
  }
}
