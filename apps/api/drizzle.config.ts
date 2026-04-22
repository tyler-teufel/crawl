import { defineConfig } from 'drizzle-kit';

/**
 * Resolve the URL drizzle-kit should use for migrations.
 *
 * Prefer DIRECT_URL (Supabase direct / session-pooler connection, port 5432)
 * because the Transaction pooler (6543) can break DDL and session-scoped
 * features some migrations need.
 *
 * In non-development environments we require DIRECT_URL explicitly — falling
 * back to DATABASE_URL can silently point migrations at the transaction
 * pooler and cause subtle failures that only surface on later runs.
 */
function resolveMigrationUrl(): string {
  const direct = process.env.DIRECT_URL;
  const database = process.env.DATABASE_URL;
  const env = process.env.NODE_ENV ?? 'development';

  if (direct) return direct;

  if (env !== 'development') {
    throw new Error(
      `drizzle.config: DIRECT_URL is required when NODE_ENV=${env}. ` +
        `Set DIRECT_URL to the Supabase direct / session-pooler connection string ` +
        `(port 5432). DATABASE_URL (transaction pooler, 6543) is unsafe for migrations.`,
    );
  }

  if (!database) {
    throw new Error(
      'drizzle.config: neither DIRECT_URL nor DATABASE_URL is set — check apps/api/.env.',
    );
  }

  console.warn(
    '[drizzle.config] DIRECT_URL not set; falling back to DATABASE_URL for local dev. ' +
      'This may fail if DATABASE_URL points at the transaction pooler (port 6543).',
  );
  return database;
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolveMigrationUrl(),
  },
  verbose: true,
  strict: true,
});
