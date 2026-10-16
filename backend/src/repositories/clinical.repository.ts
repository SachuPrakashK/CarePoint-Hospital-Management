import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { calendarRangeBounds } from '../utils/date-time.js';
export const clinicalRepository = {
  consultation: (id: string) =>
    prisma.consultation.findUnique({
      where: { id },
      include: {
        vitals: true,
        diagnoses: true,
        notesEntries: true,
        prescriptions: { include: { items: true } },
      },
    }),
  consultationByAppointment: (appointmentId: string) =>
    prisma.consultation.findUnique({
      where: { appointmentId },
      include: { vitals: true, diagnoses: true, prescriptions: { include: { items: true } } },
    }),
  createConsultation: (data: Prisma.ConsultationCreateInput) =>
    prisma.consultation.create({ data }),
  updateConsultation: (id: string, data: Prisma.ConsultationUpdateInput) =>
    prisma.consultation.update({ where: { id }, data }),
  createVital: (data: Prisma.VitalUncheckedCreateInput) => prisma.vital.create({ data }),
  vitals: (patientId: string) =>
    prisma.vital.findMany({ where: { patientId }, orderBy: { recordedAt: 'desc' } }),
  createDiagnosis: (data: Prisma.DiagnosisUncheckedCreateInput) =>
    prisma.diagnosis.create({ data }),
  updateDiagnosis: (id: string, data: Prisma.DiagnosisUpdateInput) =>
    prisma.diagnosis.update({ where: { id }, data }),
  prescription: (id: string) =>
    prisma.prescription.findUnique({ where: { id }, include: { items: true } }),
  createPrescription: (
    data: Prisma.PrescriptionUncheckedCreateInput,
    items: Prisma.PrescriptionItemCreateManyPrescriptionInput[],
  ) =>
    prisma.prescription.create({
      data: { ...data, items: { createMany: { data: items } } },
      include: { items: true },
    }),
  updatePrescription: (id: string, data: Prisma.PrescriptionUpdateInput) =>
    prisma.prescription.update({ where: { id }, data, include: { items: true } }),
  summary: (patientId: string) =>
    prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      include: {
        allergiesRecords: true,
        histories: true,
        diagnoses: { orderBy: { diagnosedAt: 'desc' } },
        prescriptions: { orderBy: { createdAt: 'desc' }, include: { items: true } },
        consultations: { orderBy: { createdAt: 'desc' }, include: { vitals: true } },
      },
    }),
  timeline: async (patientId: string, query: { type?: string; from?: string; to?: string } = {}) => {
    const dates = calendarRangeBounds(query.from, query.to);
    const include = (type: string) => !query.type || query.type === type;
    const [consultations, diagnoses, admissions, labOrders] = await Promise.all([
      include('Consultation')
        ? prisma.consultation.findMany({ where: { patientId, createdAt: dates } })
        : [],
      include('Diagnosis')
        ? prisma.diagnosis.findMany({ where: { patientId, diagnosedAt: dates } })
        : [],
      include('Admission')
        ? prisma.admission.findMany({ where: { patientId, admittedAt: dates } })
        : [],
      include('Lab Result')
        ? prisma.labOrder.findMany({
            where: { patientId, status: { in: ['Verified', 'Completed'] }, updatedAt: dates },
            include: { results: true },
          })
        : [],
    ]);
    return [
      ...consultations.map((item) => ({ id: item.id, type: 'Consultation', occurredAt: item.createdAt, title: 'Consultation', description: item.chiefComplaint, referenceId: item.id })),
      ...diagnoses.map((item) => ({ id: item.id, type: 'Diagnosis', occurredAt: item.diagnosedAt, title: 'Diagnosis', description: item.description, referenceId: item.id })),
      ...admissions.map((item) => ({ id: item.id, type: 'Admission', occurredAt: item.admittedAt, title: 'Admission', description: item.reason, referenceId: item.id })),
      ...labOrders.map((item) => ({ id: item.id, type: 'Lab Result', occurredAt: item.updatedAt, title: `Laboratory result ${item.number}`, description: item.results.map((result) => `${result.test}: ${result.value}${result.unit ? ` ${result.unit}` : ''}`).join(', ') || 'Result verified', referenceId: item.id })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  },
};
