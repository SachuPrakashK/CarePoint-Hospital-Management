import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
};

const adminLogin = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
assert.equal(adminLogin.response.status, 200);
assert.equal(adminLogin.body.data.user.role.code, 'HOSPITAL_ADMIN');
const adminToken = adminLogin.body.data.access_token;

const adminMe = await call('/auth/me', { headers: { authorization: `Bearer ${adminToken}` } });
assert.equal(adminMe.response.status, 200);
assert.equal(adminMe.body.data.role.name, 'Hospital Admin');
const lastAdminProtection = await call(`/users/${adminMe.body.data.id}/status`, {
  method: 'PATCH',
  headers: { authorization: `Bearer ${adminToken}` },
  body: JSON.stringify({ status: 'INACTIVE' }),
});
assert.equal(lastAdminProtection.response.status, 409);

const doctorEmail = `e2e.doctor.${Date.now()}@carepoint.test`;
const doctorPassword = 'DoctorInitial123!';
const created = await call('/users', {
  method: 'POST',
  headers: { authorization: `Bearer ${adminToken}` },
  body: JSON.stringify({
    firstName: 'E2E',
    lastName: 'Doctor',
    email: doctorEmail,
    password: doctorPassword,
    roleCode: 'DOCTOR',
    status: 'ACTIVE',
  }),
});
assert.equal(created.response.status, 201);
assert.equal(created.body.data.roles[0].role.code, 'DOCTOR');

const doctorLogin = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: doctorEmail, password: doctorPassword }),
});
assert.equal(doctorLogin.response.status, 200);
assert.equal(doctorLogin.body.data.user.role.name, 'Doctor');
const doctorToken = doctorLogin.body.data.access_token;
const forbidden = await call('/users', { headers: { authorization: `Bearer ${doctorToken}` } });
assert.equal(forbidden.response.status, 403);
const roleEscalation = await call(`/users/${created.body.data.id}/role`, {
  method: 'PATCH',
  headers: { authorization: `Bearer ${doctorToken}` },
  body: JSON.stringify({ roleCode: 'HOSPITAL_ADMIN' }),
});
assert.equal(roleEscalation.response.status, 403);
const register = await call('/auth/register', { method: 'POST', body: '{}' });
assert.ok([401, 404].includes(register.response.status));
const patients = await call('/patients', { headers: { authorization: `Bearer ${adminToken}` } });
assert.equal(patients.response.status, 200);

const prisma = new PrismaClient();
const persisted = await prisma.user.findUnique({
  where: { email: doctorEmail },
  include: { roles: { include: { role: true } } },
});
const obsoleteRoles = await prisma.role.count({
  where: { code: { in: ['SUPER_ADMIN', 'ADMIN', 'PATIENT'] } },
});
assert.equal(persisted?.roles[0]?.role.code, 'DOCTOR');
assert.equal(obsoleteRoles, 0);
await prisma.$disconnect();

console.log(
  JSON.stringify({
    hospitalAdminLogin: 'passed',
    authMe: 'Hospital Admin',
    lastAdminProtection: lastAdminProtection.response.status,
    doctorCreated: doctorEmail,
    doctorLogin: 'passed',
    doctorUsersAccess: forbidden.response.status,
    doctorRoleEscalation: roleEscalation.response.status,
    publicRegister: register.response.status,
    patientApi: 'passed',
    obsoleteAuthRoles: obsoleteRoles,
  }),
);
