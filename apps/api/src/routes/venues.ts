import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { venueListQuery, venueListResponse, venueSchema } from '../schemas/venue.schema.js';
import { errorResponse } from '../schemas/common.schema.js';
import type { VenueService } from '../services/venue.service.js';

interface VenueRoutesOptions {
  venueService: VenueService;
}

export async function venueRoutes(
  fastify: FastifyInstance,
  opts: VenueRoutesOptions
): Promise<void> {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/venues
   * List venues with optional geo, city, and text filtering.
   */
  f.get(
    '/venues',
    {
      schema: {
        tags: ['Venues'],
        summary: 'List venues',
        description:
          'Returns a paginated list of venues. Filter by city name, geo radius, type, or full-text search. ' +
          'Filters are comma-separated venue types (e.g. "Bar,Club").',
        querystring: venueListQuery,
        response: {
          200: venueListResponse,
          400: errorResponse,
        },
      },
    },
    async (request) => {
      const { city, lat, lng, radius, q, filters, page, limit } = request.query;
      return opts.venueService.listVenues(
        { city, lat, lng, radius, q, types: filters },
        page,
        limit
      );
    }
  );

  /**
   * GET /api/v1/venues/:id
   * Single venue detail by UUID.
   */
  f.get(
    '/venues/:id',
    {
      schema: {
        tags: ['Venues'],
        summary: 'Get venue by ID',
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: venueSchema,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const venue = await opts.venueService.getVenue(request.params.id);
      if (!venue) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Venue ${request.params.id} not found`,
          statusCode: 404,
        });
      }
      return venue;
    }
  );
}
