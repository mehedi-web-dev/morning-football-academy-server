import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve .env from project root regardless of execution working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  CLIENT_URL: string;
  MONGODB_URI: string;
  DB_NAME: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const rawSecret = process.env.BETTER_AUTH_SECRET?.trim() || '';

// Security validation for production environment
if (isProduction) {
  if (!rawSecret) {
    throw new Error(
      '[Security Configuration Error] BETTER_AUTH_SECRET environment variable is missing in production.'
    );
  }
  if (rawSecret.length < 32) {
    throw new Error(
      `[Security Configuration Error] BETTER_AUTH_SECRET is too short (${rawSecret.length} chars). Minimum length is 32 characters in production.`
    );
  }
  const insecurePlaceholders = [
    'a-very-secure-random-32-character-secret-key-for-mfa',
    'change-me-in-production',
    '12345678901234567890123456789012',
    'secret-key-placeholder-32-characters',
  ];
  if (insecurePlaceholders.includes(rawSecret.toLowerCase())) {
    throw new Error(
      '[Security Configuration Error] Insecure placeholder value used for BETTER_AUTH_SECRET in production.'
    );
  }
}

// In development, use provided secret or development-only fallback (never in production)
const betterAuthSecret =
  rawSecret ||
  (isProduction ? '' : 'dev-secret-only-for-local-development-environment-min-32-chars');

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

const clientUrl =
  process.env.CLIENT_URL ||
  (isProduction
    ? 'https://morning-football-academy.vercel.app'
    : 'http://localhost:3000');

const betterAuthUrl =
  process.env.BETTER_AUTH_URL ||
  (isProduction
    ? 'https://morning-football-academy-server.vercel.app'
    : `http://localhost:${port}`);

export const env: EnvConfig = {
  PORT: port,
  NODE_ENV: nodeEnv,
  CLIENT_URL: clientUrl,
  MONGODB_URI: process.env.MONGODB_URI || '',
  DB_NAME: process.env.DB_NAME || 'morning_football_academy',
  BETTER_AUTH_SECRET: betterAuthSecret,
  BETTER_AUTH_URL: betterAuthUrl,
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@morningfootball.com').toLowerCase().trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
};
