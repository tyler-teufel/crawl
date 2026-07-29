# `src/db/`

The database layer. Contains the Drizzle ORM schema (single source of truth for table structure) and the lazy connection helper. The API can still run without a database (`USE_REAL_DB` unset selects the in-memory repositories), but Supabase Postgres is live and this schema is what's actually deployed there — see `apps/api/drizzle/` for the migration history and #76 for how the ledger was reconciled with the live schema.

## How it fits in the architecture

```
USE_REAL_DB unset (in-memory)   USE_REAL_DB=true (Supabase Postgres)
─────────────────────           ─────────────────────────────────────
InMemoryRepository              DrizzleRepository
  │ (no DB needed)                │
  │                               ▼
  │                             getDb()  ──►  PostgreSQL + PostGIS
  │                               │
  │                             schema.ts  ──►  drizzle-kit migrations
  │
  └── src/db/ is unused in this mode but compiled and ready
```

Making a schema change:

1. Set `DIRECT_URL`/`DATABASE_URL` in `.env` (see `.env.example`).
2. Edit `schema.ts`, then run `npm run db:generate` to write a migration SQL file to `apps/api/drizzle/`.
3. Run `npm run db:migrate` to apply it and record it in Drizzle's migration ledger.
4. Never run `npm run db:push` against Supabase — it applies the diff directly and leaves no record in the ledger (that's how the live schema ended up with an empty migration history in the first place; see #76).

## Files

| File        | Purpose                                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema.ts` | Drizzle table definitions for `cities`, `venues`, `users`, and `votes`. Single source of truth — `drizzle-kit` diffs this file to generate migrations. Also exports `$inferSelect` / `$inferInsert` TypeScript types. |
| `index.ts`  | `getDb()` — lazily constructs a `node-postgres` connection pool and passes it to Drizzle. Throws a descriptive error if called without `DATABASE_URL` set, rather than silently failing at query time.      |

## Schema overview

```
cities
  id (uuid, PK)           radius_meters (int, default 8000)
  slug (text, UNIQUE)     is_active (bool, default true)
  name (text)             created_at / updated_at (timestamptz)
  state (text)
  timezone (text, default 'America/New_York')
  center_lat / center_lng (numeric)

venues
  id (uuid, PK)            hotspot_score (int, default 0)
  city_id (uuid → cities)  vote_count (int, default 0)
  google_place_id (text)   is_open (bool, default true)
  name (text)              is_trending (bool, default false)
  primary_type (text)      is_active (bool, default true)
  types (text[], default []) highlights (text[], default [])
  address (text)           price_level (int, nullable)
  city (text — denormalized, unread by the mobile client; slated for removal)
  location (text, WKT)     rating (numeric, nullable)
  latitude / longitude (numeric) total_ratings (int, nullable)
  phone / website (text, nullable)
  hours (text)             description (text)
  image_url (text, nullable)
  created_at / updated_at (timestamptz)

users
  id (uuid, PK)    device_id (text, nullable)
  email (text, UNIQUE, nullable)  role (text, default 'user')
  display_name (text, nullable)  created_at (timestamptz)
  city (text, default 'Austin, TX')

votes
  id (uuid, PK)    voted_at (date, default CURRENT_DATE)
  user_id (uuid → users)  created_at (timestamptz)
  venue_id (uuid → venues)
  UNIQUE(user_id, venue_id, voted_at)   ← one vote per venue per day
```

> **PostGIS note:** The `location` column stores a WKT `POINT(lng lat)` string. Drizzle doesn't have a first-class PostGIS type, so geo queries use `db.execute(sql\`...\`)` with raw PostGIS functions (`ST_DWithin`, `ST_MakePoint`). The `latitude`/`longitude` numeric columns provide a plain B-tree indexable alternative for bounding-box pre-filters.

## Adding a new table

### 1. Define the table in `schema.ts`

```ts
// In src/db/schema.ts — add alongside the existing tables:
export const highlights = pgTable('highlights', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id')
    .notNull()
    .references(() => venues.id, { onDelete: 'cascade' }),
  addedBy: uuid('added_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Export inferred types for use in repositories
export type DbHighlight = typeof highlights.$inferSelect;
export type NewHighlight = typeof highlights.$inferInsert;
```

### 2. Generate and apply the migration

```bash
# From apps/api/ with DATABASE_URL set:
npm run db:generate   # writes a new file to apps/api/drizzle/
npm run db:migrate    # applies the migration to your database
```

### 3. Implement the Drizzle repository

```ts
// src/repositories/highlight.repository.drizzle.ts
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { highlights } from '../db/schema.js';
import type { HighlightRepository, Highlight } from './highlight.repository.js';

export class DrizzleHighlightRepository implements HighlightRepository {
  private get db() {
    return getDb();
  }

  async findById(id: string): Promise<Highlight | null> {
    const rows = await this.db.select().from(highlights).where(eq(highlights.id, id)).limit(1);
    return rows[0] ? this.toHighlight(rows[0]) : null;
  }

  async create(data: { venueId: string; title: string; addedBy: string }): Promise<Highlight> {
    const rows = await this.db.insert(highlights).values(data).returning();
    return this.toHighlight(rows[0]);
  }

  async countByVenue(venueId: string): Promise<number> {
    const rows = await this.db.select().from(highlights).where(eq(highlights.venueId, venueId));
    return rows.length;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(highlights).where(eq(highlights.id, id)).returning();
    return rows.length > 0;
  }

  private toHighlight(row: typeof highlights.$inferSelect): Highlight {
    return {
      id: row.id,
      venueId: row.venueId,
      title: row.title,
      addedBy: row.addedBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
```

## Conventions

- `schema.ts` is the only place table structure is defined. Never run manual `ALTER TABLE` and never run `drizzle-kit push` against Supabase — always update the schema, `db:generate` a migration file, and `db:migrate` to apply + record it (#76).
- Use `getDb()` inside repository methods (lazy getter), not at import time. This ensures the module loads cleanly even if `DATABASE_URL` is absent.
- Keep `schema.ts` free of business logic — it's a structural definition only.
- Foreign key `onDelete: 'cascade'` is the default for child rows (votes cascade-delete when a user or venue is deleted). Override only when orphan records are intentional.
