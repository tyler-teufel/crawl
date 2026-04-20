import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './config.js';
import { corsPlugin } from './plugins/cors.js';
import { jwtPlugin } from './plugins/jwt.js';
import { errorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { venueRoutes } from './routes/venues.js';
import { voteRoutes } from './routes/votes.js';
import { trendingRoutes } from './routes/trending.js';
import { authRoutes } from './routes/auth.js';
import { InMemoryVenueRepository } from './repositories/venue.repository.js';
import { InMemoryVoteRepository } from './repositories/vote.repository.js';
import { InMemoryUserRepository } from './repositories/user.repository.js';
import { VenueService } from './services/venue.service.js';
import { VoteService } from './services/vote.service.js';
import { AuthService } from './services/auth.service.js';

export function buildApp(opts: { logger?: boolean | object } = {}): FastifyInstance {
  const fastify = Fastify({
    logger:
      opts.logger ??
      (env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
            transport:
              env.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
          }),
  }).withTypeProvider<ZodTypeProvider>();

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);
  fastify.setErrorHandler(errorHandler);

  // Plugins
  fastify.register(corsPlugin);
  fastify.register(jwtPlugin);

  // Wire up dependency graph
  const venueRepository = new InMemoryVenueRepository();
  const voteRepository = new InMemoryVoteRepository();
  const userRepository = new InMemoryUserRepository();

  const venueService = new VenueService(venueRepository);
  const voteService = new VoteService(voteRepository, venueRepository);
  const authService = new AuthService(userRepository);

  // Routes
  fastify.register(healthRoutes, { prefix: '/api/v1' });
  fastify.register(venueRoutes, { prefix: '/api/v1', venueService });
  fastify.register(voteRoutes, { prefix: '/api/v1', voteService });
  fastify.register(trendingRoutes, { prefix: '/api/v1', venueService });
  fastify.register(authRoutes, { prefix: '/api/v1', authService });

  return fastify as unknown as FastifyInstance;
}
