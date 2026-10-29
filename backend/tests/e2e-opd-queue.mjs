import 'dotenv/config';
import assert from 'node:assert/strict';
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
const doctor = options.body.data.doctors.find((item) => item.departmentId);
assert.ok(doctor);
const patient = options.body.data.patients[0];
const create = async (minute) =>
  call('/appointments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      patientId: patient.id,
      departmentId: doctor.departmentId,
      doctorId: doctor.id,
      appointmentAt: `2026-11-15T04:${minute}:00.000Z`,
      type: 'Consultation',
      consultationType: 'In person',
      reason: `Concurrent queue token ${minute}`,
      fee: 500,
    }),
  });
const first = await create('00'),
  second = await create('15');
assert.equal(first.response.status, 201);
assert.equal(second.response.status, 201);
const checkIn = (id) =>
  call(`/appointments/${id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'CHECKED_IN' }),
  });
const checked = await Promise.all([checkIn(first.body.data.id), checkIn(second.body.data.id)]);
assert.deepEqual(
  checked.map((item) => item.response.status),
  [200, 200],
);
const queue = await call('/opd-queue?page=1&page_size=100', { headers });
assert.equal(queue.response.status, 200);
const entries = queue.body.data.filter((item) =>
  [first.body.data.id, second.body.data.id].includes(item.appointmentId),
);
assert.equal(entries.length, 2);
assert.equal(new Set(entries.map((item) => item.token)).size, 2);
const tokenByAppointment = new Map(entries.map((item) => [item.appointmentId, item.token]));
const refreshed = await call('/opd-queue?page=1&page_size=100', { headers });
for (const item of refreshed.body.data.filter((row) => tokenByAppointment.has(row.appointmentId)))
  assert.equal(item.token, tokenByAppointment.get(item.appointmentId));
const duplicate = await checkIn(first.body.data.id);
assert.equal(duplicate.response.status, 409);
const entry = entries.find((item) => item.appointmentId === first.body.data.id);
for (const status of ['CALLED', 'IN_CONSULTATION', 'COMPLETED']) {
  const result = await call(`/opd-queue/${entry.id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  assert.equal(result.response.status, 200);
}
const detail = await call(`/appointments/${first.body.data.id}`, { headers });
assert.equal(detail.body.data.status, 'COMPLETED');
console.log(
  JSON.stringify({
    concurrentTokens: entries.map((item) => item.token),
    tokenPersistence: true,
    finalAppointmentStatus: detail.body.data.status,
  }),
);
