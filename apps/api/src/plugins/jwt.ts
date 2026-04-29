import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import buildGetJwks from 'get-jwks';
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
    if (!env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is required when USE_REAL_DB=true');
    }

    // Supabase user tokens signed with asymmetric signing keys (ES256/RS256)
    // are verified against the project JWKS endpoint. Tokens still signed with
    // the legacy HS256 secret (pre-migration projects) fall back to
    // SUPABASE_JWT_SECRET. Once the project is migrated in the Supabase
    // dashboard, SUPABASE_JWT_SECRET can be removed.
    const issuer = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
    const getJwks = buildGetJwks({
      max: 10,
      ttl: 10 * 60 * 1000,
      issuersWhitelist: [issuer],
    });

    await fastify.register(fastifyJwt, {
      decode: { complete: true },
      secret: async (_request: FastifyRequest, token: unknown) => {
        const { header, payload } = token as {
          header: { kid?: string; alg: string };
          payload: { iss?: string };
        };

        if (header.alg === 'HS256' || !header.kid) {
          if (!env.SUPABASE_JWT_SECRET) {
            throw new Error(
              'Legacy HS256 Supabase JWT received but SUPABASE_JWT_SECRET is not configured'
            );
          }
          return env.SUPABASE_JWT_SECRET;
        }

        return getJwks.getPublicKey({
          kid: header.kid,
          alg: header.alg,
          domain: payload.iss ?? issuer,
        });
      },
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
