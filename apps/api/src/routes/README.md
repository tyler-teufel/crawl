# `src/routes/`

Route handlers are the HTTP translation layer. Each file registers one logical group of endpoints on the Fastify instance. Their only job is to translate HTTP concerns (URL params, headers, status codes, error responses) into service calls — no business logic lives here.

## How it fits in the architecture

```
HTTP request
     │
     ▼
Route handler  ──►  Service  ──►  Repository  ──►  DB / in-memory
     │
     ▼ (serialized via Zod schema)
HTTP response
```

Routes receive a typed `opts` object containing the services they need. This is injected by `src/app.ts` at startup, which means routes never import services directly — they depend on the interface, not the implementation.

## Files

| File | Endpoints |
|---|---|
| `health.ts` | `GET /api/v1/health` — liveness check with DB status and memory usage |
| `venues.ts` | `GET /api/v1/venues`, `GET /api/v1/venues/:id` — list/detail with city, geo, and text filtering |
| `votes.ts` | `GET /api/v1/votes`, `POST /api/v1/votes`, `DELETE /api/v1/votes/:venueId` — authenticated daily voting flow |
| `trending.ts` | `GET /api/v1/trending/:city` — hotspot-ranked venue list for a city |
| `auth.ts` | `POST /api/v1/auth/register`, `/auth/login`, `/auth/refresh` — JWT token lifecycle |

## Adding a new route file

### 1. Define the options interface and export the plugin function

```ts
// src/routes/highlights.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { errorResponse } from '../schemas/common.schema.js';
import type { HighlightService } from '../services/highlight.service.js';

// Options are injected by app.ts — never imported directly
interface HighlightRoutesOptions {
  highlightService: HighlightService;
}

export async function highlightRoutes(
  fastify: FastifyInstance,
  opts: HighlightRoutesOptions,
): Promise<void> {
  // withTypeProvider gives fully-typed request.params / .query / .body
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/highlights
   */
  f.get(
    '/highlights',
    {
      schema: {
        tags: ['Highlights'],
        summary: 'List curated highlights',
        querystring: z.object({
          city: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(50).default(10),
        }),
        response: {
          200: z.array(z.object({ id: z.string().uuid(), title: z.string() })),
          400: errorResponse,
        },
      },
    },
    async (request) => {
      return opts.highlightService.list(request.query.city, request.query.limit);
    },
  );

  /**
   * GET /api/v1/highlights/:id
   */
  f.get(
    '/highlights/:id',
    {
      schema: {
        tags: ['Highlights'],
        summary: 'Get highlight by ID',
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ id: z.string().uuid(), title: z.string() }),
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const result = await opts.highlightService.findById(request.params.id);
      if (!result) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Highlight ${request.params.id} not found`,
          statusCode: 404,
        });
      }
      return result;
    },
  );
}
```

### 2. Register in `src/app.ts`

```ts
import { highlightRoutes } from './routes/highlights.js';
import { HighlightService } from './services/highlight.service.js';

// inside buildApp():
const highlightService = new HighlightService(highlightRepository);
fastify.register(highlightRoutes, { prefix: '/api/v1', highlightService });
```

## Conventions

- Always call `fastify.withTypeProvider<ZodTypeProvider>()` — this is what gives you typed `request.*` fields.
- Put all Zod schemas in `src/schemas/` and import them. Inline schemas are only acceptable for one-off `z.object({ id: z.string().uuid() })` params.
- Use the `errorResponse` schema from `common.schema.ts` for all non-200 responses.
- Protected routes use `onRequest: [fastify.authenticate]` — no other auth mechanism exists.
- Translate service errors (`VoteError`, `AuthError`) into HTTP codes in the route. Services never set status codes themselves.
- Return the value directly from the handler — Fastify serializes it through the Zod response schema automatically.
