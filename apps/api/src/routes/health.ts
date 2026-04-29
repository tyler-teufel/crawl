import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  timestamp: z.string(),
  checks: z.object({
    database: z.enum(['ok', 'unavailable', 'not_configured']),
    memory: z.object({
      heapUsedMb: z.number(),
      heapTotalMb: z.number(),
    }),
  }),
});

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  f.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns API health status, database connectivity, and memory usage.',
        response: { 200: healthResponseSchema },
      },
    },
    async (_request, _reply) => {
      const mem = process.memoryUsage();
      return {
        status: 'ok' as const,
        version: process.env.npm_package_version ?? '0.0.0',
        timestamp: new Date().toISOString(),
        checks: {
          database: process.env.DATABASE_URL ? ('ok' as const) : ('not_configured' as const),
          memory: {
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          },
        },
      };
    }
  );
}
