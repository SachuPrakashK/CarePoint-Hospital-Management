import { randomInt } from 'node:crypto';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { calendarDateBounds, calendarDayBounds } from '../utils/date-time.js';
import { invoiceFinancials } from '../utils/invoice-financials.js';
import { notificationService } from './notification.service.js';
import { opdQueueService } from './opd-queue.service.js';

const include = {
  patient: {
    select: { firstName: true, lastName: true, mrn: true, dob: true, gender: true, phone: true },
  },
  department: { select: { name: true } },
  doctor: {
    select: {
      firstName: true,
      lastName: true,
      consultationFee: true,
      specialization: { select: { name: true } },
    },
  },
} as const;

const patientAge = (dob: Date, appointmentAt: Date) => {
  const birth = { year: dob.getUTCFullYear(), month: dob.getUTCMonth(), day: dob.getUTCDate() };
  const date = new Date(appointmentAt.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  let years = date.getFullYear() - birth.year;
  if (
    date.getMonth() < birth.month ||
    (date.getMonth() === birth.month && date.getDate() < birth.day)
  )
    years -= 1;
  if (years > 0) return `${years} yr${years === 1 ? '' : 's'}`;
  const months = Math.max(
    0,
    (date.getFullYear() - birth.year) * 12 +
      date.getMonth() -
      birth.month -
      (date.getDate() < birth.day ? 1 : 0),
  );
  return months > 0 ? `${months} mo` : 'Under 1 mo';
};

const map = (item: any, billing?: any) => ({
  id: item.id,
  number: item.number,
  patientId: item.patientId,
  patientName: `${item.patient.firstName} ${item.patient.lastName}`,
  patientMrn: item.patient.mrn,
  patientGender: item.patient.gender || null,
  patientPhone: item.patient.phone || null,
  patientAge: item.patient.dob ? patientAge(item.patient.dob, item.appointmentAt) : null,
  departmentId: item.departmentId,
  department: item.department.name,
  doctorId: item.doctorId,
  doctor: `${item.doctor.firstName} ${item.doctor.lastName}`,
  doctorSpecialty: item.doctor.specialization?.name ?? null,
  appointmentAt: item.appointmentAt,
  status: item.status,
  type: item.type,
  consultationType: item.consultationType,
  reason: item.reason,
  fee: Number(item.fee),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  invoiceId: billing?.invoiceId ?? null,
  invoiceNumber: billing?.invoiceNumber ?? null,
  paymentStatus: billing?.status ?? 'Not Billed',
  outstandingBalance: billing?.balance ?? 0,
});

const billingByAppointment = async (appointmentIds: string[]) => {
  if (!appointmentIds.length) return new Map<string, any>();
  const items = await prisma.invoiceItem.findMany({
    where: { sourceId: { in: appointmentIds } },
    include: { invoice: { include: { items: true, payments: { include: { refunds: true } } } } },
  });
  return new Map(
    items.map((item) => {
      const financials = invoiceFinancials(item.invoice);
      return [
        item.sourceId,
        {
          invoiceId: item.invoice.id,
          invoiceNumber: item.invoice.number,
          status: item.invoice.status === 'Cancelled' ? 'Not Billed' : financials.status,
          balance: Number(financials.balance),
        },
      ];
    }),
  );
};

const slotLabel = (value: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);

const pdfEscape = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
export const createTextPdf = (lines: string[]) => {
  const pageSize = 48;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / pageSize)) },
    (_, index) => lines.slice(index * pageSize, (index + 1) * pageSize),
  );
  const fontId = 3 + pages.length * 2;
  const pageIds = pages.map((_, index) => 3 + index * 2);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  pages.forEach((page, pageIndex) => {
    const pageId = pageIds[pageIndex]!;
    const contentId = pageId + 1;
    const content = page
      .map(
        (line, index) =>
          `BT /F1 ${pageIndex === 0 && index === 0 ? 18 : 10} Tf 48 ${790 - index * 15} Td (${pdfEscape(line)}) Tj ET`,
      )
      .join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document, 'ascii');
};

