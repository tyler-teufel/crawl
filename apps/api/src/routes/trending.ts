import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { venueSchema } from '../schemas/venue.schema.js';
import { errorResponse } from '../schemas/common.schema.js';
import type { VenueService } from '../services/venue.service.js';

interface TrendingRoutesOptions {
  venueService: VenueService;
}

export async function trendingRoutes(
  fastify: FastifyInstance,
  opts: TrendingRoutesOptions
): Promise<void> {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/trending/:city
   * Returns the top venues for a city ranked by hotspot score.
   */
  f.get(
    '/trending/:city',
    {
      schema: {
        tags: ['Trending'],
        summary: 'Get trending venues for a city',
        description:
          'Returns venues for the given city sorted by hotspot score descending. ' +
          'City is a URL-encoded string (e.g. "Austin%2C+TX").',
        params: z.object({ city: z.string().min(1) }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(50).default(10),
        }),
        response: {
          200: z.array(venueSchema),
          400: errorResponse,
        },
      },
    },
    async (request) => {
      const city = decodeURIComponent(request.params.city);
      return opts.venueService.getTrendingVenues(city, request.query.limit);
    }
  );
}
