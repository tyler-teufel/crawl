# `src/repositories/`

Repositories are the persistence layer. Each file exports two things: an **interface** that defines what queries are available, and an **`InMemory*` class** that satisfies that interface using plain JavaScript Maps and arrays.

## How it fits in the architecture

```
Service
  │  calls interface methods (findById, create, delete, …)
  ▼
VenueRepository (interface)
  ├── InMemoryVenueRepository   ← used now (Phase 1)
  └── DrizzleVenueRepository    ← coming in Phase 2 (same interface)
```

The interface is what services depend on. The concrete class is what `src/app.ts` wires up. Swapping Phase 1 → Phase 2 means writing a `Drizzle*` class and changing one line in `app.ts` — no service or route code changes.

## Files

| File | Interface | In-Memory implementation |
|---|---|---|
| `venue.repository.ts` | `VenueRepository` — `findMany`, `findById`, `findTrendingByCity`, `incrementVoteCount`, `decrementVoteCount`, `updateHotspotScore`, `resetDailyMetrics` | `InMemoryVenueRepository` — seeded with 3 Austin venues |
| `vote.repository.ts` | `VoteRepository` — `findByUserAndDate`, `findByUserVenueDate`, `create`, `delete`, `resetByDate`, `countByVenueAndDate` | `InMemoryVoteRepository` — Map keyed by vote UUID |
| `user.repository.ts` | `UserRepository` — `findByEmail`, `findById`, `create`, `updateCity` | `InMemoryUserRepository` — Map + email index for O(1) lookups |

## Adding a new repository

### 1. Define the interface and in-memory implementation

```ts
// src/repositories/highlight.repository.ts
import { randomUUID } from 'node:crypto';

// ── Types ──────────────────────────────────────────────────────────

export interface Highlight {
  id: string;
  venueId: string;
  title: string;
  addedBy: string;   // userId
  createdAt: string;
}

export interface HighlightFilters {
  city?: string;
  venueId?: string;
}

// ── Interface (what the service depends on) ────────────────────────

export interface HighlightRepository {
  findMany(filters: HighlightFilters, limit: number): Promise<Highlight[]>;
  findById(id: string): Promise<Highlight | null>;
  countByVenue(venueId: string): Promise<number>;
  create(data: { venueId: string; title: string; addedBy: string }): Promise<Highlight>;
  delete(id: string): Promise<boolean>;
}

// ── In-memory implementation (Phase 1) ────────────────────────────

export class InMemoryHighlightRepository implements HighlightRepository {
  private highlights: Map<string, Highlight> = new Map();

  async findMany(filters: HighlightFilters, limit: number): Promise<Highlight[]> {
    let results = [...this.highlights.values()];
    if (filters.venueId) {
      results = results.filter((h) => h.venueId === filters.venueId);
    }
    return results.slice(0, limit);
  }

  async findById(id: string): Promise<Highlight | null> {
    return this.highlights.get(id) ?? null;
  }

  async countByVenue(venueId: string): Promise<number> {
    return [...this.highlights.values()].filter((h) => h.venueId === venueId).length;
  }

  async create(data: { venueId: string; title: string; addedBy: string }): Promise<Highlight> {
    const highlight: Highlight = {
      id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.highlights.set(highlight.id, highlight);
    return highlight;
  }

  async delete(id: string): Promise<boolean> {
    return this.highlights.delete(id);
  }
}
```

### 2. Wire it into `src/app.ts`

```ts
import { InMemoryHighlightRepository } from './repositories/highlight.repository.js';
import { HighlightService } from './services/highlight.service.js';

// inside buildApp():
const highlightRepository = new InMemoryHighlightRepository();
const highlightService = new HighlightService(highlightRepository);
fastify.register(highlightRoutes, { prefix: '/api/v1', highlightService });
```

### 3. Phase 2 — add a Drizzle implementation (same interface)

```ts
// src/repositories/highlight.repository.drizzle.ts
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { highlights } from '../db/schema.js';
import type { HighlightRepository, Highlight, HighlightFilters } from './highlight.repository.js';

export class DrizzleHighlightRepository implements HighlightRepository {
  private get db() { return getDb(); }

  async findById(id: string): Promise<Highlight | null> {
    const rows = await this.db.select().from(highlights).where(eq(highlights.id, id)).limit(1);
    return rows[0] ?? null;
  }

  // … implement the rest of the interface
}
```

Then swap one line in `app.ts`:

```ts
// Before:
const highlightRepository = new InMemoryHighlightRepository();
// After:
const highlightRepository = new DrizzleHighlightRepository();
```

## Conventions

- Export the interface first, then the in-memory class. Keep them in the same file.
- Interface method names use the database query vocabulary: `findMany`, `findById`, `findBy*`, `create`, `update`, `delete`, `count*`, `reset*`.
- All methods are `async` — even in-memory implementations. This keeps the interface identical to the DB-backed version.
- In-memory implementations use `Map<string, T>` as the backing store. Build secondary indexes (e.g. `emailIndex`) as separate Maps when O(1) lookups matter.
- Never add business logic to repositories. If you find yourself writing `if` statements about domain rules, it belongs in the service.
- Seed data (for dev and tests) lives in the in-memory implementation, not in test files. Tests inherit it automatically via `buildApp()`.
