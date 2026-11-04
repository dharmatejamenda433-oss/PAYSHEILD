import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Resolve the backend folder regardless of where the process is started from.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  FRAUD_SERVICE_URL: z.string().url().default('http://127.0.0.1:8000'),
  FRAUD_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  STARTING_BALANCE_PAISE: z.coerce.number().int().nonnegative().default(5000000),
  RISK_MEDIUM_THRESHOLD: z.coerce.number().int().min(1).max(99).default(30),
  RISK_HIGH_THRESHOLD: z.coerce.number().int().min(2).max(100).default(70),
  HIGH_RISK_ACTION: z.enum(['review', 'decline']).default('review'),
  ML_WEIGHT: z.coerce.number().min(0).max(1).default(0.6),
  RULE_WEIGHT: z.coerce.number().min(0).max(1).default(0.4),
  LARGE_AMOUNT_THRESHOLD_PAISE: z.coerce.number().int().positive().default(2500000),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  console.error(`Invalid environment configuration:\n${issues.join('\n')}`);
  throw new Error('Environment validation failed. Copy backend/.env.example to backend/.env and fix the values.');
}

export const env = parsed.data;

export const frontendOrigins = env.FRONTEND_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
