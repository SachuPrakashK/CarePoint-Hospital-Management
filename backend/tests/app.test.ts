import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-that-is-at-least-32-chars';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
});

describe('API application', () => {
  it('reports health without exposing infrastructure details', async () => {
    const { createApp } = await import('../src/app.js');
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
  it('returns the normalized not-found response', async () => {
    const { createApp } = await import('../src/app.js');
    const response = await request(createApp()).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
