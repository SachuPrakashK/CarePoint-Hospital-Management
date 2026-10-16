import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
  return { response, body: await response.json().catch(() => null) };
};
const login = async (email, password) => {
  const result = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  assert.equal(result.response.status, 200);
  return { authorization: `Bearer ${result.body.data.access_token}` };
};
const createTicket = async (headers, subject) => call('/support/tickets', {
  method: 'POST', headers,
  body: JSON.stringify({ subject, module: 'Settings', issueType: 'WORKFLOW', description: 'Verify account isolation for persisted support tickets.', priority: 'NORMAL' }),
});

const admin = await login(process.env.SEED_HOSPITAL_ADMIN_EMAIL, process.env.SEED_HOSPITAL_ADMIN_PASSWORD);
const doctor = await login('doctor@carepoint.test', 'DoctorPass123!');
const adminTicket = await createTicket(admin, 'Administrator isolation ticket');
const doctorTicket = await createTicket(doctor, 'Doctor isolation ticket');
assert.equal(adminTicket.response.status, 201);
assert.equal(doctorTicket.response.status, 201);

const doctorList = await call('/support/tickets?page_size=100', { headers: doctor });
assert.equal(doctorList.response.status, 200);
assert.ok(doctorList.body.data.some(ticket => ticket.id === doctorTicket.body.data.id));
assert.ok(!doctorList.body.data.some(ticket => ticket.id === adminTicket.body.data.id));
const forbidden = await call(`/support/tickets/${adminTicket.body.data.id}`, { method: 'PATCH', headers: doctor, body: JSON.stringify({ status: 'IN_PROGRESS' }) });
assert.equal(forbidden.response.status, 403);

const adminList = await call('/support/tickets?page_size=100', { headers: admin });
assert.ok(adminList.body.data.some(ticket => ticket.id === adminTicket.body.data.id));
assert.ok(adminList.body.data.some(ticket => ticket.id === doctorTicket.body.data.id));

const ids = [adminTicket.body.data.id, doctorTicket.body.data.id];
const prisma = new PrismaClient();
await prisma.$transaction([
  prisma.supportTicketStatusHistory.deleteMany({ where: { ticketId: { in: ids } } }),
  prisma.supportTicket.deleteMany({ where: { id: { in: ids } } }),
]);
await prisma.$disconnect();
console.log(JSON.stringify({ requesterIsolation: true, managerVisibility: true, unauthorizedStatusUpdateRejected: true }));
