# `src/plugins/`

Plugins are Fastify-specific cross-cutting concerns: things that need to be registered on the Fastify instance before routes run. Each plugin is wrapped with `fastify-plugin` (`fp`) so its decorators and hooks are visible to the whole app, not just the encapsulation scope in which they were registered.

## How it fits in the architecture

```
buildApp()  (src/app.ts)
  │
  ├── fastify.register(corsPlugin)         ← sets CORS headers on all responses
  ├── fastify.register(jwtPlugin)          ← adds fastify.authenticate() decorator
  ├── fastify.setErrorHandler(errorHandler)← normalizes all errors to { error, message, statusCode }
  │
  └── fastify.register(venueRoutes, ...)   ← routes run after plugins are ready
```

The key distinction: plugins add **capabilities** to the Fastify instance (decorators, hooks, lifecycle handlers). Routes **use** those capabilities.

## Files

| File | What it adds |
|---|---|
| `cors.ts` | Registers `@fastify/cors` — allows requests from `CORS_ORIGIN` (env var). Supports comma-separated origins for multiple frontends. |
| `jwt.ts` | Registers `@fastify/jwt`, augments `FastifyJWT` with `{ sub, email }` payload shape, and adds `fastify.authenticate` as a preHandler decorator for protected routes. |
| `error-handler.ts` | Exported as a plain function (not a plugin). Attached via `fastify.setErrorHandler()`. Normalizes Fastify validation errors, HTTP errors, and uncaught errors into a consistent `{ error, message, statusCode, details? }` envelope. |

## Adding a new plugin

The example below adds `@fastify/rate-limit` as a plugin, following the same `fp()` + `env` pattern as the existing plugins.

```ts
// src/plugins/rate-limit.ts
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { env } from '../config.js';

export const rateLimitPlugin = fp(async (fastify) => {
  await fastify.register(fastifyRateLimit, {
    // Default: 100 requests per minute for all routes
    max: 100,
    timeWindow: '1 minute',

    // Skip rate limiting in test mode
    skip: () => env.NODE_ENV === 'test',

    // Return a structured error consistent with the rest of the API
    errorResponseBuilder: (_request, context) => ({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Retry after ${context.after}.`,
      statusCode: 429,
    }),
  });
});
```

Then register it in `src/app.ts` **before** the routes:

```ts
import { rateLimitPlugin } from './plugins/rate-limit.js';

// inside buildApp(), after corsPlugin and jwtPlugin:
fastify.register(rateLimitPlugin);
```

To apply a tighter limit to a specific route (e.g. the vote endpoint), use route-level config:

```ts
f.post('/votes', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  schema: { ... },
}, async (request) => { ... });
```

## Adding a decorator

If a plugin needs to add a typed decorator to the Fastify instance (like `authenticate` in `jwt.ts`), extend the Fastify module augmentation in the same file:

```ts
// At the bottom of src/plugins/your-plugin.ts:
declare module 'fastify' {
  interface FastifyInstance {
    yourDecorator(arg: string): Promise<void>;
  }
}
```

This gives TypeScript inference on `fastify.yourDecorator(...)` everywhere in the codebase.

## Conventions

- Always wrap with `fp(async (fastify) => { ... })`. Without `fp`, Fastify encapsulates the plugin's decorators and hooks — they won't be visible to sibling route plugins.
- Read configuration from `src/config.ts`, not directly from `process.env`.
- The error handler is an exception: it's a plain function passed to `fastify.setErrorHandler()`, not a plugin, because Fastify's API requires a function signature there.
- Keep plugins focused on infrastructure wiring. If you find yourself writing business logic inside a plugin, it belongs in a service instead.
- Never import from `src/routes/` inside a plugin. The dependency graph flows one way: `routes → plugins`, never `plugins → routes`.
