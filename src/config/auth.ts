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

export const auth = betterAuth({
  database: mongodbAdapter(dbProxy),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    env.CLIENT_URL,
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
  ],
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
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
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
 * Uses Better Auth's internal adapter and password hashing mechanism.
 */
export async function initializeAdmin(): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL.toLowerCase().trim();
  const adminPassword = env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('[Auth] ADMIN_EMAIL or ADMIN_PASSWORD is missing. Initial admin setup skipped.');
    return;
  }

  const ctx = await auth.$context;
  const existingUser = await ctx.adapter.findOne<any>({
    model: 'user',
    where: [{ field: 'email', value: adminEmail }],
  });

  if (existingUser) {
    console.log(`[Auth] Authorized Admin account (${adminEmail}) verified in database.`);
    return;
  }

  console.log(`[Auth] Seeding initial Admin account (${adminEmail})...`);
  const hashedPassword = await ctx.password.hash(adminPassword);
  const now = new Date();

  const user = await ctx.adapter.create<any>({
    model: 'user',
    data: {
      name: 'Morning Football Academy Admin',
      email: adminEmail,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  });

  await ctx.adapter.create({
    model: 'account',
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Keep repository collection in sync
  const db = getDB();
  await db.collection('admins').updateOne(
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

  console.log(`[Auth] Admin account (${adminEmail}) successfully initialized.`);
}
