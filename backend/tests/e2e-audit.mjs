import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const request = async (path, token) => {
  const response = await fetch(`${api}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
};

try {
  const loginResponse = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
      password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
    }),
  });
  assert.equal(loginResponse.status, 200, 'Seed administrator login failed');
  const token = (await loginResponse.json()).data.access_token;

  const unauthorized = await request('/audit', '');
  assert.equal(unauthorized.response.status, 401);

  const listing = await request(
    '/audit?page=1&page_size=10&sort_by=createdAt&sort_order=desc',
    token,
  );
  assert.equal(listing.response.status, 200, JSON.stringify(listing.payload));
  const databaseRows = await prisma.auditLog.findMany({
    take: 10,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: { user: true },
  });
  assert.equal(listing.payload.pagination.total, await prisma.auditLog.count());
  assert.deepEqual(
    listing.payload.data.map((item) => item.id),
    databaseRows.map((item) => item.id),
  );
  assert.deepEqual(
    listing.payload.data.map((item) => [
      item.module,
      item.action,
      item.entityType,
      item.entityId,
      item.userId,
    ]),
    databaseRows.map((item) => [
      item.module,
      item.action,
      item.entityType,
      item.entityId,
      item.userId,
    ]),
  );

  if (databaseRows[0]) {
    const details = await request(`/audit/${databaseRows[0].id}`, token);
    assert.equal(details.response.status, 200, JSON.stringify(details.payload));
    assert.equal(details.payload.data.id, databaseRows[0].id);
    assert.equal(details.payload.data.createdAt, databaseRows[0].createdAt.toISOString());

    const filtered = await request(
      `/audit?page=1&page_size=100&module=${encodeURIComponent(databaseRows[0].module)}`,
      token,
    );
    assert.equal(filtered.response.status, 200);
    assert.ok(filtered.payload.data.every((item) => item.module === databaseRows[0].module));
    assert.equal(
      filtered.payload.pagination.total,
      await prisma.auditLog.count({ where: { module: databaseRows[0].module } }),
    );
  }

  const options = await request('/audit/options', token);
  assert.equal(options.response.status, 200);
  assert.ok(Array.isArray(options.payload.data.modules));
  const invalidRange = await request('/audit?created_from=2026-10-18&created_to=2026-10-01', token);
  assert.equal(invalidRange.response.status, 422);

  console.log(
    JSON.stringify({
      authorization: 'passed',
      databaseParity: 'passed',
      filters: 'passed',
      details: 'passed',
      validation: 'passed',
    }),
  );
} finally {
  await prisma.$disconnect();
}
