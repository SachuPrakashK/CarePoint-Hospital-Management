import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
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
assert.equal(options.response.status, 200);
const patient = options.body.data.patients[0];
const doctor = options.body.data.doctors.find((item) => item.departmentId);
assert.ok(patient && doctor, 'An active patient and assigned doctor are required.');

const future = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
const date = future.toISOString().slice(0, 10);
const availability = await call(`/appointments/availability?doctor_id=${doctor.id}&date=${date}`, {
  headers,
});
assert.equal(availability.response.status, 200);
const available = availability.body.data.slots.filter((slot) => slot.available);
assert.ok(available.length >= 3, 'Three available test slots are required.');
const instant = (time) => new Date(`${date}T${time}:00+05:30`).toISOString();

const appointmentIds = [];
let invoiceId;
let provisionalPatientId;
try {
  const summary = await call('/appointments/summary', { headers });
  assert.equal(summary.response.status, 200);
  for (const key of ['today', 'confirmed', 'pendingPayment', 'completed'])
    assert.equal(typeof summary.body.data[key], 'number');

  const search = await call(`/appointments/patients/search?search=${patient.mrn}`, { headers });
  assert.equal(search.response.status, 200);
  assert.equal(search.body.data[0].id, patient.id);

  const payload = {
    patientId: patient.id,
    departmentId: doctor.departmentId,
    doctorId: doctor.id,
    appointmentAt: instant(available[0].time),
    type: 'Consultation',
    consultationType: 'In person',
    reason: 'Appointments enhancement integration test',
    fee: 1000,
  };
  const created = await call('/appointments', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  assert.equal(created.response.status, 201);
  appointmentIds.push(created.body.data.id);

  const duplicate = await call('/appointments', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.code, 'SLOT_UNAVAILABLE');

  const listed = await call(`/appointments?search=${created.body.data.number}`, { headers });
  assert.equal(listed.response.status, 200);
  const row = listed.body.data[0];
  assert.equal(row.patientGender, patient.gender);
  assert.ok(row.patientAge);
  assert.equal(row.patientPhone, patient.phone);
  assert.equal(row.paymentStatus, 'Not Billed');

  const rescheduled = await call(`/appointments/${created.body.data.id}/reschedule`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      departmentId: doctor.departmentId,
      doctorId: doctor.id,
      appointmentAt: instant(available[1].time),
      reason: 'Patient requested a later time',
    }),
  });
  assert.equal(rescheduled.response.status, 200);
  assert.equal(rescheduled.body.data.number, created.body.data.number);
  assert.equal(rescheduled.body.data.appointmentAt, instant(available[1].time));
  const audit = await prisma.auditLog.findFirst({
    where: {
      entityId: created.body.data.id,
      action: 'APPOINTMENT_RESCHEDULE',
    },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(audit?.metadata?.reason, 'Patient requested a later time');

  const invoice = await call('/billing', {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({
      patientId: patient.id,
      items: [
        {
          source: 'Appointment',
          sourceId: created.body.data.id,
          description: 'Consultation fee',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    }),
  });
  assert.equal(invoice.response.status, 201);
  invoiceId = invoice.body.data.id;

  let billed = await call(`/appointments?search=${created.body.data.number}`, { headers });
  assert.equal(billed.body.data[0].paymentStatus, 'Pending');
  assert.equal(billed.body.data[0].outstandingBalance, 1000);
  const payment = await call(`/billing/${invoiceId}/payments`, {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ amount: 250, method: 'Cash', reference: 'APT-E2E' }),
  });
  assert.equal(payment.response.status, 201);
  billed = await call(`/appointments?search=${created.body.data.number}`, { headers });
  assert.equal(billed.body.data[0].paymentStatus, 'Partially Paid');
  assert.equal(billed.body.data[0].outstandingBalance, 750);

  const invoiceDetail = await call(`/appointments/${created.body.data.id}/invoice`, { headers });
  assert.equal(invoiceDetail.response.status, 200);
  assert.equal(invoiceDetail.body.data.total, 1000);
  assert.equal(invoiceDetail.body.data.paidAmount, 250);
  assert.equal(invoiceDetail.body.data.balance, 750);
  const pdf = await fetch(`${api}/appointments/${created.body.data.id}/invoice.pdf`, { headers });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type') ?? '', /application\/pdf/);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');

  const provisional = await call('/appointments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      newPatient: {
        firstName: 'E2E',
        middleName: 'Provisional',
        lastName: 'Appointment',
        dob: '1995-06-15',
        gender: 'Other',
        phone: `+919${String(Date.now()).slice(-9)}`,
      },
      departmentId: doctor.departmentId,
      doctorId: doctor.id,
      appointmentAt: instant(available[2].time),
      type: 'Consultation',
      consultationType: 'In person',
      reason: 'New patient booking integration test',
      fee: 1000,
    }),
  });
  assert.equal(provisional.response.status, 201);
  appointmentIds.push(provisional.body.data.id);
  provisionalPatientId = provisional.body.data.patientId;
  const storedPatient = await prisma.patient.findUnique({ where: { id: provisionalPatientId } });
  assert.equal(storedPatient?.gender, 'Other');
  assert.match(storedPatient?.phone ?? '', /^\+91/);

  console.log(
    JSON.stringify({
      kpis: true,
      patientSearch: true,
      demographics: true,
      paymentMapping: true,
      conflictRejected: true,
      rescheduleAudited: true,
      invoiceTotals: true,
      pdfValid: true,
      provisionalBooking: true,
    }),
  );
} finally {
  if (invoiceId) {
    const payments = await prisma.payment.findMany({ where: { invoiceId }, select: { id: true } });
    await prisma.refund.deleteMany({
      where: { paymentId: { in: payments.map((item) => item.id) } },
    });
    await prisma.payment.deleteMany({ where: { invoiceId } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
    await prisma.insuranceClaim.deleteMany({ where: { invoiceId } });
    await prisma.invoice.delete({ where: { id: invoiceId } });
  }
  await prisma.opdQueueEntry.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
  await prisma.consultation.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: appointmentIds } } });
  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  if (provisionalPatientId) await prisma.patient.delete({ where: { id: provisionalPatientId } });
  await prisma.$disconnect();
}
