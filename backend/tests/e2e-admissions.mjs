import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const api = `http://127.0.0.1:${process.env.PORT || 3000}/api/v1`;
const request = async (path, token, method = 'GET', body, expected = 200) => {
  const response = await fetch(`${api}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => null);
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
};

try {
  const login = await request('/auth/login', '', 'POST', { email: process.env.SEED_HOSPITAL_ADMIN_EMAIL, password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD });
  const token = login.data.access_token;
  const admission = await prisma.admission.findFirst({ include: { department: true }, orderBy: { createdAt: 'desc' } });
  assert.ok(admission);
  const combined = await request(`/admissions?page=1&page_size=10&search=${encodeURIComponent(admission.number)}&department_id=${admission.departmentId}&status=${admission.status}`, token);
  assert.ok(combined.data.some((item) => item.id === admission.id));
  assert.ok(combined.data.every((item) => item.departmentId === admission.departmentId && item.status === admission.status));
  assert.ok(combined.pagination.total >= 1);
  const details = await request(`/admissions/${admission.id}`, token);
  assert.equal(details.data.patientId, admission.patientId);
  const endpoints = ['clinical-records', 'nursing', 'bed-history', 'medications', 'laboratory', 'radiology'];
  for (const endpoint of endpoints) await request(`/admissions/${admission.id}/${endpoint}`, token);
  const stamp = Date.now();
  const ward = await request('/wards', token, 'POST', { code: `E2E-${stamp}`, name: `E2E Ward ${stamp}`, floor: 'Test floor', status: 'Active' }, 201);
  assert.equal(await prisma.ward.count({ where: { id: ward.data.id } }), 1);
  await request('/wards', token, 'POST', { code: `E2E-${stamp}`, name: `Another Ward ${stamp}`, floor: 'Test floor', status: 'Active' }, 409);
  console.log(JSON.stringify({ searchFiltersPagination: 'passed', directDetails: 'passed', lazyTabs: 'passed', wardPersistence: 'passed', wardUniqueness: 'passed' }));
} finally {
  await prisma.$disconnect();
}
