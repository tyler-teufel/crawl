import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('GET /api/v1/trending/:city', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns trending venues for a known city', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trending/Charlotte%2C%20NC',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('returns venues sorted by hotspot score descending', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trending/Charlotte%2C%20NC',
    });
    const venues = res.json() as { hotspotScore: number }[];
    for (let i = 1; i < venues.length; i++) {
      expect(venues[i - 1].hotspotScore).toBeGreaterThanOrEqual(venues[i].hotspotScore);
    }
  });

  it('respects the limit query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trending/Charlotte%2C%20NC?limit=1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('returns empty array for unknown city', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trending/Nowhere99',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('rejects limit > 50', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trending/Charlotte?limit=100',
    });
    expect(res.statusCode).toBe(400);
  });
});
