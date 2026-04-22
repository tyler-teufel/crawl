import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:8081'),

  // Postgres (Supabase Transaction Pooler, port 6543)
  DATABASE_URL: z.string().optional(),

  // Supabase project URL — used to derive the JWKS endpoint for verifying
  // user access tokens issued by Supabase Auth.
  SUPABASE_URL: z.string().optional(),
  // Only needed for legacy projects still issuing HS256-signed tokens. Once
  // the project is migrated to asymmetric JWT signing keys, omit this.
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Set to "true" to swap in-memory repos for Drizzle/Postgres repos
  USE_REAL_DB: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Local-dev JWT (not used when USE_REAL_DB=true)
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-in-production'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
