# `tests/`

Integration and unit tests for the API, written with [Vitest](https://vitest.dev/). Tests are split into two groups:

- **`tests/routes/`** — integration tests that make real HTTP requests against a live Fastify instance using `fastify.inject()`. No network, no ports — pure in-process.
- **`tests/services/`** — unit tests that call service methods directly. No HTTP layer at all.

## How it fits in the architecture

```
tests/routes/*.test.ts
  │  builds the full app (buildApp())
  │  calls fastify.inject({ method, url, payload, headers })
  ▼
Full request lifecycle:
  CORS → JWT → Zod validation → route handler → service → in-memory repo
  ← Zod serialization ← response
        │
        ▼  asserts on statusCode + body

tests/services/*.test.ts
  │  instantiates service + in-memory repository directly
  ▼
Service method call → in-memory repo
        │
        ▼  asserts on return value or thrown error
```

Because all repositories are in-memory, every test starts with a fresh, deterministic state (`beforeAll` creates a new `buildApp()` or `new *Service(new InMemory*Repository())`). No database, no cleanup scripts, no flakiness from shared state.

## Files

### `tests/routes/`

| File               | What it tests                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `health.test.ts`   | `GET /api/v1/health` — status, timestamp, DB check, memory                                                                               |
| `venues.test.ts`   | `GET /api/v1/venues` (city filter, text search, pagination limits) and `GET /api/v1/venues/:id` (found, 404, bad UUID)                   |
| `votes.test.ts`    | Full authenticated vote flow — 401 without token, cast, dedup, remove, 3-vote limit, unknown venue                                       |
| `trending.test.ts` | `GET /api/v1/trending/:city` — sort order, limit, unknown city, limit > 50                                                               |
| `auth.test.ts`     | Register (201, duplicate 409, validation), login (200, wrong password, unknown email), refresh (valid, invalid, access-token-as-refresh) |

### `tests/services/`

| File                    | What it tests                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `venue.service.test.ts` | `listVenues` (city filter, text search, pagination, totalPages), `getVenue` (found, null), `getTrendingVenues` (sort order, limit)                                              |
| `vote.service.test.ts`  | `getVoteState`, `castVote` (vote count increments, ALREADY_VOTED, NO_VOTES_REMAINING, VENUE_NOT_FOUND), `removeVote` (count decrements, VOTE_NOT_FOUND)                         |
| `auth.service.test.ts`  | `register` (hash stored, lowercase email, EMAIL_IN_USE), `login` (correct credentials, wrong password, unknown email, case-insensitive), `toPublicUser` (passwordHash stripped) |

## Adding a new route test file

```ts
// tests/routes/highlights.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

// If you need an authenticated user, register + login first:
async function registerAndLogin(app: FastifyInstance, email: string): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123', displayName: 'Test' },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'password123' },
  });
  return res.json().tokens.accessToken as string;
}

describe('Highlights routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = buildApp(); // fresh in-memory state every test suite
    await app.ready();
    token = await registerAndLogin(app, `highlights-${Date.now()}@example.com`);
  });

  afterAll(async () => {
    await app.close(); // always close to release resources
  });

  describe('GET /api/v1/highlights', () => {
    it('returns 200 with an array', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/highlights' });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe('POST /api/v1/highlights', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/highlights',
        payload: { venueId: '11111111-1111-1111-1111-111111111111', title: 'Great vibes' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('creates a highlight and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/highlights',
        headers: { Authorization: `Bearer ${token}` },
        payload: { venueId: '11111111-1111-1111-1111-111111111111', title: 'Great vibes' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe('Great vibes');
    });

    it('returns 400 for missing required field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/highlights',
        headers: { Authorization: `Bearer ${token}` },
        payload: { venueId: '11111111-1111-1111-1111-111111111111' }, // missing title
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
```

## Adding a new service test file

```ts
// tests/services/highlight.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { HighlightService, HighlightError } from '../../src/services/highlight.service.js';
import { InMemoryHighlightRepository } from '../../src/repositories/highlight.repository.js';

const VENUE_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('HighlightService', () => {
  let service: HighlightService;

  beforeEach(() => {
    // Fresh repository for each test — no shared state between cases
    service = new HighlightService(new InMemoryHighlightRepository());
  });

  describe('create', () => {
    it('creates a highlight and returns it', async () => {
      const h = await service.create({ venueId: VENUE_ID, title: 'Live DJ', addedBy: USER_ID });
      expect(h.id).toBeDefined();
      expect(h.title).toBe('Live DJ');
    });

    it('throws HIGHLIGHT_LIMIT_REACHED after 5 highlights', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ venueId: VENUE_ID, title: `Highlight ${i}`, addedBy: USER_ID });
      }
      await expect(
        service.create({ venueId: VENUE_ID, title: 'Sixth', addedBy: USER_ID })
      ).rejects.toMatchObject({ code: 'HIGHLIGHT_LIMIT_REACHED' });
    });

    it('thrown error is a HighlightError instance', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ venueId: VENUE_ID, title: `H${i}`, addedBy: USER_ID });
      }
      const err = await service
        .create({ venueId: VENUE_ID, title: 'X', addedBy: USER_ID })
        .catch((e) => e);
      expect(err).toBeInstanceOf(HighlightError);
    });
  });
});
```

## Running tests

```bash
# From apps/api/:
npm run test           # run once
npm run test:watch     # re-run on file change
npm run test:coverage  # generate coverage report in apps/api/coverage/
```

## Conventions

- Each route test suite creates **one** `buildApp()` instance in `beforeAll` and closes it in `afterAll`. Never share an app instance across `describe` blocks in different files.
- Use `Date.now()` in email addresses (`test-${Date.now()}@example.com`) to prevent cross-test collisions inside the same suite.
- Service tests use `beforeEach` (not `beforeAll`) to get a fresh repository per test. This avoids order-dependent failures.
- Assert on `res.statusCode` first. If it's wrong, the body assertion error message is misleading — status tells you immediately what went wrong.
- Test the error `code` string (`.rejects.toMatchObject({ code: 'SOME_CODE' })`), not just the error class. This is what clients parse.
- Seed data (the 3 Austin venues) is always present. Use the seed UUIDs (`11111111-...`, `22222222-...`, `33333333-...`) directly — they are stable.
