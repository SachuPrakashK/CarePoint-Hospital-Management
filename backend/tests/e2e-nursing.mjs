import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const created = {
  noteId: '',
  medicationId: '',
  handoverId: '',
  assignmentId: '',
  admissionId: '',
  bedId: '',
};
const call = async (path, token, init = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  return { response, body: await response.json() };
};

try {
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
      password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
    }),
  });
  const loginBody = await login.json();
  assert.equal(login.status, 200);
  const token = loginBody.data.access_token;
  const admissions = await call('/admissions?page=1&page_size=20', token);
  let admission = admissions.body.data.find((item) =>
    ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'].includes(item.status),
  );
  if (!admission) {
    const [patient, department, doctor, bed] = await Promise.all([
      prisma.patient.findFirst(),
      prisma.department.findFirst({ where: { status: 'Active' } }),
      prisma.user.findFirst({
        where: { roles: { some: { role: { code: 'DOCTOR' } } }, status: 'ACTIVE' },
      }),
      prisma.bed.findFirst({ where: { allocations: { none: { endedAt: null } } } }),
    ]);
    assert.ok(
      patient && department && doctor && bed,
      'Seeded patient, department, doctor and bed are required.',
    );
    admission = await prisma.$transaction(async (tx) => {
      const item = await tx.admission.create({
        data: {
          number: `ADM-E2E-${Date.now()}`,
          patientId: patient.id,
          departmentId: department.id,
          attendingDoctorId: doctor.id,
          admittedAt: new Date(),
          type: 'Planned',
          reason: 'Nursing workflow verification',
          initialDiagnosis: 'E2E verification',
        },
      });
      await tx.bedAllocation.create({
        data: { admissionId: item.id, bedId: bed.id, reason: 'Admission' },
      });
      await tx.bed.update({ where: { id: bed.id }, data: { status: 'OCCUPIED' } });
      return item;
    });
    created.admissionId = admission.id;
    created.bedId = bed.id;
  }
  const nurse = await prisma.user.findFirst({
    where: { roles: { some: { role: { code: 'NURSE' } } }, status: 'ACTIVE' },
  });
  assert.ok(nurse);
  const assignment = await prisma.nurseAssignment.findFirst({
    where: { admissionId: admission.id, nurseId: nurse.id, endedAt: null },
  });
  if (!assignment) {
    const newAssignment = await prisma.nurseAssignment.create({
      data: {
        admissionId: admission.id,
        nurseId: nurse.id,
        assignedById: loginBody.data.user.id,
        shift: 'MORNING',
      },
    });
    created.assignmentId = newAssignment.id;
  }

  const assigned = await call('/nursing/assigned-patients', token);
  assert.equal(assigned.response.status, 200);
  assert.ok(assigned.body.data.some((item) => item.admissionId === admission.id));

  const note = await call('/nursing-notes', token, {
    method: 'POST',
    body: JSON.stringify({
      admissionId: admission.id,
      observation: `E2E ${randomUUID()}`,
      intervention: 'E2E nursing intervention',
      notes: 'Persistence verification',
    }),
  });
  assert.equal(note.response.status, 201);
  created.noteId = note.body.data.id;
  const notes = await call(`/nursing-notes?admission_id=${admission.id}`, token);
  assert.ok(notes.body.data.some((item) => item.id === created.noteId));

  const task = await prisma.medicationAdministration.create({
    data: {
      admissionId: admission.id,
      medication: 'E2E medication',
      dose: '1 tablet',
      route: 'Oral',
      scheduledAt: new Date(),
    },
  });
  created.medicationId = task.id;
  const mar = await call(`/medication-administrations?admission_id=${admission.id}`, token);
  assert.ok(mar.body.data.some((item) => item.id === task.id));
  const administered = await call(`/medication-administrations/${task.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Administered', notes: 'E2E administration' }),
  });
  assert.equal(administered.response.status, 200);
  const duplicate = await call(`/medication-administrations/${task.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Administered', notes: 'Duplicate' }),
  });
  assert.equal(duplicate.response.status, 409);

  const handover = await call('/nursing/handovers', token, {
    method: 'POST',
    body: JSON.stringify({
      admissionId: admission.id,
      fromShift: 'MORNING',
      toShift: 'EVENING',
      handedOverToId: nurse.id,
      clinicalSummary: 'Stable during E2E verification.',
      currentCondition: 'Stable',
      pendingTasks: 'Continue observation.',
    }),
  });
  assert.equal(handover.response.status, 201);
  created.handoverId = handover.body.data.id;
  const history = await call(`/nursing/handovers?admission_id=${admission.id}`, token);
  assert.ok(history.body.data.some((item) => item.id === created.handoverId));
  const acknowledged = await call(`/nursing/handovers/${created.handoverId}/acknowledge`, token, {
    method: 'POST',
  });
  assert.equal(acknowledged.response.status, 200);
  assert.equal(acknowledged.body.data.status, 'ACKNOWLEDGED');

  const audits = await prisma.auditLog.count({
    where: {
      module: 'nursing',
      entityId: { in: [created.noteId, created.medicationId, created.handoverId] },
    },
  });
  assert.ok(audits >= 4);
  console.log(
    JSON.stringify({
      assignedPatients: 'passed',
      nursingNote: 'passed',
      mar: 'passed',
      duplicateProtection: 'passed',
      handover: 'passed',
      audit: 'passed',
    }),
  );
} finally {
  if (created.handoverId)
    await prisma.shiftHandover.deleteMany({ where: { id: created.handoverId } });
  if (created.medicationId)
    await prisma.medicationAdministration.deleteMany({ where: { id: created.medicationId } });
  if (created.noteId) await prisma.nursingNote.deleteMany({ where: { id: created.noteId } });
  if (created.assignmentId)
    await prisma.nurseAssignment.deleteMany({ where: { id: created.assignmentId } });
  if (created.admissionId) {
    await prisma.bedAllocation.deleteMany({ where: { admissionId: created.admissionId } });
    await prisma.admission.deleteMany({ where: { id: created.admissionId } });
    if (created.bedId)
      await prisma.bed.update({ where: { id: created.bedId }, data: { status: 'AVAILABLE' } });
  }
  await prisma.$disconnect();
}
