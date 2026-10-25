import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;

const call = async (path, { token, method = 'GET', body, key } = {}) => {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
};

const expectStatus = async (path, options, status) => {
  const result = await call(path, options);
  assert.equal(
    result.response.status,
    status,
    `${options.method ?? 'GET'} ${path}: ${result.response.status} ${JSON.stringify(result.payload)}`,
  );
  return result.payload;
};

try {
  const adminLogin = await expectStatus(
    '/auth/login',
    {
      method: 'POST',
      body: {
        email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
        password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
      },
    },
    200,
  );
  const adminToken = adminLogin.data.access_token;
  const patient = await prisma.patient.findFirst({ where: { deletedAt: null } });
  assert.ok(patient, 'A patient is required for the controlled billing test.');

  const stamp = Date.now();
  const invoiceKey = randomUUID();
  const invoiceBody = {
    patientId: patient.id,
    items: [
      {
        source: 'Automated Test',
        sourceId: `billing-critical-${stamp}`,
        description: 'Controlled billing integrity test',
        quantity: 1,
        unitPrice: 100,
      },
    ],
  };
  const invoice = (
    await expectStatus(
      '/billing',
      { token: adminToken, method: 'POST', body: invoiceBody, key: invoiceKey },
      201,
    )
  ).data;
  const repeatedInvoice = (
    await expectStatus(
      '/billing',
      { token: adminToken, method: 'POST', body: invoiceBody, key: invoiceKey },
      201,
    )
  ).data;
  assert.equal(repeatedInvoice.id, invoice.id);
  assert.equal(await prisma.invoice.count({ where: { idempotencyKey: invoiceKey } }), 1);

  const paymentKey = randomUUID();
  const paymentBody = { amount: 40, method: 'Cash', reference: `AUTO-${stamp}` };
  const payment = (
    await expectStatus(
      `/billing/${invoice.id}/payments`,
      { token: adminToken, method: 'POST', body: paymentBody, key: paymentKey },
      201,
    )
  ).data;
  const repeatedPayment = (
    await expectStatus(
      `/billing/${invoice.id}/payments`,
      { token: adminToken, method: 'POST', body: paymentBody, key: paymentKey },
      201,
    )
  ).data;
  assert.equal(repeatedPayment.id, payment.id);
  assert.equal(await prisma.payment.count({ where: { idempotencyKey: paymentKey } }), 1);
  assert.equal(
    (await prisma.invoice.findUnique({ where: { id: invoice.id } })).status,
    'Partially Paid',
  );

  await expectStatus(
    `/billing/${invoice.id}/payments`,
    {
      token: adminToken,
      method: 'POST',
      body: { amount: 61, method: 'Cash' },
      key: randomUUID(),
    },
    422,
  );

  const doctorLogin = await expectStatus(
    '/auth/login',
    { method: 'POST', body: { email: 'doctor@carepoint.test', password: 'DoctorPass123!' } },
    200,
  );
  await expectStatus(
    `/billing/${invoice.id}/payments`,
    {
      token: doctorLogin.data.access_token,
      method: 'POST',
      body: { amount: 1, method: 'Cash' },
      key: randomUUID(),
    },
    403,
  );

  const refundKey = randomUUID();
  const refundBody = { amount: 10, reason: 'Controlled refund integrity test' };
  const refund = (
    await expectStatus(
      `/billing/payments/${payment.id}/refunds`,
      { token: adminToken, method: 'POST', body: refundBody, key: refundKey },
      201,
    )
  ).data;
  const repeatedRefund = (
    await expectStatus(
      `/billing/payments/${payment.id}/refunds`,
      { token: adminToken, method: 'POST', body: refundBody, key: refundKey },
      201,
    )
  ).data;
  assert.equal(repeatedRefund.id, refund.id);
  assert.equal(await prisma.refund.count({ where: { idempotencyKey: refundKey } }), 1);
  assert.equal(refund.status, 'Requested');

  await expectStatus(
    `/billing/payments/${payment.id}/refunds`,
    {
      token: adminToken,
      method: 'POST',
      body: { amount: 31, reason: 'Must exceed the remaining refundable amount' },
      key: randomUUID(),
    },
    422,
  );

  const approved = (
    await expectStatus(
      `/billing/refunds/${refund.id}`,
      { token: adminToken, method: 'PATCH', body: { status: 'Approved' } },
      200,
    )
  ).data;
  assert.equal(approved.status, 'Approved');
  assert.equal(
    (await prisma.invoice.findUnique({ where: { id: invoice.id } })).status,
    'Partially Paid',
  );

  const auditActions = await prisma.auditLog.findMany({
    where: {
      module: 'billing',
      action: { in: ['INVOICE_CREATE', 'PAYMENT', 'REFUND_REQUEST', 'REFUND_APPROVE'] },
      OR: [{ entityId: invoice.id }, { entityId: payment.id }, { entityId: refund.id }],
    },
    select: { action: true },
  });
  assert.deepEqual(
    new Set(auditActions.map(({ action }) => action)),
    new Set(['INVOICE_CREATE', 'PAYMENT', 'REFUND_REQUEST', 'REFUND_APPROVE']),
  );

  console.log(
    JSON.stringify({
      invoiceId: invoice.id,
      paymentId: payment.id,
      refundId: refund.id,
      duplicateRecordsPrevented: true,
      overpaymentRejected: true,
      excessiveRefundRejected: true,
      unauthorizedPaymentRejected: true,
      auditTrailVerified: true,
      finalBalance: 70,
    }),
  );
} finally {
  await prisma.$disconnect();
}
