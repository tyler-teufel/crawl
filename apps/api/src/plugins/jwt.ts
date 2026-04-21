import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config.js';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; type?: 'refresh' };
    user: { sub: string; email: string };
  }
  interface JWT {
    refresh: JWT;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

const useRealDb = process.env.USE_REAL_DB === 'true';

export const jwtPlugin = fp(async (fastify) => {
  if (useRealDb) {
    // Verify Supabase-issued JWTs using the project JWT secret
    await fastify.register(fastifyJwt, {
      secret: env.SUPABASE_JWT_SECRET!,
    });
  } else {
    // Local dev: issue and verify our own JWTs
    await fastify.register(fastifyJwt, {
      secret: env.JWT_SECRET,
      sign: { expiresIn: env.JWT_ACCESS_EXPIRY },
    });

    await fastify.register(fastifyJwt, {
      secret: env.JWT_REFRESH_SECRET,
      namespace: 'refresh',
      sign: { expiresIn: env.JWT_REFRESH_EXPIRY },
    });
  }

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();

      // When using real DB, upsert the Supabase user on every authenticated request
      if (useRealDb) {
        const { sub, email } = request.user;
        const db = getDb();
        // Insert the user record the first time we see this Supabase sub.
        // On subsequent requests the unique id constraint fires and we skip.
        await db
          .insert(users)
          .values({ id: sub, email, passwordHash: 'supabase-managed' })
          .onConflictDoNothing();
      }
    } catch {
      reply
        .code(401)
        .send({ error: 'Unauthorized', message: 'Invalid or expired token', statusCode: 401 });
    }
  });
});
