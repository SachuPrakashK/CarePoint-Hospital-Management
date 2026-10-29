import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { calendarDateBounds, calendarDayBounds } from '../utils/date-time.js';
import { AppError } from '../utils/app-error.js';

const include = {
  appointment: { select: { number: true, appointmentAt: true, status: true } },
  patient: { select: { firstName: true, lastName: true, mrn: true } },
  department: { select: { name: true, code: true } },
  doctor: { select: { firstName: true, lastName: true } },
} as const;
const map = (item: any) => ({
  id: item.id,
  appointmentId: item.appointmentId,
  appointmentNumber: item.appointment.number,
  appointmentStatus: item.appointment.status,
  appointmentAt: item.appointment.appointmentAt,
  patientId: item.patientId,
  patientName: `${item.patient.firstName} ${item.patient.lastName}`,
  mrn: item.patient.mrn,
  departmentId: item.departmentId,
  department: item.department.name,
  doctorId: item.doctorId,
  doctor: `${item.doctor.firstName} ${item.doctor.lastName}`,
  token: item.token,
  tokenNumber: item.tokenNumber,
  status: item.status,
  checkedInAt: item.checkedInAt,
  calledAt: item.calledAt,
  consultationAt: item.consultationAt,
  completedAt: item.completedAt,
  cancelledAt: item.cancelledAt,
});

const queueTransitions: Record<string, string[]> = {
  WAITING: ['CALLED', 'CANCELLED'],
  CALLED: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
const appointmentStatus: Record<string, string> = {
  WAITING: 'CHECKED_IN',
  CALLED: 'WAITING',
  IN_CONSULTATION: 'IN_CONSULTATION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const opdQueueService = {
  async checkIn(appointmentId: string) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const existing = await tx.opdQueueEntry.findUnique({
              where: { appointmentId },
              include,
            });
            if (existing) return map(existing);
            const appointment = await tx.appointment.findUnique({
              where: { id: appointmentId },
              include: { department: { select: { code: true } } },
            });
            if (!appointment) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
            if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status))
              throw new AppError(
                409,
                `Appointment cannot be checked in from ${appointment.status}.`,
                'INVALID_STATUS_TRANSITION',
              );
            const { start } = calendarDayBounds();
            const latest = await tx.opdQueueEntry.findFirst({
              where: { queueDate: start, departmentId: appointment.departmentId },
              orderBy: { tokenNumber: 'desc' },
              select: { tokenNumber: true },
            });
            const tokenNumber = (latest?.tokenNumber ?? 0) + 1;
            await tx.appointment.update({
              where: { id: appointmentId },
              data: { status: 'CHECKED_IN' },
            });
            const entry = await tx.opdQueueEntry.create({
              data: {
                appointmentId,
                patientId: appointment.patientId,
                departmentId: appointment.departmentId,
                doctorId: appointment.doctorId,
                queueDate: start,
                tokenNumber,
                token: `${appointment.department.code}-${String(tokenNumber).padStart(3, '0')}`,
              },
              include,
            });
            return map(entry);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: any) {
        if ((error?.code === 'P2002' || error?.code === 'P2034') && attempt < 2) continue;
        throw error;
      }
    }
    throw new AppError(
      409,
      'A queue token could not be allocated. Please retry.',
      'TOKEN_CONFLICT',
    );
  },

  async list(query: any) {
    const direction: Prisma.SortOrder = query.sort_order === 'desc' ? 'desc' : 'asc';
    const sorts: any = {
      tokenNumber: { tokenNumber: direction },
      patient: { patient: { firstName: direction } },
      doctor: { doctor: { firstName: direction } },
      department: { department: { name: direction } },
      appointment: { appointment: { number: direction } },
      checkedInAt: { checkedInAt: direction },
      status: { status: direction },
    };
    const bounds = query.date ? calendarDateBounds(query.date) : calendarDayBounds();
    const search = query.search?.trim();
    const where: Prisma.OpdQueueEntryWhereInput = {
      queueDate: { gte: bounds.start, lt: bounds.end },
      ...(query.department_id ? { departmentId: query.department_id } : {}),
      ...(query.doctor_id ? { doctorId: query.doctor_id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { token: { contains: search, mode: 'insensitive' } },
              { appointment: { is: { number: { contains: search, mode: 'insensitive' } } } },
              { patient: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
              { patient: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
              { doctor: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
              { department: { is: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.opdQueueEntry.findMany({
        where,
        include,
        orderBy: [sorts[query.sort_by] ?? { tokenNumber: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
      prisma.opdQueueEntry.count({ where }),
    ]);
    return {
      data: items.map(map),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  },
  async get(id: string) {
    const item = await prisma.opdQueueEntry.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, 'Queue entry was not found.', 'NOT_FOUND');
    return map(item);
  },
  async status(id: string, next: string) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.opdQueueEntry.findUnique({ where: { id } });
      if (!current) throw new AppError(404, 'Queue entry was not found.', 'NOT_FOUND');
      if (!(queueTransitions[current.status] ?? []).includes(next))
        throw new AppError(
          409,
          `${current.status} cannot transition to ${next}.`,
          'INVALID_STATUS_TRANSITION',
        );
      const now = new Date();
      const timestamps =
        next === 'CALLED'
          ? { calledAt: now }
          : next === 'IN_CONSULTATION'
            ? { consultationAt: now }
            : next === 'COMPLETED'
              ? { completedAt: now }
              : next === 'CANCELLED'
                ? { cancelledAt: now }
                : {};
      await tx.appointment.update({
        where: { id: current.appointmentId },
        data: { status: appointmentStatus[next] as any },
      });
      return map(
        await tx.opdQueueEntry.update({
          where: { id },
          data: { status: next as any, ...timestamps },
          include,
        }),
      );
    });
  },
};
