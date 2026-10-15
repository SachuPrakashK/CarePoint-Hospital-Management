import { AppointmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { notificationService } from './notification.service.js';
import { opdQueueService } from './opd-queue.service.js';

const include = {
  patient: { select: { firstName: true, lastName: true } },
  department: { select: { name: true } },
  doctor: { select: { firstName: true, lastName: true } },
} as const;

const map = (item: any) => ({
  id: item.id, number: item.number, patientId: item.patientId,
  patientName: `${item.patient.firstName} ${item.patient.lastName}`,
  departmentId: item.departmentId, department: item.department.name,
  doctorId: item.doctorId, doctor: `${item.doctor.firstName} ${item.doctor.lastName}`,
  appointmentAt: item.appointmentAt, status: item.status, type: item.type,
  consultationType: item.consultationType, reason: item.reason, fee: Number(item.fee),
  createdAt: item.createdAt, updatedAt: item.updatedAt,
});

type ListQuery = {
  page: number; page_size: number; search?: string; department_id?: string; doctor_id?: string;
  status?: AppointmentStatus; start_date?: string; end_date?: string;
  sort_by: 'appointmentAt' | 'createdAt' | 'number' | 'patient' | 'department' | 'doctor' | 'type' | 'status'; sort_order: 'asc' | 'desc';
};

async function assertRelations(patientId: string, departmentId: string, doctorId: string) {
  const [patient, department, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } }),
    prisma.department.findFirst({ where: { id: departmentId, deletedAt: null, status: 'Active' } }),
    prisma.user.findFirst({
      where: { id: doctorId, deletedAt: null, status: 'ACTIVE', roles: { some: { role: { code: 'DOCTOR' } } } },
      select: { departmentId: true },
    }),
  ]);
  if (!patient) throw new AppError(422, 'Select a valid patient.', 'INVALID_PATIENT');
  if (!department) throw new AppError(422, 'Select a valid department.', 'INVALID_DEPARTMENT');
  if (!doctor) throw new AppError(422, 'Select a valid doctor.', 'INVALID_DOCTOR');
  if (doctor.departmentId && doctor.departmentId !== departmentId)
    throw new AppError(422, 'The selected doctor does not belong to this department.', 'DOCTOR_DEPARTMENT_MISMATCH');
}

export const appointmentService = {
  async get(id: string) {
    const item = await prisma.appointment.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    return map(item);
  },

  async list(query: ListQuery) {
    const search = query.search?.trim();
    const where: Prisma.AppointmentWhereInput = {
      ...(query.department_id ? { departmentId: query.department_id } : {}),
      ...(query.doctor_id ? { doctorId: query.doctor_id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.start_date || query.end_date ? { appointmentAt: {
        ...(query.start_date ? { gte: new Date(query.start_date) } : {}),
        ...(query.end_date ? { lt: new Date(query.end_date) } : {}),
      } } : {}),
      ...(search ? { OR: [
        { number: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { patient: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
        { patient: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        { doctor: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
        { doctor: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        { department: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const sortMap: Record<ListQuery['sort_by'], Prisma.AppointmentOrderByWithRelationInput> = {
      appointmentAt:{appointmentAt:query.sort_order},createdAt:{createdAt:query.sort_order},number:{number:query.sort_order},
      patient:{patient:{firstName:query.sort_order}},department:{department:{name:query.sort_order}},doctor:{doctor:{firstName:query.sort_order}},
      type:{type:query.sort_order},status:{status:query.sort_order},
    };
    const [items, total] = await prisma.$transaction([
      prisma.appointment.findMany({ where, include, orderBy: [sortMap[query.sort_by],{id:'asc'}], skip: (query.page - 1) * query.page_size, take: query.page_size }),
      prisma.appointment.count({ where }),
    ]);
    return { data: items.map(map), pagination: { page: query.page, page_size: query.page_size, total, total_pages: Math.ceil(total / query.page_size) } };
  },

  async options() {
    const [patients, departments, doctors] = await Promise.all([
      prisma.patient.findMany({ where: { deletedAt: null, status: 'Active' }, select: { id: true, firstName: true, lastName: true, mrn: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
      prisma.department.findMany({ where: { deletedAt: null, status: 'Active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.user.findMany({ where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { code: 'DOCTOR' } } } }, select: { id: true, firstName: true, lastName: true, departmentId: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
    ]);
    return { patients, departments, doctors };
  },

  async create(input: any) {
    await assertRelations(input.patientId, input.departmentId, input.doctorId);
    const item = await prisma.appointment.create({ data: {
      number: `APT-${Date.now().toString().slice(-8)}`, patientId: input.patientId,
      departmentId: input.departmentId, doctorId: input.doctorId,
      appointmentAt: new Date(input.appointmentAt), type: input.type,
      consultationType: input.consultationType, reason: input.reason.trim(), fee: input.fee,
      status: 'SCHEDULED',
    }, include });
    await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'], {
      type: 'APPOINTMENT_CREATED', title: 'New appointment',
      message: `Appointment ${item.number} was booked for ${item.patient.firstName} ${item.patient.lastName}.`,
      relatedEntityType: 'Appointment', relatedEntityId: item.id,
    });
    return map(item);
  },

  async update(id: string, input: any) {
    if (!(await prisma.appointment.findUnique({ where: { id } })))
      throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    await assertRelations(input.patientId, input.departmentId, input.doctorId);
    return map(await prisma.appointment.update({ where: { id }, data: {
      patientId: input.patientId, departmentId: input.departmentId, doctorId: input.doctorId,
      appointmentAt: new Date(input.appointmentAt), type: input.type,
      consultationType: input.consultationType, reason: input.reason.trim(), fee: input.fee,
    }, include }));
  },

  async status(id: string, status: AppointmentStatus) {
    const found = await prisma.appointment.findUnique({ where: { id } });
    if (!found)
      throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      CHECKED_IN: ['WAITING', 'IN_CONSULTATION', 'CANCELLED'],
      WAITING: ['IN_CONSULTATION', 'CANCELLED', 'NO_SHOW'],
      IN_CONSULTATION: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [], CANCELLED: [], NO_SHOW: [],
    };
    if (!transitions[found.status].includes(status))
      throw new AppError(409, `${found.status} cannot transition to ${status}.`, 'INVALID_STATUS_TRANSITION');
    if (status === 'CHECKED_IN') await opdQueueService.checkIn(id);
    const item = status === 'CHECKED_IN'
      ? await prisma.appointment.findUniqueOrThrow({ where: { id }, include })
      : await prisma.appointment.update({ where: { id }, data: { status }, include });
    await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'], {
      type: `APPOINTMENT_${status}`, title: `Appointment ${status.toLowerCase().replaceAll('_', ' ')}`,
      message: `Appointment ${item.number} status changed.`, relatedEntityType: 'Appointment', relatedEntityId: item.id,
    });
    return map(item);
  },
};
