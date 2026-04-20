import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('GET /api/v1/health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with ok status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
  });

  it('includes timestamp and version', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body = res.json();
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
  });

  it('reports database as not_configured without DATABASE_URL', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body = res.json();
    expect(body.checks.database).toBe('not_configured');
  });

  it('reports memory usage', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body = res.json();
    expect(body.checks.memory.heapUsedMb).toBeGreaterThan(0);
    expect(body.checks.memory.heapTotalMb).toBeGreaterThan(0);
  });
});
