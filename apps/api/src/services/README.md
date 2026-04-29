# `src/services/`

Services contain all business logic. They are plain TypeScript classes with no HTTP coupling — no Fastify types, no `request`, no `reply`. This keeps them independently testable: a unit test calls `voteService.castVote(userId, venueId)` directly, without spinning up a server.

## How it fits in the architecture

```
Route handler
     │  calls method with typed args
     ▼
Service  ──────────────────────────────────► throws typed Error subclass
     │  calls repository methods             (VoteError, AuthError, etc.)
     ▼
Repository (interface)
     │
     ▼
In-memory (Phase 1)  or  Drizzle (Phase 2)
```

Services receive their repository dependencies via constructor injection. They depend on the repository **interface**, not the concrete class, so the Phase 2 database swap requires zero changes to service code.

## Files

| File               | Responsibility                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `venue.service.ts` | `listVenues` (filtered + paginated), `getVenue`, `getTrendingVenues`, `recalculateHotspotScores`, `resetDailyMetrics`                    |
| `vote.service.ts`  | `getVoteState`, `castVote` (enforces 3/day and dedup), `removeVote`, `resetDailyVotes`. Throws `VoteError` with typed `code` strings.    |
| `auth.service.ts`  | `register` (bcrypt hash, dedup check), `login` (bcrypt compare), `findById`, `toPublicUser` (strips `passwordHash`). Throws `AuthError`. |

## Adding a new service

### 1. Write the service class

```ts
// src/services/highlight.service.ts
import type {
  HighlightRepository,
  HighlightFilters,
} from '../repositories/highlight.repository.js';

// Define a typed error class so routes can catch and map to HTTP status codes
export class HighlightError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'HighlightError';
  }
}

export class HighlightService {
  // Depend on the interface, not the concrete class
  constructor(private readonly repo: HighlightRepository) {}

  async list(city: string | undefined, limit: number) {
    return this.repo.findMany({ city }, limit);
  }

  async findById(id: string) {
    return this.repo.findById(id);
  }

  async create(data: { title: string; venueId: string; addedBy: string }) {
    // Business rule: a venue can have at most 5 active highlights
    const existing = await this.repo.countByVenue(data.venueId);
    if (existing >= 5) {
      throw new HighlightError(
        'HIGHLIGHT_LIMIT_REACHED',
        'A venue cannot have more than 5 active highlights.'
      );
    }
    return this.repo.create(data);
  }
}
```

### 2. Write the error-to-status mapping in the route

```ts
// in src/routes/highlights.ts, inside the POST handler:
try {
  return await opts.highlightService.create(request.body);
} catch (err) {
  if (err instanceof HighlightError) {
    const statusMap: Record<string, number> = {
      HIGHLIGHT_LIMIT_REACHED: 422,
    };
    const status = statusMap[err.code] ?? 400;
    return reply.code(status).send({
      error: err.code,
      message: err.message,
      statusCode: status,
    });
  }
  throw err; // re-throw unexpected errors to the global error handler
}
```

## Conventions

- Services are pure classes — no `import type { FastifyInstance }` or any HTTP type.
- Always inject repositories via the constructor. Never instantiate them inside the service.
- Throw a typed `Error` subclass with a `code` string for every business-rule violation. Routes catch these and map them to status codes.
- Use descriptive `code` strings in `SCREAMING_SNAKE_CASE` — they appear in API error responses and are useful for client-side error handling.
- Keep methods focused: each method maps to one user action or one query. If a method grows beyond ~20 lines of logic, consider splitting.
- No `console.log` in services — use the Fastify logger from the route layer if observability is needed.
