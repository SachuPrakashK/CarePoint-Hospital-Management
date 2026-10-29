import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

let createApp: typeof import('../src/app.js').createApp;
let prisma: typeof import('../src/config/prisma.js').prisma;
let appointmentService: typeof import('../src/services/appointment.service.js').appointmentService;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-that-is-at-least-32-chars';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
  ({ createApp } = await import('../src/app.js'));
  ({ prisma } = await import('../src/config/prisma.js'));
  ({ appointmentService } = await import('../src/services/appointment.service.js'));
}, 15_000);

describe('API application', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports health without exposing infrastructure details', async () => {
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
  it('reports liveness without checking infrastructure', async () => {
    const response = await request(createApp()).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
  it('reports readiness when the database responds', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as never);
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ready' } });
  });
  it('fails readiness safely when the database is unavailable', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection failed'));
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: 'The service is temporarily unavailable.',
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(JSON.stringify(response.body)).not.toContain('connection failed');
  });
  it('returns the normalized not-found response', async () => {
    const response = await request(createApp()).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
  it('publishes enabled language metadata and translations without authentication', async () => {
    vi.spyOn(prisma.language, 'findMany').mockResolvedValueOnce([
      {
        id: 'language-ar',
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        enabled: true,
        isDefault: false,
        translationCoverage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        translations: [{ key: 'ui.test', value: 'اختبار' }],
      },
    ] as never);

    const response = await request(createApp()).get('/api/v1/languages/public');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ code: 'ar', enabled: true });
    expect(response.body.data[0].translations).toEqual([{ key: 'ui.test', value: 'اختبار' }]);
  });
  it('rejects patient reassignment through a completed appointment', async () => {
    vi.spyOn(prisma.appointment, 'findUnique').mockResolvedValueOnce({
      id: 'appointment-1',
      status: 'COMPLETED',
      patientId: 'patient-1',
    } as never);
    const update = vi.spyOn(prisma.appointment, 'update');

    await expect(
      appointmentService.update('appointment-1', { patientId: 'patient-2' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'COMPLETED_APPOINTMENT_PATIENT_READ_ONLY',
    });
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects rescheduling a completed appointment before making database changes', async () => {
    vi.spyOn(prisma.appointment, 'findUnique').mockResolvedValueOnce({
      id: 'appointment-1',
      status: 'COMPLETED',
      patientId: 'patient-1',
    } as never);
    const transaction = vi.spyOn(prisma, '$transaction');

    await expect(
      appointmentService.reschedule(
        'appointment-1',
        {
          departmentId: 'department-1',
          doctorId: 'doctor-1',
          appointmentAt: new Date(Date.now() + 86_400_000).toISOString(),
          reason: 'Requested by patient',
        },
        'user-1',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'NOT_RESCHEDULABLE' });
    expect(transaction).not.toHaveBeenCalled();
  });
});
