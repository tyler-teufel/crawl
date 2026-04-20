# `src/db/`

The database layer. Contains the Drizzle ORM schema (single source of truth for table structure) and the lazy connection helper. In Phase 1 the app runs entirely without a database — this directory is scaffolded and ready but nothing here is called until `DATABASE_URL` is set.

## How it fits in the architecture

```
Phase 1 (current)               Phase 2 (when DATABASE_URL is set)
─────────────────────           ─────────────────────────────────────
InMemoryRepository              DrizzleRepository
  │ (no DB needed)                │
  │                               ▼
  │                             getDb()  ──►  PostgreSQL + PostGIS
  │                               │
  │                             schema.ts  ──►  drizzle-kit migrations
  │
  └── src/db/ is unused but compiled and ready
```

When you're ready to connect a real database:
1. Set `DATABASE_URL` in `.env` (see `.env.example`).
2. Run `npm run db:generate` to create migration SQL from `schema.ts`.
3. Run `npm run db:migrate` to apply migrations.
4. Implement `Drizzle*` repository classes (see `src/repositories/README.md`).
5. Swap the in-memory constructors in `src/app.ts`.

## Files

| File | Purpose |
|---|---|
| `schema.ts` | Drizzle table definitions for `venues`, `users`, and `votes`. Single source of truth — `drizzle-kit` diffs this file to generate migrations. Also exports `$inferSelect` / `$inferInsert` TypeScript types. |
| `index.ts` | `getDb()` — lazily constructs a `node-postgres` connection pool and passes it to Drizzle. Throws a descriptive error if called without `DATABASE_URL` set, rather than silently failing at query time. |

## Schema overview

```
venues
  id (uuid, PK)           hotspot_score (int, default 0)
  name (text)             vote_count (int, default 0)
  type (text)             is_open (bool, default true)
  address (text)          is_trending (bool, default false)
  city (text)             highlights (text[], default [])
  location (text, WKT)    price_level (int 1-4)
  latitude_e6 (int)       hours (text)
  longitude_e6 (int)      description (text)
                          image_url (text, nullable)
                          created_at / updated_at (timestamptz)

users
  id (uuid, PK)    display_name (text, nullable)
  email (text, UNIQUE)  city (text)
  password_hash (text)  created_at (timestamptz)

votes
  id (uuid, PK)    voted_at (date, default CURRENT_DATE)
  user_id (uuid → users)  created_at (timestamptz)
  venue_id (uuid → venues)
  UNIQUE(user_id, venue_id, voted_at)   ← one vote per venue per day
```

> **PostGIS note:** The `location` column stores a WKT `POINT(lng lat)` string. Drizzle doesn't have a first-class PostGIS type, so geo queries will use `db.execute(sql\`...\`)` with raw PostGIS functions (`ST_DWithin`, `ST_MakePoint`). The `latitude_e6` / `longitude_e6` integer columns (lat × 10⁶) provide a B-tree indexable alternative for bounding-box pre-filters.

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
  private get db() { return getDb(); }

  async findById(id: string): Promise<Highlight | null> {
    const rows = await this.db
      .select()
      .from(highlights)
      .where(eq(highlights.id, id))
      .limit(1);
    return rows[0] ? this.toHighlight(rows[0]) : null;
  }

  async create(data: { venueId: string; title: string; addedBy: string }): Promise<Highlight> {
    const rows = await this.db.insert(highlights).values(data).returning();
    return this.toHighlight(rows[0]);
  }

  async countByVenue(venueId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(highlights)
      .where(eq(highlights.venueId, venueId));
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

- `schema.ts` is the only place table structure is defined. Never run manual `ALTER TABLE` — always update the schema and generate a migration.
- Use `getDb()` inside repository methods (lazy getter), not at import time. This ensures the module loads cleanly even if `DATABASE_URL` is absent.
- Keep `schema.ts` free of business logic — it's a structural definition only.
- Integer lat/lng (`latitude_e6`, `longitude_e6`) are for B-tree indexes. Always store and query the float representations in the repository layer's `toVenue()` mapper by dividing by `1_000_000`.
- Foreign key `onDelete: 'cascade'` is the default for child rows (votes cascade-delete when a user or venue is deleted). Override only when orphan records are intentional.