type ListQuery = {
  page: number;
  page_size: number;
  search?: string;
  department_id?: string;
  doctor_id?: string;
  status?: AppointmentStatus;
  gender?: string;
  payment_status?: string;
  start_date?: string;
  end_date?: string;
  sort_by:
    | 'appointmentAt'
    | 'createdAt'
    | 'number'
    | 'patient'
    | 'gender'
    | 'age'
    | 'department'
    | 'doctor'
    | 'type'
    | 'status';
  sort_order: 'asc' | 'desc';
};

async function assertRelations(patientId: string, departmentId: string, doctorId: string) {
  const [patient, department, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } }),
    prisma.department.findFirst({ where: { id: departmentId, deletedAt: null, status: 'Active' } }),
    prisma.user.findFirst({
      where: {
        id: doctorId,
        deletedAt: null,
        status: 'ACTIVE',
        roles: { some: { role: { code: 'DOCTOR' } } },
      },
      select: { departmentId: true },
    }),
  ]);
  if (!patient) throw new AppError(422, 'Select a valid patient.', 'INVALID_PATIENT');
  if (!department) throw new AppError(422, 'Select a valid department.', 'INVALID_DEPARTMENT');
  if (!doctor) throw new AppError(422, 'Select a valid doctor.', 'INVALID_DOCTOR');
  if (doctor.departmentId && doctor.departmentId !== departmentId)
    throw new AppError(
      422,
      'The selected doctor does not belong to this department.',
      'DOCTOR_DEPARTMENT_MISMATCH',
    );
}

async function assertRelationsForNewPatient(departmentId: string, doctorId: string) {
  const [department, doctor] = await Promise.all([
    prisma.department.findFirst({ where: { id: departmentId, deletedAt: null, status: 'Active' } }),
    prisma.user.findFirst({
      where: {
        id: doctorId,
        deletedAt: null,
        status: 'ACTIVE',
        roles: { some: { role: { code: 'DOCTOR' } } },
      },
      select: { departmentId: true },
    }),
  ]);
  if (!department) throw new AppError(422, 'Select a valid department.', 'INVALID_DEPARTMENT');
  if (!doctor) throw new AppError(422, 'Select a valid doctor.', 'INVALID_DOCTOR');
  if (doctor.departmentId && doctor.departmentId !== departmentId)
    throw new AppError(
      422,
      'The selected doctor does not belong to this department.',
      'DOCTOR_DEPARTMENT_MISMATCH',
    );
}

