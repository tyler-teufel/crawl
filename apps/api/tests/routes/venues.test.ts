import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Venues routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/venues', () => {
    it('returns 200 with paginated venue list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/venues' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });

    it('filters venues by city', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues?city=Austin',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((v: { city: string }) => {
        expect(v.city.toLowerCase()).toContain('austin');
      });
    });

    it('filters venues by search query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues?q=Stubb',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].name).toContain("Stubb");
    });

    it('returns empty data for unknown city', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues?city=NonExistentCity99',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(0);
    });

    it('respects pagination limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues?limit=1',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeLessThanOrEqual(1);
      expect(body.pagination.limit).toBe(1);
    });

    it('rejects limit > 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues?limit=999',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/venues/:id', () => {
    it('returns venue by id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues/11111111-1111-1111-1111-111111111111',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('returns 404 for unknown venue', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues/00000000-0000-0000-0000-000000000000',
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for non-uuid id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/venues/not-a-uuid',
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
