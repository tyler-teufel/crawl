import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

const testUser = {
  email: 'test@example.com',
  password: 'securepassword123',
  displayName: 'Test User',
};

describe('Auth routes', () => {
  let app: FastifyInstance;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('creates a new user and returns tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.displayName).toBe(testUser.displayName);
      expect(body.tokens.accessToken).toBeDefined();
      expect(body.tokens.refreshToken).toBeDefined();
      accessToken = body.tokens.accessToken;
      refreshToken = body.tokens.refreshToken;
    });

    it('rejects duplicate email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });
      expect(res.statusCode).toBe(409);
    });

    it('validates email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { ...testUser, email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects short password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { ...testUser, email: 'other@example.com', password: 'short' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns tokens for valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: testUser.email, password: testUser.password },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tokens.accessToken).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: testUser.email, password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects unknown email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'unknown@example.com', password: 'whatever' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('issues new tokens with valid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().tokens.accessToken).toBeDefined();
    });

    it('rejects invalid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'not.a.valid.token' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects access token used as refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: accessToken },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