export const appointmentService = {
  async get(id: string) {
    const item = await prisma.appointment.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    const billing = await billingByAppointment([id]);
    return map(item, billing.get(id));
  },

  async summary() {
    const settings = await prisma.applicationSettings.findUnique({ where: { id: 'default' } });
    const { start, end } = calendarDayBounds(new Date(), settings?.timezone ?? 'Asia/Kolkata');
    const [today, confirmed, completed, invoiceItems] = await Promise.all([
      prisma.appointment.count({
        where: { appointmentAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      }),
      prisma.appointment.count({ where: { status: 'CONFIRMED' } }),
      prisma.appointment.count({ where: { status: 'COMPLETED' } }),
      prisma.invoiceItem.findMany({
        where: { sourceId: { not: '' }, invoice: { status: { not: 'Cancelled' } } },
        select: {
          sourceId: true,
          invoice: { select: { items: true, payments: { include: { refunds: true } } } },
        },
      }),
    ]);
    const appointmentIds = new Set(
      (
        await prisma.appointment.findMany({
          where: { id: { in: invoiceItems.map((item) => item.sourceId) } },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    const pendingPayment = new Set(
      invoiceItems
        .filter(
          (item) =>
            appointmentIds.has(item.sourceId) && invoiceFinancials(item.invoice).balance.gt(0),
        )
        .map((item) => item.sourceId),
    ).size;
    return { today, confirmed, pendingPayment, completed, scope: 'all-time-except-today' };
  },

  async list(query: ListQuery) {
    const search = query.search?.trim();
    let billedAppointmentIds: string[] | undefined;
    if (query.payment_status) {
      const billed = await prisma.invoiceItem.findMany({
        where: { invoice: { status: { not: 'Cancelled' } } },
        include: {
          invoice: { include: { items: true, payments: { include: { refunds: true } } } },
        },
      });
      billedAppointmentIds = billed
        .filter((item) => invoiceFinancials(item.invoice).status === query.payment_status)
        .map((item) => item.sourceId);
      if (query.payment_status === 'Not Billed')
        billedAppointmentIds = billed.map((item) => item.sourceId);
    }
    const where: Prisma.AppointmentWhereInput = {
      ...(query.department_id ? { departmentId: query.department_id } : {}),
      ...(query.doctor_id ? { doctorId: query.doctor_id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.gender ? { patient: { is: { gender: query.gender } } } : {}),
      ...(query.payment_status === 'Not Billed'
        ? { id: { notIn: billedAppointmentIds ?? [] } }
        : query.payment_status
          ? { id: { in: billedAppointmentIds ?? [] } }
          : {}),
      ...(query.start_date || query.end_date
        ? {
            appointmentAt: {
              ...(query.start_date ? { gte: new Date(query.start_date) } : {}),
              ...(query.end_date ? { lt: new Date(query.end_date) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { reason: { contains: search, mode: 'insensitive' } },
              { patient: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
              { patient: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
              { doctor: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
              { doctor: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
              { department: { is: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const sortMap: Record<ListQuery['sort_by'], Prisma.AppointmentOrderByWithRelationInput> = {
      appointmentAt: { appointmentAt: query.sort_order },
      createdAt: { createdAt: query.sort_order },
      number: { number: query.sort_order },
      patient: { patient: { firstName: query.sort_order } },
      gender: { patient: { gender: query.sort_order } },
      age: { patient: { dob: query.sort_order === 'asc' ? 'desc' : 'asc' } },
      department: { department: { name: query.sort_order } },
      doctor: { doctor: { firstName: query.sort_order } },
      type: { type: query.sort_order },
      status: { status: query.sort_order },
    };
    const [items, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        include,
        orderBy: [sortMap[query.sort_by], { id: 'asc' }],
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
      prisma.appointment.count({ where }),
    ]);
    const billing = await billingByAppointment(items.map((item) => item.id));
    return {
      data: items.map((item) => map(item, billing.get(item.id))),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  },

  async options() {
    const [patients, departments, doctors] = await Promise.all([
      prisma.patient.findMany({
        where: { deletedAt: null, status: 'Active' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mrn: true,
          gender: true,
          phone: true,
          dob: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.department.findMany({
        where: { deletedAt: null, status: 'Active' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { code: 'DOCTOR' } } } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          consultationFee: true,
          specialization: { select: { name: true } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);
    return { patients, departments, doctors };
  },

  async searchPatients(search: string) {
    const value = search.trim();
    if (value.length < 2) return [];
    return prisma.patient.findMany({
      where: {
        deletedAt: null,
        status: 'Active',
        OR: [
          { mrn: { equals: value, mode: 'insensitive' } },
          { phone: { equals: value } },
          { firstName: { contains: value, mode: 'insensitive' } },
          { lastName: { contains: value, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        middleName: true,
        lastName: true,
        gender: true,
        phone: true,
        dob: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 20,
    });
  },

  async availability(doctorId: string, date: string, appointmentId?: string) {
    const doctor = await prisma.user.findFirst({
      where: {
        id: doctorId,
        deletedAt: null,
        status: 'ACTIVE',
        roles: { some: { role: { code: 'DOCTOR' } } },
      },
      select: { id: true },
    });
    if (!doctor) throw new AppError(404, 'Doctor was not found.', 'NOT_FOUND');
    const range = calendarDateBounds(date);
    const booked = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentAt: { gte: range.start, lt: range.end },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(appointmentId ? { id: { not: appointmentId } } : {}),
      },
      select: { appointmentAt: true },
    });
    const bookedTimes = new Set(booked.map((item) => slotLabel(item.appointmentAt)));
    const slots = Array.from({ length: 16 }, (_, index) => {
      const minutes = 9 * 60 + index * 30;
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return { time, available: !bookedTimes.has(time) };
    });
    return { date, doctorId, slots, source: 'configured-clinic-hours' };
  },

  async create(input: any, actorId: string) {
    if (input.patientId) await assertRelations(input.patientId, input.departmentId, input.doctorId);
    else await assertRelationsForNewPatient(input.departmentId, input.doctorId);
    let item: any;
    try {
      item = await prisma.$transaction(
        async (tx) => {
          const patientId =
            input.patientId ??
            (
              await tx.patient.create({
                data: {
                  mrn: `MRN-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}${randomInt(10, 99)}`,
                  firstName: input.newPatient.firstName.trim(),
                  middleName: input.newPatient.middleName?.trim() || null,
                  lastName: input.newPatient.lastName.trim(),
                  dob: new Date(input.newPatient.dob),
                  gender: input.newPatient.gender,
                  phone: input.newPatient.phone,
                  allergies: [],
                },
              })
            ).id;
          const created = await tx.appointment.create({
            data: {
              number: `APT-${Date.now().toString().slice(-8)}`,
              patientId,
              departmentId: input.departmentId,
              doctorId: input.doctorId,
              appointmentAt: new Date(input.appointmentAt),
              type: input.type,
              consultationType: input.consultationType,
              reason: input.reason.trim(),
              fee: input.fee,
              status: 'SCHEDULED',
            },
            include,
          });
          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: 'APPOINTMENT_CREATE',
              module: 'appointments',
              entityType: 'Appointment',
              entityId: created.id,
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          409,
          'The selected doctor and time slot are no longer available.',
          'SLOT_UNAVAILABLE',
        );
      throw error;
    }
    await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'], {
      type: 'APPOINTMENT_CREATED',
      title: 'New appointment',
      message: `Appointment ${item.number} was booked for ${item.patient.firstName} ${item.patient.lastName}.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: item.id,
    });
    return map(item);
  },

  async reschedule(id: string, input: any, actorId: string) {
    const current = await prisma.appointment.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    if (!['SCHEDULED', 'CONFIRMED'].includes(current.status))
      throw new AppError(
        409,
        'This appointment can no longer be rescheduled.',
        'NOT_RESCHEDULABLE',
      );
    await assertRelations(current.patientId, input.departmentId, input.doctorId);
    const nextAt = new Date(input.appointmentAt);
    if (nextAt <= new Date())
      throw new AppError(422, 'Select a future appointment slot.', 'INVALID_SLOT');
    try {
      return map(
        await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.doctorId}:${nextAt.toISOString()}`}))`;
            const conflict = await tx.appointment.findFirst({
              where: {
                id: { not: id },
                doctorId: input.doctorId,
                appointmentAt: nextAt,
                status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              },
              select: { id: true },
            });
            if (conflict)
              throw new AppError(
                409,
                'The selected time slot is no longer available.',
                'SLOT_UNAVAILABLE',
              );
            const updated = await tx.appointment.update({
              where: { id },
              data: {
                doctorId: input.doctorId,
                departmentId: input.departmentId,
                appointmentAt: nextAt,
              },
              include,
            });
            await tx.auditLog.create({
              data: {
                userId: actorId,
                action: 'APPOINTMENT_RESCHEDULE',
                module: 'appointments',
                entityType: 'Appointment',
                entityId: id,
                metadata: {
                  from: current.appointmentAt.toISOString(),
                  to: nextAt.toISOString(),
                  fromDoctorId: current.doctorId,
                  toDoctorId: input.doctorId,
                  reason: input.reason,
                },
              },
            });
            return updated;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          409,
          'The selected time slot is no longer available.',
          'SLOT_UNAVAILABLE',
        );
      throw error;
    }
  },

  async invoice(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, number: true },
    });
    if (!appointment) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    const item = await prisma.invoiceItem.findFirst({
      where: { sourceId: id },
      include: {
        invoice: {
          include: { patient: true, items: true, payments: { include: { refunds: true } } },
        },
      },
    });
    if (!item || item.invoice.status === 'Cancelled')
      throw new AppError(
        404,
        'No invoice is associated with this appointment.',
        'INVOICE_NOT_FOUND',
      );
    const financials = invoiceFinancials(item.invoice);
    return {
      appointmentNumber: appointment.number,
      ...item.invoice,
      total: Number(financials.total),
      paidAmount: Number(financials.netPaid),
      balance: Number(financials.balance),
      paymentStatus: financials.status,
    };
  },

  async invoicePdf(id: string) {
    const invoice: any = await this.invoice(id);
    const hospital = await prisma.hospitalSettings.findUnique({ where: { id: 'default' } });
    const patientName = `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim();
    const lines = [
      hospital?.hospitalName ?? 'MediCare+',
      [hospital?.address, hospital?.phone, hospital?.email].filter(Boolean).join(' | '),
      `Invoice: ${invoice.number}`,
      `Invoice date: ${new Date(invoice.createdAt).toISOString().slice(0, 10)}`,
      `Patient: ${patientName} (${invoice.patient.mrn})`,
      `Appointment: ${invoice.appointmentNumber}`,
      '',
      'Description | Qty | Rate | Amount',
      ...invoice.items.map(
        (item: any) =>
          `${item.description} | ${item.quantity} | ${Number(item.unitPrice).toFixed(2)} | ${(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}`,
      ),
      '',
      `Grand total: INR ${invoice.total.toFixed(2)}`,
      `Amount paid: INR ${invoice.paidAmount.toFixed(2)}`,
      `Outstanding: INR ${invoice.balance.toFixed(2)}`,
      `Payment status: ${invoice.paymentStatus}`,
    ];
    return { filename: `${invoice.number}.pdf`, data: createTextPdf(lines) };
  },

  async update(id: string, input: any) {
    const found = await prisma.appointment.findUnique({ where: { id } });
    if (!found) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    if (found.status === 'COMPLETED' && input.patientId !== found.patientId)
      throw new AppError(
        409,
        'Patient information cannot be changed from a completed appointment.',
        'COMPLETED_APPOINTMENT_PATIENT_READ_ONLY',
      );
    await assertRelations(input.patientId, input.departmentId, input.doctorId);
    return map(
      await prisma.appointment.update({
        where: { id },
        data: {
          patientId: input.patientId,
          departmentId: input.departmentId,
          doctorId: input.doctorId,
          appointmentAt: new Date(input.appointmentAt),
          type: input.type,
          consultationType: input.consultationType,
          reason: input.reason.trim(),
          fee: input.fee,
        },
        include,
      }),
    );
  },

  async status(id: string, status: AppointmentStatus) {
    const found = await prisma.appointment.findUnique({ where: { id } });
    if (!found) throw new AppError(404, 'Appointment was not found.', 'NOT_FOUND');
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      CHECKED_IN: ['WAITING', 'IN_CONSULTATION', 'CANCELLED'],
      WAITING: ['IN_CONSULTATION', 'CANCELLED', 'NO_SHOW'],
      IN_CONSULTATION: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };
    if (!transitions[found.status].includes(status))
      throw new AppError(
        409,
        `${found.status} cannot transition to ${status}.`,
        'INVALID_STATUS_TRANSITION',
      );
    if (status === 'CHECKED_IN') await opdQueueService.checkIn(id);
    const item =
      status === 'CHECKED_IN'
        ? await prisma.appointment.findUniqueOrThrow({ where: { id }, include })
        : await prisma.appointment.update({ where: { id }, data: { status }, include });
    await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'], {
      type: `APPOINTMENT_${status}`,
      title: `Appointment ${status.toLowerCase().replaceAll('_', ' ')}`,
      message: `Appointment ${item.number} status changed.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: item.id,
    });
    return map(item);
  },
};
