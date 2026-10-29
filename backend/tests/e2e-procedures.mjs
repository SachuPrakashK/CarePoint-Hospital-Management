import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const procedureIds = [];
let theatreId = '';
const call = async (path, token, init = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  return { response, body: await response.json() };
};

try {
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
      password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
    }),
  });
  const session = await login.json();
  assert.equal(login.status, 200);
  const token = session.data.access_token;
  const unauthorized = await call('/procedures?page=1&page_size=10', '');
  assert.equal(unauthorized.response.status, 401);
  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst(),
    prisma.user.findFirst({
      where: { status: 'ACTIVE', roles: { some: { role: { code: 'DOCTOR' } } } },
    }),
  ]);
  assert.ok(patient && doctor);
  const theatre = await prisma.operationTheatre.create({
    data: {
      code: `E2E-${randomUUID().slice(0, 8)}`,
      name: `E2E Theatre ${randomUUID().slice(0, 6)}`,
    },
  });
  theatreId = theatre.id;
  const firstAt = new Date(Date.now() + 10 * 86400000);
  firstAt.setUTCHours(9, 0, 0, 0);
  const secondAt = new Date(firstAt.getTime() + 4 * 3600000);
  const marker = `E2E procedure ${randomUUID()}`;
  const make = async (name, scheduledAt, status = 'Scheduled') => {
    const result = await call('/procedures', token, {
      method: 'POST',
      body: JSON.stringify({
        patientId: patient.id,
        admissionId: null,
        doctorId: doctor.id,
        theatreId,
        name,
        team: [],
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: 60,
        indication: 'E2E validation',
        notes: '',
        status,
        preOpChecklist: [],
      }),
    });
    assert.equal(result.response.status, 201);
    procedureIds.push(result.body.data.id);
    return result.body.data;
  };
  const first = await make(marker, firstAt);
  await make(`${marker} second`, secondAt, 'Planned');
  const conflict = await call('/procedures', token, {
    method: 'POST',
    body: JSON.stringify({
      patientId: patient.id,
      doctorId: doctor.id,
      theatreId,
      name: 'Conflict procedure',
      team: [],
      scheduledAt: firstAt.toISOString(),
      durationMinutes: 60,
      indication: 'Conflict',
      status: 'Scheduled',
      preOpChecklist: [],
    }),
  });
  assert.equal(conflict.response.status, 409);
  const date = firstAt.toISOString().slice(0, 10);
  const combined = await call(
    `/procedures?page=1&page_size=10&search=${encodeURIComponent(marker)}&from_date=${date}&to_date=${date}&theatre_id=${theatreId}&status=Scheduled`,
    token,
  );
  assert.equal(combined.response.status, 200);
  assert.equal(combined.body.data.length, 1);
  assert.equal(combined.body.data[0].id, first.id);
  const paged = await call(
    `/procedures?page=1&page_size=1&search=${encodeURIComponent(marker)}`,
    token,
  );
  assert.equal(paged.body.data.length, 1);
  assert.ok(paged.body.pagination.total >= 2);
  assert.ok(paged.body.pagination.total_pages >= 2);
  const details = await call(`/procedures/${first.id}`, token);
  assert.equal(details.response.status, 200);
  assert.equal(details.body.data.patient.id, patient.id);
  assert.equal(details.body.data.doctor.id, doctor.id);
  assert.equal(details.body.data.theatre.id, theatreId);
  const stats = await call('/procedures/stats', token);
  assert.equal(stats.response.status, 200);
  assert.ok(stats.body.data.total >= 2);
  assert.ok(stats.body.data.availableTheatres >= 1);
  const started = await call(`/procedures/${first.id}`, token, {
    method: 'PUT',
    body: JSON.stringify({ status: 'In Progress' }),
  });
  assert.equal(started.response.status, 200);
  const completed = await call(`/procedures/${first.id}`, token, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Completed' }),
  });
  assert.equal(completed.response.status, 200);
  const invalid = await call(`/procedures/${first.id}`, token, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Scheduled' }),
  });
  assert.equal(invalid.response.status, 409);
  const audits = await prisma.auditLog.count({
    where: { module: 'procedures', entityId: { in: procedureIds } },
  });
  assert.ok(audits >= 4);
  console.log(
    JSON.stringify({
      search: 'passed',
      filters: 'passed',
      pagination: 'passed',
      details: 'passed',
      stats: 'passed',
      conflict: 'passed',
      transitions: 'passed',
      rbac: 'passed',
      audit: 'passed',
    }),
  );
} finally {
  if (procedureIds.length)
    await prisma.procedure.deleteMany({ where: { id: { in: procedureIds } } });
  if (theatreId) await prisma.operationTheatre.deleteMany({ where: { id: theatreId } });
  await prisma.$disconnect();
}
