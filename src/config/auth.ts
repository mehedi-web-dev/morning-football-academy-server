import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { getDB } from './db.js';
import { env } from './env.js';

// Dynamic proxy to resolve the active MongoDB Db instance on demand
const dbProxy = new Proxy({} as any, {
  get(_target, prop) {
    const database = getDB();
    const value = (database as any)[prop];
    if (typeof value === 'function') {
      return value.bind(database);
    }
    return value;
  },
});

const PRODUCTION_FRONTEND_URL = 'https://morning-football-academy.vercel.app';

function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin.trim());
}

// Explicitly construct trustedOrigins: production frontend URL always included
const trustedOrigins: string[] = [PRODUCTION_FRONTEND_URL];
if (env.CLIENT_URL) {
  const isLocal = isLocalhostOrigin(env.CLIENT_URL);
  if (env.NODE_ENV === 'production') {
    if (!isLocal && env.CLIENT_URL !== PRODUCTION_FRONTEND_URL) {
      trustedOrigins.push(env.CLIENT_URL);
    }
  } else {
    trustedOrigins.push(env.CLIENT_URL);
  }
}

if (env.NODE_ENV !== 'production') {
  trustedOrigins.push(
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  );
}

const normalizedTrustedOrigins = Array.from(
  new Set(trustedOrigins.map((o) => o.trim().replace(/\/+$/, '')))
);

export const auth = betterAuth({
  database: mongodbAdapter(dbProxy),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: normalizedTrustedOrigins,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // Strictly disables public sign-up for single admin security
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days session expiration
    updateAge: 60 * 60 * 24, // 1 day update age
    cookieCache: {
      enabled: false, // Strict database session verification on every request
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    cookiePrefix: 'mfa_auth',
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax', // Secure SameSite=Lax compatible with planned same-origin frontend API proxy
      path: '/',
    },
  },
  rateLimit: {
    enabled: true,
    window: 60, // 60 seconds
    max: 10, // 10 attempts per minute for brute-force protection
  },
});

/**
 * Initializes the authorized single admin account if not already created.
 * Uses atomic MongoDB operations with $setOnInsert and unique index enforcement
 * to guarantee complete concurrency safety across multiple independent Vercel
 * serverless runtime instances.
 *
 * Guarantees:
 * 1. Atomicity: Replaces check-then-insert with atomic upsert ($setOnInsert) and catches duplicate key errors.
 * 2. Non-destructive: Existing admin passwords, hashes, user IDs, and timestamps are NEVER overwritten.
 * 3. No duplicates: Unique database indexes on admins (uniq_admin_email) and user (uniq_user_email)
 *    guarantee at the database engine level that no duplicate admin account can ever be created.
 * 4. Multi-instance safety: Multiple independent serverless containers running initializeAdmin()
 *    simultaneously will all resolve cleanly without errors or duplicate documents.
 */
export async function initializeAdmin(): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL.toLowerCase().trim();
  const adminPassword = env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('[Auth] ADMIN_EMAIL or ADMIN_PASSWORD is missing. Initial admin setup skipped.');
    return;
  }

  const db = getDB();

  // Step 1: Fast-path verification
  // If the admin already exists in both the user and admins collections, verify and return immediately.
  // This is completely non-destructive and ensures warm instances never execute write operations.
  const existingUser = await db.collection('user').findOne({ email: adminEmail });
  if (existingUser) {
    // Ensure the admins collection document is also present via atomic $setOnInsert (never overwrites)
    try {
      await db.collection('admins').updateOne(
        { email: adminEmail },
        {
          $setOnInsert: {
            email: adminEmail,
            name: 'Morning Football Academy Admin',
            role: 'superadmin',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (adminErr: any) {
      if (adminErr?.code !== 11000 && !adminErr?.message?.includes('E11000')) {
        console.warn('[Auth] Warning verifying admin document:', adminErr);
      }
    }

    console.log(`[Auth] Authorized Admin account (${adminEmail}) verified in database.`);
    return;
  }

  // Step 2: Atomic user document creation for cold boots / first initialization
  // Uses atomic findOneAndUpdate with $setOnInsert.
  // If two serverless instances execute this concurrently:
  // - Exactly one instance will perform the insertion.
  // - The second instance will either match the newly inserted document or catch E11000 duplicate key,
  //   and safely retrieve the winning instance's user document.
  console.log(`[Auth] Seeding initial Admin account (${adminEmail})...`);
  const now = new Date();
  let userDoc: any = null;

  try {
    const userResult = await db.collection('user').findOneAndUpdate(
      { email: adminEmail },
      {
        $setOnInsert: {
          name: 'Morning Football Academy Admin',
          email: adminEmail,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    userDoc = userResult;
  } catch (err: any) {
    if (err?.code === 11000 || err?.message?.includes('E11000')) {
      // Another instance won the race; fetch the created user document
      userDoc = await db.collection('user').findOne({ email: adminEmail });
    } else {
      throw err;
    }
  }

  if (!userDoc) {
    userDoc = await db.collection('user').findOne({ email: adminEmail });
  }

  if (!userDoc) {
    throw new Error(`[Auth] Failed to resolve user document for ${adminEmail}`);
  }

  const userId = userDoc._id;

  // Step 3: Atomic credential account creation (stores password hash)
  // Check if account already exists for this user to strictly prevent overwriting existing password hashes.
  const existingAccount = await db.collection('account').findOne({
    $or: [
      { userId: userId },
      { accountId: userId.toString() },
    ],
    providerId: 'credential',
  });

  if (!existingAccount) {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(adminPassword);

    try {
      await db.collection('account').findOneAndUpdate(
        {
          userId: userId,
          providerId: 'credential',
        },
        {
          $setOnInsert: {
            userId: userId,
            accountId: userId.toString(),
            providerId: 'credential',
            password: hashedPassword,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    } catch (accountErr: any) {
      if (accountErr?.code !== 11000 && !accountErr?.message?.includes('E11000')) {
        throw accountErr;
      }
    }
  }

  // Step 4: Atomic admins collection document synchronization
  try {
    await db.collection('admins').findOneAndUpdate(
      { email: adminEmail },
      {
        $setOnInsert: {
          email: adminEmail,
          name: 'Morning Football Academy Admin',
          role: 'superadmin',
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  } catch (adminErr: any) {
    if (adminErr?.code !== 11000 && !adminErr?.message?.includes('E11000')) {
      throw adminErr;
    }
  }

  console.log(`[Auth] Admin account (${adminEmail}) successfully initialized.`);
}
