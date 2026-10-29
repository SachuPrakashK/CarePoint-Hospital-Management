import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json().catch(() => null) };
};
const authenticate = async (email, password) => {
  const response = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.response.status, 200);
  return { authorization: `Bearer ${response.body.data.access_token}` };
};
const headers = await authenticate(
  process.env.SEED_HOSPITAL_ADMIN_EMAIL,
  process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
);
const doctorHeaders = await authenticate('doctor@carepoint.test', 'DoctorPass123!');
const roles = await call('/roles?page_size=100', { headers });
assert.equal(roles.response.status, 200);
const systemRole = roles.body.data.find((role) => role.isSystem);
assert.ok(systemRole);
assert.equal(
  (
    await call(`/roles/${systemRole.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Unsafe change' }),
    })
  ).response.status,
  409,
);
assert.equal(
  (await call(`/roles/${systemRole.id}`, { method: 'DELETE', headers })).response.status,
  409,
);

const suffix = Date.now().toString(36);
const created = await call('/roles', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: `E2E Role ${suffix}`,
    description: 'Independent permission verification.',
    status: 'ACTIVE',
    permissionCodes: ['patients.edit'],
  }),
});
assert.equal(created.response.status, 201);
const id = created.body.data.id;
const codes = (value) => value.permissions.map((entry) => entry.permission.code).sort();
const prisma = new PrismaClient();
try {
  assert.deepEqual(codes(created.body.data), ['patients.edit']);
  assert.equal(
    (
      await call(`/roles/${id}`, {
        method: 'PUT',
        headers: doctorHeaders,
        body: JSON.stringify({ name: 'Unauthorized' }),
      })
    ).response.status,
    403,
  );
  const invalid = await call(`/roles/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ permissionCodes: ['patients.not_real'] }),
  });
  assert.equal(invalid.response.status, 422);
  assert.deepEqual(codes((await call(`/roles/${id}`, { headers })).body.data), ['patients.edit']);
  const updated = await call(`/roles/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: `E2E Updated ${suffix}`,
      description: 'Exact replacement persisted.',
      status: 'INACTIVE',
      permissionCodes: ['patients.delete'],
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.deepEqual(codes(updated.body.data), ['patients.delete']);
  const persisted = await call(`/roles/${id}`, { headers });
  assert.equal(persisted.body.data.name, `E2E Updated ${suffix}`);
  assert.deepEqual(codes(persisted.body.data), ['patients.delete']);
  const audit = await prisma.auditLog.findFirst({
    where: { entityId: id, action: 'ROLE_UPDATED' },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(audit);
  assert.deepEqual(audit.metadata.permissionsAdded, ['patients.delete']);
  assert.deepEqual(audit.metadata.permissionsRemoved, ['patients.edit']);
} finally {
  assert.equal((await call(`/roles/${id}`, { method: 'DELETE', headers })).response.status, 200);
  await prisma.auditLog.deleteMany({ where: { entityId: id } });
  await prisma.$disconnect();
}
console.log(
  JSON.stringify({
    independentCreate: 'passed',
    exactReplacement: 'passed',
    invalidRollback: 'passed',
    protectedRole: 'passed',
    unauthorizedUpdate: 'passed',
    auditDiff: 'passed',
    persistence: 'passed',
  }),
);
