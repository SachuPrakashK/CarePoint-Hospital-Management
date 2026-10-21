import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-that-is-at-least-32-chars';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
});

describe('API application', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports health without exposing infrastructure details', async () => {
    const { createApp } = await import('../src/app.js');
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
  it('reports liveness without checking infrastructure', async () => {
    const { createApp } = await import('../src/app.js');
    const response = await request(createApp()).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
  it('reports readiness when the database responds', async () => {
    const { prisma } = await import('../src/config/prisma.js');
    vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as never);
    const { createApp } = await import('../src/app.js');
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ready' } });
  });
  it('fails readiness safely when the database is unavailable', async () => {
    const { prisma } = await import('../src/config/prisma.js');
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection failed'));
    const { createApp } = await import('../src/app.js');
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: 'The service is temporarily unavailable.',
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(JSON.stringify(response.body)).not.toContain('connection failed');
  });
  it('returns the normalized not-found response', async () => {
    const { createApp } = await import('../src/app.js');
    const response = await request(createApp()).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
