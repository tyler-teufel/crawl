import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  voteStateSchema,
  castVoteBody,
  removeVoteParams,
} from '../schemas/vote.schema.js';
import { errorResponse } from '../schemas/common.schema.js';
import { VoteError, type VoteService } from '../services/vote.service.js';

interface VoteRoutesOptions {
  voteService: VoteService;
}

const CAST_VOTE_ERROR_STATUS: Record<string, 404 | 409 | 422> = {
  NO_VOTES_REMAINING: 422,
  ALREADY_VOTED: 409,
  VENUE_NOT_FOUND: 404,
};

export async function voteRoutes(
  fastify: FastifyInstance,
  opts: VoteRoutesOptions,
): Promise<void> {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/votes
   * Returns the authenticated user's current vote state for today.
   */
  f.get(
    '/votes',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['Votes'],
        summary: "Get user's vote state",
        description: 'Returns remaining votes, max votes, and the IDs of venues voted for today.',
        security: [{ bearerAuth: [] }],
        response: {
          200: voteStateSchema,
          401: errorResponse,
        },
      },
    },
    async (request) => {
      return opts.voteService.getVoteState(request.user.sub);
    },
  );

  /**
   * POST /api/v1/votes
   * Cast a vote for a venue. Each user can vote for up to 3 venues per day.
   */
  f.post(
    '/votes',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['Votes'],
        summary: 'Cast a vote',
        description:
          'Cast a vote for a venue. Up to 3 votes per user per day. One vote per venue per day.',
        security: [{ bearerAuth: [] }],
        body: castVoteBody,
        response: {
          200: voteStateSchema,
          401: errorResponse,
          404: errorResponse,
          409: errorResponse,
          422: errorResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        return await opts.voteService.castVote(request.user.sub, request.body.venueId);
      } catch (err) {
        if (err instanceof VoteError) {
          const status = CAST_VOTE_ERROR_STATUS[err.code] ?? 404;
          return reply.code(status).send({
            error: err.code,
            message: err.message,
            statusCode: status,
          });
        }
        throw err;
      }
    },
  );

  /**
   * DELETE /api/v1/votes/:venueId
   * Remove today's vote for a venue.
   */
  f.delete(
    '/votes/:venueId',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['Votes'],
        summary: "Remove today's vote",
        description: "Removes the authenticated user's vote for a venue (today's vote only).",
        security: [{ bearerAuth: [] }],
        params: removeVoteParams,
        response: {
          200: voteStateSchema,
          401: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        return await opts.voteService.removeVote(request.user.sub, request.params.venueId);
      } catch (err) {
        if (err instanceof VoteError) {
          return reply.code(404).send({
            error: err.code,
            message: err.message,
            statusCode: 404,
          });
        }
        throw err;
      }
    },
  );
}
