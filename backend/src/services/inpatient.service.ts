import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { inpatientRepository as repo } from '../repositories/inpatient.repository.js';
import { AppError } from '../utils/app-error.js';
import { notificationService } from './notification.service.js';
const txOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 10000,
};
const conflict = (m: string) => new AppError(409, m, 'CONFLICT');
const activeAdmissionStatuses = ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] as const;
const isAdministrator = (roles: string[]) => roles.includes('HOSPITAL_ADMIN');
const assertNursingAccess = async (admissionId: string, actorId: string, roles: string[]) => {
  const admission = await prisma.admission.findFirst({
    where: {
      id: admissionId,
      status: { in: [...activeAdmissionStatuses] },
      ...(isAdministrator(roles)
        ? {}
        : { nurseAssignments: { some: { nurseId: actorId, endedAt: null } } }),
    },
    select: { id: true, patientId: true },
  });
  if (!admission)
    throw new AppError(404, 'An active assigned admission was not found.', 'NOT_FOUND');
  return admission;
};
export const inpatientService = {
  list: repo.listAdmissions,
  async details(id: string) {
    const a = await repo.admission(id);
    if (!a) throw new AppError(404, 'Admission was not found.', 'NOT_FOUND');
    return a;
  },
  async clinicalRecords(id: string) {
    const admission = await this.details(id);
    return prisma.consultation.findMany({
      where: {
        patientId: admission.patientId,
        createdAt: {
          gte: admission.admittedAt,
          ...(admission.dischargedAt ? { lte: admission.dischargedAt } : {}),
        },
      },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
        diagnoses: true,
        notesEntries: { include: { author: { select: { firstName: true, lastName: true } } } },
        vitals: true,
        prescriptions: { include: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
  async admissionNursing(id: string) {
    await this.details(id);
    const [notes, carePlans, intakeOutputs] = await Promise.all([
      prisma.nursingNote.findMany({
        where: { admissionId: id },
        include: { nurse: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { recordedAt: 'desc' },
      }),
      prisma.carePlan.findMany({ where: { admissionId: id }, orderBy: { reviewDate: 'desc' } }),
      prisma.intakeOutput.findMany({ where: { admissionId: id }, orderBy: { recordedAt: 'desc' } }),
    ]);
    return { notes, carePlans, intakeOutputs };
  },
  async bedHistory(id: string) {
    await this.details(id);
    return prisma.bedAllocation.findMany({
      where: { admissionId: id },
      include: { bed: { include: { room: { include: { wardModel: true } } } } },
      orderBy: { startedAt: 'asc' },
    });
  },
  async admissionMedications(id: string) {
    await this.details(id);
    return prisma.medicationAdministration.findMany({
      where: { admissionId: id },
      include: {
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
        prescriptionItem: { include: { prescription: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  },
  async admissionLaboratory(id: string) {
    const admission = await this.details(id);
    return prisma.labOrder.findMany({
      where: {
        patientId: admission.patientId,
        createdAt: {
          gte: admission.admittedAt,
          ...(admission.dischargedAt ? { lte: admission.dischargedAt } : {}),
        },
      },
      include: { orderTests: { include: { testDefinition: true } }, results: true },
      orderBy: { createdAt: 'desc' },
    });
  },
  async admissionRadiology(id: string) {
    const admission = await this.details(id);
    return prisma.radiologyOrder.findMany({
      where: {
        patientId: admission.patientId,
        createdAt: {
          gte: admission.admittedAt,
          ...(admission.dischargedAt ? { lte: admission.dischargedAt } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
  wards: repo.wards,
  rooms: repo.rooms,
  beds: repo.beds,
  availableBeds: repo.availableBeds,
  lookups: async () => ({
    departments: await prisma.department.findMany({
      where: { status: 'Active', deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    doctors: await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, roles: { some: { role: { code: 'DOCTOR' } } } },
      select: { id: true, firstName: true, lastName: true },
    }),
  }),
  async createWard(input: any, actorId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const ward = await tx.ward.create({ data: input });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'CREATE',
            module: 'inpatient',
            entityType: 'Ward',
            entityId: ward.id,
          },
        });
        return ward;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(409, 'Ward code and name must be unique.', 'CONFLICT');
      throw error;
    }
  },
  updateWard: (id: string, input: any) => prisma.ward.update({ where: { id }, data: input }),
  createRoom: (input: any) => prisma.room.create({ data: input }),
  updateRoom: (id: string, input: any) => prisma.room.update({ where: { id }, data: input }),
  createBed: (input: any) => prisma.bed.create({ data: input }),
  updateBed: (id: string, input: any) => prisma.bed.update({ where: { id }, data: input }),
  assignedPatients: (actorId: string, roles: string[]) =>
    prisma.nurseAssignment.findMany({
      where: {
        endedAt: null,
        ...(isAdministrator(roles) ? {} : { nurseId: actorId }),
        admission: { status: { in: [...activeAdmissionStatuses] } },
      },
      include: {
        nurse: { select: { id: true, firstName: true, lastName: true } },
        admission: {
          include: {
            patient: true,
            department: true,
            attendingDoctor: { select: { id: true, firstName: true, lastName: true } },
            allocations: {
              where: { endedAt: null },
              include: { bed: { include: { room: { include: { wardModel: true } } } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    }),
  nursingStaff: () =>
    prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { role: { code: 'NURSE' } } },
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  nursingNotes: (actorId: string, roles: string[], admissionId?: string) =>
    prisma.nursingNote.findMany({
      where: {
        ...(admissionId ? { admissionId } : {}),
        ...(isAdministrator(roles)
          ? {}
          : { admission: { nurseAssignments: { some: { nurseId: actorId, endedAt: null } } } }),
      },
      include: {
        nurse: { select: { id: true, firstName: true, lastName: true } },
        admission: { include: { patient: true } },
      },
      orderBy: { recordedAt: 'desc' },
    }),
  async addNursingNote(input: any, actorId: string, roles: string[]) {
    await assertNursingAccess(input.admissionId, actorId, roles);
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findFirst({
        where: {
          id: input.admissionId,
          status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] },
        },
        select: { id: true },
      });
      if (!admission) throw conflict('Nursing notes can only be added to an active admission.');
      const note = await tx.nursingNote.create({ data: { ...input, nurseId: actorId } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'CREATE',
          module: 'nursing',
          entityType: 'NursingNote',
          entityId: note.id,
          metadata: { admissionId: input.admissionId },
        },
      });
      return note;
    }, txOptions);
  },
  medications: (actorId: string, roles: string[], admissionId?: string) =>
    prisma.medicationAdministration.findMany({
      where: {
        ...(admissionId ? { admissionId } : {}),
        admission: {
          status: { in: [...activeAdmissionStatuses] },
          ...(isAdministrator(roles)
            ? {}
            : { nurseAssignments: { some: { nurseId: actorId, endedAt: null } } }),
        },
      },
      include: {
        admission: { include: { patient: true } },
        administeredBy: { select: { id: true, firstName: true, lastName: true } },
        prescriptionItem: {
          include: {
            prescription: {
              include: { doctor: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    }),
  async administerMedication(id: string, input: any, actorId: string, roles: string[]) {
    return prisma.$transaction(async (tx) => {
      const task = await tx.medicationAdministration.findUnique({
        where: { id },
        include: {
          admission: true,
          prescriptionItem: { include: { prescription: true } },
        },
      });
      if (!task) throw new AppError(404, 'Medication task was not found.', 'NOT_FOUND');
      await assertNursingAccess(task.admissionId, actorId, roles);
      if (
        task.prescriptionItem &&
        (task.prescriptionItem.prescription.patientId !== task.admission.patientId ||
          task.prescriptionItem.prescription.status !== 'Active')
      )
        throw conflict('The medication order is not active for this patient.');
      const changed = await tx.medicationAdministration.updateMany({
        where: { id, status: 'Scheduled' },
        data: {
          status: input.status,
          notes: input.notes ?? '',
          administeredAt: new Date(),
          administeredById: actorId,
        },
      });
      if (changed.count !== 1) throw conflict('This medication task has already been recorded.');
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ADMINISTER',
          module: 'nursing',
          entityType: 'MedicationAdministration',
          entityId: id,
          metadata: { status: input.status },
        },
      });
      return tx.medicationAdministration.findUnique({ where: { id } });
    }, txOptions);
  },
  handovers: (actorId: string, roles: string[], admissionId?: string) =>
    prisma.shiftHandover.findMany({
      where: {
        ...(admissionId ? { admissionId } : {}),
        ...(isAdministrator(roles)
          ? {}
          : {
              OR: [
                { handedOverById: actorId },
                { handedOverToId: actorId },
                { admission: { nurseAssignments: { some: { nurseId: actorId } } } },
              ],
            }),
      },
      include: {
        admission: { include: { patient: true } },
        handedOverBy: { select: { id: true, firstName: true, lastName: true } },
        handedOverTo: { select: { id: true, firstName: true, lastName: true } },
        acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  async createHandover(input: any, actorId: string, roles: string[]) {
    await assertNursingAccess(input.admissionId, actorId, roles);
    if (input.handedOverToId) {
      const recipient = await prisma.user.findFirst({
        where: {
          id: input.handedOverToId,
          status: 'ACTIVE',
          roles: { some: { role: { code: 'NURSE' } } },
        },
        select: { id: true },
      });
      if (!recipient)
        throw new AppError(422, 'The receiving nurse is invalid.', 'VALIDATION_ERROR');
    }
    return prisma.$transaction(async (tx) => {
      const handover = await tx.shiftHandover.create({
        data: { ...input, handedOverById: actorId },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'CREATE',
          module: 'nursing',
          entityType: 'ShiftHandover',
          entityId: handover.id,
          metadata: { admissionId: input.admissionId, toShift: input.toShift },
        },
      });
      return handover;
    }, txOptions);
  },
  async acknowledgeHandover(id: string, actorId: string, roles: string[]) {
    return prisma.$transaction(async (tx) => {
      const handover = await tx.shiftHandover.findUnique({ where: { id } });
      if (!handover) throw new AppError(404, 'Shift handover was not found.', 'NOT_FOUND');
      if (!isAdministrator(roles) && handover.handedOverToId !== actorId)
        throw new AppError(
          403,
          'Only the receiving nurse can acknowledge this handover.',
          'FORBIDDEN',
        );
      const changed = await tx.shiftHandover.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'ACKNOWLEDGED', acknowledgedById: actorId, acknowledgedAt: new Date() },
      });
      if (changed.count !== 1) throw conflict('This handover has already been acknowledged.');
      if (handover.handedOverToId) {
        await tx.nurseAssignment.updateMany({
          where: {
            admissionId: handover.admissionId,
            endedAt: null,
            nurseId: { not: handover.handedOverToId },
          },
          data: { endedAt: new Date() },
        });
        const activeAssignment = await tx.nurseAssignment.findFirst({
          where: {
            admissionId: handover.admissionId,
            nurseId: handover.handedOverToId,
            endedAt: null,
          },
        });
        if (!activeAssignment)
          await tx.nurseAssignment.create({
            data: {
              admissionId: handover.admissionId,
              nurseId: handover.handedOverToId,
              assignedById: actorId,
              shift: handover.toShift,
            },
          });
      }
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ACKNOWLEDGE',
          module: 'nursing',
          entityType: 'ShiftHandover',
          entityId: id,
        },
      });
      return tx.shiftHandover.findUnique({ where: { id } });
    }, txOptions);
  },
  async procedures(query: any) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 10);
    const search = query.search?.trim();
    const from = query.from_date ? new Date(`${query.from_date}T00:00:00.000Z`) : undefined;
    const to = query.to_date ? new Date(`${query.to_date}T23:59:59.999Z`) : undefined;
    const where: Prisma.ProcedureWhereInput = {
      ...(query.theatre_id ? { theatreId: query.theatre_id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(from || to
        ? { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              {
                patient: {
                  is: {
                    OR: [
                      { mrn: { contains: search, mode: 'insensitive' } },
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                doctor: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                theatre: {
                  is: {
                    OR: [
                      { code: { contains: search, mode: 'insensitive' } },
                      { name: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const direction: Prisma.SortOrder = query.sort_order === 'asc' ? 'asc' : 'desc';
    const sortMap: Record<string, Prisma.ProcedureOrderByWithRelationInput> = {
      scheduledAt: { scheduledAt: direction },
      patient: { patient: { firstName: direction } },
      name: { name: direction },
      doctor: { doctor: { firstName: direction } },
      theatre: { theatre: { name: direction } },
      durationMinutes: { durationMinutes: direction },
      status: { status: direction },
    };
    const orderBy = sortMap[query.sort_by] ?? { scheduledAt: 'desc' as const };
    const [data, total] = await prisma.$transaction([
      prisma.procedure.findMany({
        where,
        include: { patient: true, doctor: true, theatre: true },
        orderBy: [orderBy, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.procedure.count({ where }),
    ]);
    return {
      data,
      pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
    };
  },
  async procedureDetails(id: string) {
    const item = await prisma.procedure.findUnique({
      where: { id },
      include: { patient: true, doctor: true, theatre: true },
    });
    if (!item) throw new AppError(404, 'Procedure was not found.', 'NOT_FOUND');
    const admission = item.admissionId
      ? await prisma.admission.findUnique({
          where: { id: item.admissionId },
          include: {
            department: true,
            allocations: {
              include: { bed: { include: { room: { include: { wardModel: true } } } } },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
        })
      : null;
    return { ...item, admission };
  },
  procedureLookups: async () => ({
    theatres: await prisma.operationTheatre.findMany({
      where: { status: 'Active' },
      orderBy: { name: 'asc' },
    }),
    doctors: await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, roles: { some: { role: { code: 'DOCTOR' } } } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    admissions: await prisma.admission.findMany({
      where: { status: { in: [...activeAdmissionStatuses] } },
      select: { id: true, number: true, patientId: true },
    }),
    statuses: ['Planned', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'],
  }),
  async procedureStats() {
    const [grouped, total, availableTheatres] = await Promise.all([
      prisma.procedure.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.procedure.count(),
      prisma.operationTheatre.count({ where: { status: 'Active' } }),
    ]);
    const counts = Object.fromEntries(grouped.map((item) => [item.status, item._count._all]));
    return {
      total,
      scheduled: counts['Scheduled'] ?? 0,
      inProgress: counts['In Progress'] ?? 0,
      completed: counts['Completed'] ?? 0,
      cancelled: counts['Cancelled'] ?? 0,
      availableTheatres,
    };
  },
  async scheduleProcedure(input: any, actorId: string) {
    if (input.theatreId) {
      const start = new Date(input.scheduledAt),
        end = new Date(start.getTime() + input.durationMinutes * 60000);
      const overlap = await prisma.procedure.findFirst({
        where: {
          theatreId: input.theatreId,
          status: { not: 'Cancelled' },
          scheduledAt: { lt: end, gte: new Date(start.getTime() - input.durationMinutes * 60000) },
        },
      });
      if (overlap) throw conflict('Theatre schedule conflicts with an existing procedure.');
    }
    if (input.admissionId) {
      const admission = await prisma.admission.findFirst({
        where: { id: input.admissionId, patientId: input.patientId },
      });
      if (!admission)
        throw new AppError(
          422,
          'Admission does not belong to the selected patient.',
          'VALIDATION_ERROR',
        );
    }
    return prisma.$transaction(async (tx) => {
      const item = await tx.procedure.create({
        data: {
          ...input,
          scheduledAt: new Date(input.scheduledAt),
          preOpChecklist: input.preOpChecklist ?? [],
          team: input.team ?? [],
          notes: input.notes ?? '',
        },
        include: { patient: true, doctor: true, theatre: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'CREATE',
          module: 'procedures',
          entityType: 'Procedure',
          entityId: item.id,
          metadata: { status: item.status, theatreId: item.theatreId },
        },
      });
      return item;
    }, txOptions);
  },
  async updateProcedure(id: string, input: any, actorId: string) {
    const current = await this.procedureDetails(id);
    const transitions: Record<string, string[]> = {
      Planned: ['Scheduled', 'Cancelled'],
      Scheduled: ['In Progress', 'Cancelled'],
      'In Progress': ['Completed', 'Cancelled'],
      Completed: [],
      Cancelled: [],
    };
    if (
      input.status &&
      input.status !== current.status &&
      !transitions[current.status]?.includes(input.status)
    )
      throw conflict(`Procedure cannot transition from ${current.status} to ${input.status}.`);
    const scheduledAt = new Date(input.scheduledAt ?? current.scheduledAt);
    const durationMinutes = input.durationMinutes ?? current.durationMinutes;
    const theatreId = input.theatreId === undefined ? current.theatreId : input.theatreId;
    if (theatreId && !['Completed', 'Cancelled'].includes(input.status ?? current.status)) {
      const end = new Date(scheduledAt.getTime() + durationMinutes * 60000);
      const overlap = await prisma.procedure.findFirst({
        where: {
          id: { not: id },
          theatreId,
          status: { notIn: ['Completed', 'Cancelled'] },
          scheduledAt: { lt: end, gte: new Date(scheduledAt.getTime() - durationMinutes * 60000) },
        },
      });
      if (overlap) throw conflict('Theatre schedule conflicts with an existing procedure.');
    }
    return prisma.$transaction(async (tx) => {
      const item = await tx.procedure.update({
        where: { id },
        data: { ...input, ...(input.scheduledAt ? { scheduledAt } : {}) },
        include: { patient: true, doctor: true, theatre: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action:
            input.status && input.status !== current.status
              ? `STATUS_${String(input.status).toUpperCase().replaceAll(' ', '_')}`
              : 'UPDATE',
          module: 'procedures',
          entityType: 'Procedure',
          entityId: id,
          metadata: {
            previousStatus: current.status,
            status: item.status,
            theatreId: item.theatreId,
          },
        },
      });
      return item;
    }, txOptions);
  },
  async admit(input: any, actorId: string) {
    const result = await prisma.$transaction(async (tx) => {
      if (
        await tx.admission.findFirst({
          where: {
            patientId: input.patientId,
            status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] },
          },
        })
      )
        throw conflict('Patient already has an active admission.');
      const claimed = await tx.bed.updateMany({
        where: { id: input.bedId, status: 'AVAILABLE' },
        data: { status: 'OCCUPIED', version: { increment: 1 } },
      });
      if (claimed.count !== 1) throw conflict('The selected bed is not available.');
      const item = await tx.admission.create({
        data: {
          number: `IPD-${randomUUID().slice(0, 8).toUpperCase()}`,
          patientId: input.patientId,
          departmentId: input.departmentId,
          attendingDoctorId: input.attendingDoctorId,
          admittedAt: new Date(input.admittedAt),
          type: input.type,
          reason: input.reason,
          initialDiagnosis: input.initialDiagnosis,
          allocations: { create: { bedId: input.bedId, reason: 'Admission' } },
        },
        include: { allocations: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'ADMIT',
          module: 'inpatient',
          entityType: 'Admission',
          entityId: item.id,
        },
      });
      return item;
    }, txOptions);
    await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'], {
      type: 'PATIENT_ADMITTED',
      title: 'Patient admitted',
      message: `Admission ${result.number} was created.`,
      relatedEntityType: 'Admission',
      relatedEntityId: result.id,
    });
    return result;
  },
  async update(id: string, input: any) {
    await this.details(id);
    return prisma.admission.update({ where: { id }, data: input });
  },
  async transfer(id: string, input: any, actorId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({ where: { id } });
      if (!admission || !['ADMITTED', 'TRANSFERRED'].includes(admission.status))
        throw conflict('Admission is not active.');
      const current = await tx.bedAllocation.findFirst({
        where: { admissionId: id, endedAt: null },
      });
      if (!current) throw conflict('Admission has no active bed allocation.');
      if (current.bedId === input.toBedId) throw conflict('Destination bed must be different.');
      const claimed = await tx.bed.updateMany({
        where: { id: input.toBedId, status: 'AVAILABLE' },
        data: { status: 'OCCUPIED', version: { increment: 1 } },
      });
      if (claimed.count !== 1) throw conflict('Destination bed is not available.');
      const at = new Date();
      await tx.bedAllocation.update({ where: { id: current.id }, data: { endedAt: at } });
      await tx.bed.update({
        where: { id: current.bedId },
        data: { status: 'CLEANING', version: { increment: 1 } },
      });
      await tx.nurseAssignment.updateMany({
        where: { admissionId: id, endedAt: null },
        data: { endedAt: at },
      });
      await tx.bedAllocation.create({
        data: { admissionId: id, bedId: input.toBedId, reason: 'Transfer', startedAt: at },
      });
      await tx.transfer.create({
        data: {
          admissionId: id,
          fromBedId: current.bedId,
          toBedId: input.toBedId,
          reason: input.reason,
          actorId,
        },
      });
      await tx.admission.update({ where: { id }, data: { status: 'TRANSFERRED' } });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'TRANSFER',
          module: 'inpatient',
          entityType: 'Admission',
          entityId: id,
          metadata: { fromBedId: current.bedId, toBedId: input.toBedId },
        },
      });
      return tx.admission.findUnique({
        where: { id },
        include: { allocations: true, transfers: true },
      });
    }, txOptions);
    await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'NURSE'], {
      type: 'PATIENT_TRANSFERRED',
      title: 'Patient transferred',
      message: `Admission ${result?.number ?? id} was transferred.`,
      relatedEntityType: 'Admission',
      relatedEntityId: id,
    });
    return result;
  },
  async discharge(id: string, input: any, actorId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({ where: { id } });
      if (
        !admission ||
        !['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'].includes(admission.status)
      )
        throw conflict('Admission is not active.');
      const allocation = await tx.bedAllocation.findFirst({
        where: { admissionId: id, endedAt: null },
      });
      if (!allocation) throw conflict('Admission has no active bed allocation.');
      const at = new Date();
      const discharge = await tx.discharge.upsert({
        where: { admissionId: id },
        update: { ...input, dischargedAt: at },
        create: { ...input, admissionId: id, dischargedAt: at },
      });
      await tx.admission.update({
        where: { id },
        data: { status: 'DISCHARGED', dischargedAt: at },
      });
      await tx.bedAllocation.update({
        where: { id: allocation.id },
        data: { endedAt: at, reason: 'Release' },
      });
      await tx.bed.update({
        where: { id: allocation.bedId },
        data: { status: 'CLEANING', version: { increment: 1 } },
      });
      await tx.nurseAssignment.updateMany({
        where: { admissionId: id, endedAt: null },
        data: { endedAt: at },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'DISCHARGE',
          module: 'inpatient',
          entityType: 'Admission',
          entityId: id,
        },
      });
      return discharge;
    }, txOptions);
    await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'BILLING_STAFF'], {
      type: 'PATIENT_DISCHARGED',
      title: 'Patient discharged',
      message: `Admission ${id} was discharged.`,
      relatedEntityType: 'Admission',
      relatedEntityId: id,
    });
    return result;
  },
};
