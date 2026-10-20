import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
try {
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
      password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
    }),
  });
  assert.equal(login.status, 200, `Login failed with ${login.status}`);
  const token = (await login.json()).data.access_token;
  const unauthorized = await fetch(`${api}/reports/overview`);
  assert.equal(unauthorized.status, 401);
  assert.equal((await fetch(`${api}/reports/export.csv`)).status, 401);
  const response = await fetch(`${api}/reports/overview`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  const report = payload.data;
  assert.equal(
    report.summary.total_patients,
    await prisma.patient.count({ where: { deletedAt: null } }),
  );
  assert.equal(report.summary.total_appointments, await prisma.appointment.count());
  assert.equal(report.summary.opd_visits, await prisma.opdQueueEntry.count());
  assert.equal(
    report.summary.completed_procedures,
    await prisma.procedure.count({ where: { status: 'Completed' } }),
  );
  assert.equal(
    report.filters.departments.length,
    await prisma.department.count({ where: { deletedAt: null, status: 'Active' } }),
  );
  const csvResponse = await fetch(`${api}/reports/export.csv`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get('content-type') ?? '', /text\/csv/);
  assert.match(
    csvResponse.headers.get('content-disposition') ?? '',
    /medicare-report-\d{4}-\d{2}-\d{2}\.csv/,
  );
  const csvBytes = new Uint8Array(await csvResponse.arrayBuffer());
  assert.deepEqual([...csvBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(csvBytes);
  assert.match(csv, /Department Performance\r?\nDepartment,Appointments,Admissions,Total Activity/);
  for (const department of report.department_performance) {
    assert.ok(csv.includes(department.department.replaceAll('"', '""')));
  }
  const selected = report.department_performance[0];
  if (selected) {
    const filteredResponse = await fetch(
      `${api}/reports/export.csv?department_id=${encodeURIComponent(selected.id)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    assert.equal(filteredResponse.status, 200);
    const filteredCsv = await filteredResponse.text();
    assert.ok(
      filteredCsv.includes(
        [selected.department, selected.appointments, selected.admissions, selected.total_visits]
          .join(',')
          .replaceAll('"', '""'),
      ),
    );
    assert.equal(
      filteredCsv.split('\n').filter((line) => /^Department Performance\r?$/.test(line)).length,
      1,
    );
  }
  console.log(
    JSON.stringify({
      authorization: 'passed',
      patients: 'matched',
      appointments: 'matched',
      opd: 'matched',
      procedures: 'matched',
      departments: 'matched',
      csv: 'downloaded and matched',
      filteredCsv: selected ? 'matched' : 'empty dataset handled',
    }),
  );
} finally {
  await prisma.$disconnect();
}
