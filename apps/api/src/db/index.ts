/**
 * Database connection via Drizzle ORM + node-postgres.
 *
 * The connection is only established when DATABASE_URL is set.
 * In Phase 1 (in-memory repositories), this module exports null-safe
 * helpers so the app boots cleanly without a database.
 *
 * Phase 2 usage:
 *   import { db } from './db/index.js';
 *   const venues = await db.select().from(venuesTable).where(eq(venuesTable.city, city));
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

let _db: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Configure it in .env or switch to in-memory repositories.',
      );
    }
    const pool = new pg.Pool({ connectionString: url });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

export { schema };
