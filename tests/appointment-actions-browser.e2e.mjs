import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '../backend/node_modules/@prisma/client/default.js';
import { chromium } from 'playwright-core';

const prisma = new PrismaClient();
const api = 'http://localhost:3000/api/v1';
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json().catch(() => null) };
};
const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
assert.equal(login.response.status, 200);
const headers = { authorization: `Bearer ${login.body.data.access_token}` };
const options = await call('/appointments/options', { headers });
const doctor = options.body.data.doctors.find((item) => item.departmentId);
const patient = options.body.data.patients[0];
assert.ok(doctor && patient);
const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const availability = await call(`/appointments/availability?doctor_id=${doctor.id}&date=${date}`, {
  headers,
});
const slots = availability.body.data.slots.filter((slot) => slot.available).slice(0, 2);
assert.equal(slots.length, 2);
const instant = (time) => new Date(`${date}T${time}:00+05:30`).toISOString();
const appointmentIds = [];
const invoiceIds = [];
const createAppointment = async (time, reason) => {
  const response = await call('/appointments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      patientId: patient.id,
      departmentId: doctor.departmentId,
      doctorId: doctor.id,
      appointmentAt: instant(time),
      type: 'Consultation',
      consultationType: 'In person',
      reason,
      fee: 1000,
    }),
  });
  assert.equal(response.response.status, 201);
  appointmentIds.push(response.body.data.id);
  return response.body.data;
};
const createInvoice = async (appointment) => {
  const response = await call('/billing', {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({
      patientId: patient.id,
      items: [
        {
          source: 'Appointment',
          sourceId: appointment.id,
          description: 'Consultation fee',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    }),
  });
  assert.equal(response.response.status, 201);
  invoiceIds.push(response.body.data.id);
  return response.body.data;
};

let browser;
try {
  const paid = await createAppointment(slots[0].time, 'Paid completed action policy test');
  const pending = await createAppointment(slots[1].time, 'Pending confirmed action policy test');
  const paidInvoice = await createInvoice(paid);
  await createInvoice(pending);
  const payment = await call(`/billing/${paidInvoice.id}/payments`, {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ amount: 1000, method: 'Cash', reference: 'ACTIONS-E2E' }),
  });
  assert.equal(payment.response.status, 201);
  for (const status of ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED']) {
    const changed = await call(`/appointments/${paid.id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    assert.equal(changed.response.status, 200);
  }
  const confirmed = await call(`/appointments/${pending.id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'CONFIRMED' }),
  });
  assert.equal(confirmed.response.status, 200);

  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const user = login.body.data.user;
  await page.goto('http://localhost:4200');
  await page.evaluate(
    ({ data, user }) =>
      sessionStorage.setItem(
        'carepoint.auth.tab-session',
        JSON.stringify({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          remember: false,
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`.trim(),
            email: user.email,
            role: user.role,
            roles: user.roles,
            permissions: user.permissions,
          },
        }),
      ),
    { data: login.body.data, user },
  );
  await page.goto('http://localhost:4200/appointments');
  const search = page.getByRole('searchbox', { name: 'Search appointments' });

  await search.fill(paid.number);
  const paidRow = page.getByRole('row', { name: new RegExp(paid.number) });
  await paidRow.waitFor();
  await paidRow.getByRole('button', { name: 'Appointment actions' }).click();
  await page.getByRole('menuitem', { name: 'Print Invoice' }).waitFor();
  await page.getByRole('menuitem', { name: 'Download Invoice' }).waitFor();
  const disabledReschedule = page.getByRole('menuitem', { name: /Reschedule unavailable/ });
  assert.equal(await disabledReschedule.isDisabled(), true);
  assert.equal(
    await disabledReschedule.getAttribute('title'),
    'Completed appointments cannot be rescheduled.',
  );

  await search.fill(pending.number);
  const pendingRow = page.getByRole('row', { name: new RegExp(pending.number) });
  await pendingRow.waitFor();
  await pendingRow.getByRole('button', { name: 'Appointment actions' }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Print Invoice' }).count(), 0);
  assert.equal(await page.getByRole('menuitem', { name: 'Download Invoice' }).count(), 0);
  assert.equal(await page.getByRole('menuitem', { name: 'Reschedule' }).isEnabled(), true);

  console.log(
    JSON.stringify({
      paidInvoiceActionsVisible: true,
      pendingInvoiceActionsHidden: true,
      completedRescheduleVisibleDisabled: true,
      completedRescheduleTooltip: true,
      confirmedRescheduleEnabled: true,
    }),
  );
} finally {
  await browser?.close();
  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  await prisma.refund.deleteMany({ where: { paymentId: { in: payments.map((item) => item.id) } } });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.insuranceClaim.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.opdQueueEntry.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
  await prisma.consultation.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: appointmentIds } } });
  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await prisma.$disconnect();
}
