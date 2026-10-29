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

const invalid = await call('/patients', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    firstName: ' ',
    lastName: 'Test',
    dob: '2999-01-01',
    gender: '',
    phone: 'abc',
  }),
});
assert.equal(invalid.response.status, 422);

const suffix = Date.now();
const created = await call('/patients', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    firstName: 'Eesha',
    middleName: '',
    lastName: 'Automation',
    dob: '1990-06-15',
    gender: 'Female',
    bloodGroup: 'B+',
    phone: '+91 98765 43210',
    email: `patient.${suffix}@carepoint.test`,
    city: 'Bengaluru',
    emergencyContact: '',
    allergies: [],
    status: 'Active',
  }),
});
assert.equal(created.response.status, 201);
const patient = created.body.data;

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const filtered = await call(
  `/patients?search=${patient.mrn}&gender=Female&status=Active&min_age=18&max_age=80&created_from=${today}&created_to=${today}&page=1&page_size=10`,
  { headers },
);
assert.equal(filtered.response.status, 200);
assert.equal(
  filtered.body.data.some((item) => item.id === patient.id),
  true,
);
assert.ok(filtered.body.pagination.all_total >= filtered.body.pagination.total);

const updated = await call(`/patients/${patient.id}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ city: 'Mysuru' }),
});
assert.equal(updated.response.status, 200);
const details = await call(`/patients/${patient.id}`, { headers });
assert.equal(details.body.data.city, 'Mysuru');
const options = await call('/appointments/options', { headers });
assert.equal(options.response.status, 200);
const department = options.body.data.departments[0];
const doctor = options.body.data.doctors[0];
if (department && doctor) {
  const appointmentAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  appointmentAt.setUTCSeconds(0, 0);
  const appointment = await call('/appointments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      patientId: patient.id,
      departmentId: department.id,
      doctorId: doctor.id,
      appointmentAt: appointmentAt.toISOString(),
      type: 'Consultation',
      consultationType: 'In person',
      reason: 'E2E patient details booking',
      fee: 650,
    }),
  });
  assert.equal(appointment.response.status, 201);
}
for (const tab of ['appointments', 'visits', 'prescriptions', 'medical-records', 'documents']) {
  const response = await call(`/patients/${patient.id}/${tab}`, { headers });
  assert.equal(response.response.status, 200, `${tab} tab endpoint`);
}
const archived = await call(`/patients/${patient.id}`, { method: 'DELETE', headers });
assert.equal(archived.response.status, 200);
const missing = await call(`/patients/${patient.id}`, { headers });
assert.equal(missing.response.status, 404);

console.log(
  JSON.stringify({
    validation: 422,
    create: 201,
    combinedFilters: 'passed',
    update: 200,
    details: 200,
    tabApis: 'passed',
    appointmentBooking: department && doctor ? 'passed' : 'not-run-no-doctor-option',
    archive: 200,
  }),
);
