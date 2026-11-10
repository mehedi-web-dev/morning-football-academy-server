import { MongoClient, Db } from 'mongodb';
import { env } from './env.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db && client) {
    return db;
  }

  if (!env.MONGODB_URI) {
    console.warn('[Database] MONGODB_URI is not set. Database connection skipped.');
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    client = new MongoClient(env.MONGODB_URI, {
      readPreference: 'primaryPreferred',
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true,
    });

    await client.connect();
    db = client.db(env.DB_NAME);
    console.log(`[Database] Successfully connected to MongoDB database: ${env.DB_NAME}`);
    return db;
  } catch (error) {
    console.error('[Database] Failed to connect to MongoDB:', error);
    client = null;
    db = null;
    throw error;
  }
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Database is not initialized. Call connectDB first.');
  }
  return db;
}

export function getMongoClient(): MongoClient | null {
  return client;
}

export async function isDBConnected(): Promise<boolean> {
  if (!client || !db) {
    try {
      await connectDB();
    } catch {
      return false;
    }
  }

  if (!db) {
    return false;
  }

  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[Database] MongoDB connection closed.');
  }
}
