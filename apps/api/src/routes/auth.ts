import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  registerBody,
  loginBody,
  refreshBody,
  authResponseSchema,
  refreshResponseSchema,
} from '../schemas/auth.schema.js';
import { errorResponse } from '../schemas/common.schema.js';
import { AuthError, type AuthService } from '../services/auth.service.js';
import { env } from '../config.js';

interface AuthRoutesOptions {
  authService: AuthService;
}

export async function authRoutes(
  fastify: FastifyInstance,
  opts: AuthRoutesOptions,
): Promise<void> {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  const signTokens = (user: { id: string; email: string }) => {
    const accessToken = fastify.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: env.JWT_ACCESS_EXPIRY },
    );
    const refreshToken = fastify.jwt.sign(
      { sub: user.id, email: user.email, type: 'refresh' },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_EXPIRY },
    );
    return { accessToken, refreshToken, expiresIn: 900 };
  };

  /**
   * POST /api/v1/auth/register
   * Create a new user account.
   */
  f.post(
    '/auth/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new account',
        body: registerBody,
        response: {
          201: authResponseSchema,
          409: errorResponse,
          400: errorResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        const user = await opts.authService.register(request.body);
        const tokens = signTokens(user);
        return reply.code(201).send({
          user: opts.authService.toPublicUser(user),
          tokens,
        });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(409).send({
            error: err.code,
            message: err.message,
            statusCode: 409,
          });
        }
        throw err;
      }
    },
  );

  /**
   * POST /api/v1/auth/login
   * Authenticate with email and password.
   */
  f.post(
    '/auth/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Log in',
        body: loginBody,
        response: {
          200: authResponseSchema,
          401: errorResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        const user = await opts.authService.login(request.body.email, request.body.password);
        const tokens = signTokens(user);
        return { user: opts.authService.toPublicUser(user), tokens };
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(401).send({
            error: err.code,
            message: err.message,
            statusCode: 401,
          });
        }
        throw err;
      }
    },
  );

  /**
   * POST /api/v1/auth/refresh
   * Exchange a refresh token for new token pair.
   */
  f.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Refresh tokens',
        description:
          'Validates the refresh token and issues a new access + refresh token pair. ' +
          'The old refresh token is invalidated (rotation).',
        body: refreshBody,
        response: {
          200: refreshResponseSchema,
          401: errorResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        const payload = fastify.jwt.verify<{ sub: string; email: string; type?: string }>(
          request.body.refreshToken,
          { secret: env.JWT_REFRESH_SECRET },
        );

        if (payload.type !== 'refresh') {
          return reply.code(401).send({
            error: 'INVALID_TOKEN',
            message: 'Token is not a refresh token',
            statusCode: 401,
          });
        }

        const user = await opts.authService.findById(payload.sub);
        if (!user) {
          return reply.code(401).send({
            error: 'USER_NOT_FOUND',
            message: 'User no longer exists',
            statusCode: 401,
          });
        }

        const tokens = signTokens(user);
        return { tokens };
      } catch {
        return reply.code(401).send({
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
          statusCode: 401,
        });
      }
    },
  );
}
