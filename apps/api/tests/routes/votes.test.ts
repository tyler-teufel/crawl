import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

const SEED_VENUE_ID = '11111111-1111-1111-1111-111111111111';
const SEED_VENUE_ID_2 = '22222222-2222-2222-2222-222222222222';

async function registerAndLogin(app: FastifyInstance, email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123', displayName: 'Test' },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'password123' },
  });
  return loginRes.json().tokens.accessToken as string;
}

describe('Votes routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    token = await registerAndLogin(app, `votes-test-${Date.now()}@example.com`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/votes (unauthenticated)', () => {
    it('returns 401 without auth header', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/votes' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Authenticated vote flow', () => {
    it('GET /api/v1/votes returns initial vote state', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/votes',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.remainingVotes).toBe(3);
      expect(body.maxVotes).toBe(3);
      expect(body.votedVenueIds).toHaveLength(0);
    });

    it('POST /api/v1/votes casts a vote', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/votes',
        headers: { Authorization: `Bearer ${token}` },
        payload: { venueId: SEED_VENUE_ID },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.remainingVotes).toBe(2);
      expect(body.votedVenueIds).toContain(SEED_VENUE_ID);
    });

    it('POST /api/v1/votes rejects duplicate vote for same venue', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/votes',
        headers: { Authorization: `Bearer ${token}` },
        payload: { venueId: SEED_VENUE_ID },
      });
      expect(res.statusCode).toBe(409);
    });

    it('DELETE /api/v1/votes/:venueId removes the vote', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/votes/${SEED_VENUE_ID}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().votedVenueIds).not.toContain(SEED_VENUE_ID);
    });

    it('DELETE /api/v1/votes/:venueId returns 404 for non-existent vote', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/votes/${SEED_VENUE_ID_2}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('POST /api/v1/votes returns 422 after using all 3 votes', async () => {
      const venueIds = [
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
      ];
      const token2 = await registerAndLogin(app, `votes-limit-${Date.now()}@example.com`);

      for (const id of venueIds) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/votes',
          headers: { Authorization: `Bearer ${token2}` },
          payload: { venueId: id },
        });
      }

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/votes',
        headers: { Authorization: `Bearer ${token2}` },
        payload: { venueId: '11111111-1111-1111-1111-111111111111' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('POST /api/v1/votes returns 404 for unknown venue', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/votes',
        headers: { Authorization: `Bearer ${token}` },
        payload: { venueId: '00000000-0000-0000-0000-000000000000' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('POST /api/v1/votes validates UUID format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/votes',
        headers: { Authorization: `Bearer ${token}` },
        payload: { venueId: 'not-a-uuid' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
