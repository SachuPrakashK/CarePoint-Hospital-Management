import { describe, expect, it, vi, beforeAll } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-that-is-at-least-32-chars';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
});
describe('security and validation', () => {
  it('escapes CSV syntax and neutralizes spreadsheet formulas', async () => {
    const { escapeCsvCell } = await import('../src/services/reports.service.js');
    expect(escapeCsvCell('General, Medicine')).toBe('"General, Medicine"');
    expect(escapeCsvCell('A "quoted" value')).toBe('"A ""quoted"" value"');
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell('  +cmd')).toBe("'  +cmd");
  });
  it('validates reports date ranges and department identifiers', async () => {
    const { reportQuerySchema } = await import('../src/routes/reports.routes.js');
    expect(
      reportQuerySchema.safeParse({
        body: {},
        params: {},
        query: { from: '2026-10-01', to: '2026-10-19' },
      }).success,
    ).toBe(true);
    expect(
      reportQuerySchema.safeParse({
        body: {},
        params: {},
        query: { from: '2026-10-19', to: '2026-10-01' },
      }).success,
    ).toBe(false);
    expect(
      reportQuerySchema.safeParse({ body: {}, params: {}, query: { department_id: 'not-an-id' } })
        .success,
    ).toBe(false);
  });
  it('does not inject a zero quantity into partial inventory updates', async () => {
    const { inventoryItemUpdateSchema } = await import('../src/routes/phase23.routes.js');
    expect(inventoryItemUpdateSchema.parse({ store: 'Main Store' })).toEqual({
      store: 'Main Store',
    });
  });
  it('validates bounded audit queries and chronological date ranges', async () => {
    const { auditQuery } = await import('../src/routes/phase23.routes.js');
    expect(
      auditQuery.safeParse({ page: '1', page_size: '100', sort_by: 'createdAt' }).success,
    ).toBe(true);
    expect(auditQuery.safeParse({ page_size: '101' }).success).toBe(false);
    expect(auditQuery.safeParse({ sort_by: 'metadata' }).success).toBe(false);
    expect(
      auditQuery.safeParse({ created_from: '2026-10-18', created_to: '2026-10-01' }).success,
    ).toBe(false);
  });

  it('excludes retired language codes from the managed language catalog', async () => {
    const { findCatalogLanguage, LANGUAGE_CATALOG } =
      await import('../src/data/language-catalog.js');
    expect(LANGUAGE_CATALOG.some((item) => ['hi', 'ml', 'ta'].includes(item.code))).toBe(false);
    expect(findCatalogLanguage('hi')).toBeUndefined();
    expect(findCatalogLanguage('ml')).toBeUndefined();
    expect(findCatalogLanguage('ta')).toBeUndefined();
    expect(findCatalogLanguage('en')?.code).toBe('en');
  });

  it('redacts sensitive values in nested audit metadata without changing safe fields', async () => {
    const { sanitizeAuditMetadata } = await import('../src/services/phase23.service.js');
    expect(
      sanitizeAuditMetadata({
        patientId: 'patient-1',
        password: 'unsafe',
        request: { authorization: 'Bearer secret', reason: 'updated' },
        apiKey: 'unsafe-api-key',
        databaseCredential: 'unsafe-credential',
        changes: [{ refreshToken: 'token', field: 'email' }],
      }),
    ).toEqual({
      patientId: 'patient-1',
      password: '[REDACTED]',
      request: { authorization: '[REDACTED]', reason: 'updated' },
      apiKey: '[REDACTED]',
      databaseCredential: '[REDACTED]',
      changes: [{ refreshToken: '[REDACTED]', field: 'email' }],
    });
  });
  it('rejects weak reset passwords', async () => {
    const { resetPasswordSchema } = await import('../src/validators/auth.validator.js');
    expect(
      resetPasswordSchema.safeParse({
        body: { token: 'x'.repeat(40), password: 'short' },
        query: {},
        params: {},
      }).success,
    ).toBe(false);
  });
  it('creates a branded reset message without altering the reset URL', async () => {
    const { passwordResetMessage } = await import('../src/services/notification-provider.js');
    const resetUrl = 'https://medicare.test/auth/reset-password?token=secure-token';
    const message = passwordResetMessage(resetUrl);
    expect(message.subject).toBe('Reset Your MediCare+ Password');
    expect(message.text).toContain(resetUrl);
    expect(message.text).toContain('expires in 30 minutes');
    expect(message.html).toContain('MediCare+');
    expect(message.html).not.toContain('existing password');
  });
  it('accepts bounded patient pagination and rejects arbitrary sort fields', async () => {
    const { patientListSchema } = await import('../src/validators/patient.validator.js');
    expect(
      patientListSchema.safeParse({
        body: {},
        params: {},
        query: { page: '1', page_size: '20', sort_by: 'createdAt' },
      }).success,
    ).toBe(true);
    expect(
      patientListSchema.safeParse({ body: {}, params: {}, query: { sort_by: 'passwordHash' } })
        .success,
    ).toBe(false);
  });
  it('validates patient filters and critical patient fields', async () => {
    const { patientListSchema, createPatientSchema } =
      await import('../src/validators/patient.validator.js');
    expect(
      patientListSchema.safeParse({
        body: {},
        params: {},
        query: { min_age: '18', max_age: '65', gender: 'Female', created_from: '2026-01-01' },
      }).success,
    ).toBe(true);
    expect(
      patientListSchema.safeParse({ body: {}, params: {}, query: { min_age: '70', max_age: '20' } })
        .success,
    ).toBe(false);
    const base = {
      middleName: '',
      lastName: 'Iyer',
      dob: '1990-01-01',
      gender: 'Female',
      bloodGroup: 'B+',
      phone: '+91 98765 43210',
      email: '',
      city: '',
      emergencyContact: '',
      allergies: [],
      status: 'Active',
    };
    expect(
      createPatientSchema.safeParse({ body: { ...base, firstName: '  ' }, params: {}, query: {} })
        .success,
    ).toBe(false);
    expect(
      createPatientSchema.safeParse({
        body: { ...base, firstName: 'Meera', dob: '2999-01-01' },
        params: {},
        query: {},
      }).success,
    ).toBe(false);
    expect(
      createPatientSchema.safeParse({
        body: { ...base, firstName: 'Meera', phone: 'abc' },
        params: {},
        query: {},
      }).success,
    ).toBe(false);
  });
  it('enforces required permissions', async () => {
    const { requirePermissions } = await import('../src/middleware/auth.js');
    const next = vi.fn() as NextFunction;
    const req = {
      auth: { userId: 'u', sessionId: 's', permissions: ['patients.view'] },
    } as Request;
    requirePermissions('patients.edit')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
  it('validates admission search, filters and bounded pagination', async () => {
    const { admissionListSchema } = await import('../src/validators/inpatient.validator.js');
    const valid = admissionListSchema.safeParse({
      params: {},
      body: {},
      query: {
        page: '2',
        page_size: '25',
        search: 'Rahul',
        department_id: '00000000-0000-4000-8000-000000000000',
        status: 'ADMITTED',
      },
    });
    expect(valid.success).toBe(true);
    expect(
      admissionListSchema.safeParse({ params: {}, body: {}, query: { page_size: '101' } }).success,
    ).toBe(false);
    expect(
      admissionListSchema.safeParse({ params: {}, body: {}, query: { status: 'PENDING' } }).success,
    ).toBe(false);
  });
  it('accepts a signed access token', async () => {
    const { authenticate } = await import('../src/middleware/auth.js');
    const token = jwt.sign(
      { sub: 'u', sid: 's', permissions: ['patients.view'] },
      process.env.ACCESS_TOKEN_SECRET!,
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = vi.fn() as NextFunction;
    authenticate(req, {} as Response, next);
    expect(req.auth?.userId).toBe('u');
    expect(next).toHaveBeenCalledWith();
  });
});
