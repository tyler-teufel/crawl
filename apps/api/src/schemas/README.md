# `src/schemas/`

Schemas are Zod object definitions that serve three purposes simultaneously:

1. **Runtime validation** — Fastify validates every incoming request against the schema before the handler runs. Invalid requests are rejected with a structured 400 before touching any business logic.
2. **Response serialization** — Fastify serializes outgoing responses through the schema, stripping any fields not declared in it (prevents accidental data leakage).
3. **TypeScript types** — `z.infer<typeof schema>` produces the TypeScript type for free. No parallel type definitions required.

## How it fits in the architecture

```
Zod schema (src/schemas/)
  │
  ├── imported into routes/ ──► Fastify validates request, serializes response
  └── imported into services/ ──► typed return values and parameters
```

The `fastify-type-provider-zod` integration means that once a schema is declared in a route's `schema.querystring`, `schema.body`, `schema.params`, or `schema.response`, TypeScript knows the exact shape of `request.query`, `request.body`, etc. with no casts.

## Files

| File               | Exports                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `common.schema.ts` | `uuidParam`, `paginationQuery`, `errorResponse` — reused across all route files                                            |
| `venue.schema.ts`  | `venueSchema` (full venue object), `venueListQuery` (GET /venues query params), `venueListResponse` (paginated wrapper)    |
| `vote.schema.ts`   | `voteStateSchema`, `castVoteBody`, `removeVoteParams`                                                                      |
| `auth.schema.ts`   | `registerBody`, `loginBody`, `refreshBody`, `userSchema`, `tokenPairSchema`, `authResponseSchema`, `refreshResponseSchema` |

## Adding a new schema file

```ts
// src/schemas/highlight.schema.ts
import { z } from 'zod';
import { paginationQuery } from './common.schema.js';

// ── Resource shape ─────────────────────────────────────────────────

export const highlightSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  title: z.string().min(1).max(120),
  addedBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

// ── Request schemas ────────────────────────────────────────────────

export const highlightListQuery = paginationQuery.extend({
  venueId: z.string().uuid().optional(),
});

export const createHighlightBody = z.object({
  venueId: z.string().uuid(),
  title: z.string().min(1).max(120),
});

// ── Response schemas ───────────────────────────────────────────────

export const highlightListResponse = z.object({
  data: z.array(highlightSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

// ── Inferred TypeScript types ──────────────────────────────────────
// Export these so services and repositories can import the type
// without importing zod themselves.

export type Highlight = z.infer<typeof highlightSchema>;
export type HighlightListQuery = z.infer<typeof highlightListQuery>;
export type CreateHighlightBody = z.infer<typeof createHighlightBody>;
```

Then use the schemas inside a route:

```ts
// src/routes/highlights.ts
import {
  highlightListQuery,
  highlightListResponse,
  highlightSchema,
  createHighlightBody,
} from '../schemas/highlight.schema.js';
import { errorResponse } from '../schemas/common.schema.js';

f.get('/highlights', {
  schema: {
    querystring: highlightListQuery,
    response: { 200: highlightListResponse, 400: errorResponse },
  },
  // request.query is now typed as HighlightListQuery — no casts needed
}, async (request) => { ... });

f.post('/highlights', {
  onRequest: [fastify.authenticate],
  schema: {
    body: createHighlightBody,
    response: { 201: highlightSchema, 400: errorResponse },
  },
  // request.body is now typed as CreateHighlightBody
}, async (request) => { ... });
```

## Conventions

- One file per resource (venue, vote, auth, highlight…). Do not put unrelated schemas in the same file.
- Always export inferred TypeScript types alongside the schemas (`export type Foo = z.infer<typeof fooSchema>`). Services and repositories import the type, not the schema.
- Reuse `paginationQuery` and `errorResponse` from `common.schema.ts` — never redefine them.
- Use `.extend()` to add fields to an existing schema rather than duplicating it.
- For optional query params that need coercion (e.g. `?limit=10`), use `z.coerce.number()` — query string values arrive as strings.
- Response schemas act as an allowlist: any field not declared is stripped from the response. Use this intentionally to avoid leaking internal fields like `passwordHash`.
