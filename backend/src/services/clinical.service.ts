import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { clinicalRepository as repo } from '../repositories/clinical.repository.js';
import { AppError } from '../utils/app-error.js';
const required = async <T>(value: Promise<T | null>, label: string) => {
  const item = await value;
  if (!item) throw new AppError(404, `${label} was not found.`, 'NOT_FOUND');
  return item;
};
export const clinicalService = {
  consultations: () =>
    prisma.consultation.findMany({
      include: { vitals: true, diagnoses: true, prescriptions: { include: { items: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  summary: (id: string) => required(repo.summary(id), 'Patient'),
  timeline: (id: string, query: { type?: string; from?: string; to?: string } = {}) =>
    repo.timeline(id, query),
  consultation: (id: string) => required(repo.consultation(id), 'Consultation'),
  async createConsultation(input: any, actorId: string) {
    const appointment = await prisma.appointment.findUnique({ where: { id: input.appointmentId } });
    if (!appointment) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    return prisma.$transaction(async (tx) => {
      const item = await tx.consultation.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          chiefComplaint: input.chiefComplaint,
          symptoms: input.symptoms ?? '',
          examination: input.examination ?? '',
          notes: input.notes ?? '',
          treatmentPlan: input.treatmentPlan ?? '',
        },
      });
      if (input.vitals?.length)
        await tx.vital.createMany({
          data: input.vitals.map((v: any) => ({
            ...v,
            patientId: appointment.patientId,
            consultationId: item.id,
            recordedById: actorId,
          })),
        });
      const diagnoses = [input.primaryDiagnosis, ...(input.secondaryDiagnoses ?? [])].filter(
        Boolean,
      );
      if (diagnoses.length)
        await tx.diagnosis.createMany({
          data: diagnoses.map((description: string, index: number) => ({
            patientId: appointment.patientId,
            consultationId: item.id,
            description,
            type: index ? 'Secondary' : 'Primary',
            status: 'Active',
          })),
        });
      if (input.prescription?.length)
        await tx.prescription.create({
          data: {
            number: `RX-${randomUUID().slice(0, 8).toUpperCase()}`,
            patientId: appointment.patientId,
            consultationId: item.id,
            doctorId: appointment.doctorId,
            status: 'Active',
            notes: '',
            items: { createMany: { data: input.prescription } },
          },
        });
      if (input.followUpDate)
        await tx.followUp.create({
          data: {
            patientId: appointment.patientId,
            consultationId: item.id,
            scheduledAt: new Date(input.followUpDate),
            instructions: input.followUpInstructions,
          },
        });
      await tx.appointment.update({ where: { id: appointment.id }, data: { status: 'COMPLETED' } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'CREATE',
          module: 'clinical',
          entityType: 'Consultation',
          entityId: item.id,
        },
      });
      return tx.consultation.findUnique({
        where: { id: item.id },
        include: { vitals: true, diagnoses: true, prescriptions: { include: { items: true } } },
      });
    });
  },
  updateConsultation: (id: string, input: any) => repo.updateConsultation(id, input),
  createVital: (input: any, actorId: string) =>
    repo.createVital({ ...input, recordedById: actorId }),
  vitals: (patientId: string) => repo.vitals(patientId),
  createDiagnosis: (input: any) => repo.createDiagnosis(input),
  updateDiagnosis: (id: string, input: any) => repo.updateDiagnosis(id, input),
  async createPrescription(input: any, actorId: string) {
    const { items, ...data } = input;
    return repo.createPrescription(
      {
        ...data,
        doctorId: input.doctorId ?? actorId,
        number: `RX-${randomUUID().slice(0, 8).toUpperCase()}`,
      },
      items,
    );
  },
  prescription: (id: string) => required(repo.prescription(id), 'Prescription'),
  updatePrescription: (id: string, input: any) => repo.updatePrescription(id, input),
};
