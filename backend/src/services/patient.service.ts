import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { AppError } from '../utils/app-error.js';
import { calendarDateBounds } from '../utils/date-time.js';
type PatientInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  dob: Date;
  gender: string;
  bloodGroup?: string;
  phone: string;
  email?: string;
  city?: string;
  emergencyContact?: string;
  allergies?: string[];
  status?: string;
};
export const patientService = {
  async list(query: {
    page: number;
    page_size: number;
    search?: string;
    status?: string;
    gender?: string;
    min_age?: number;
    max_age?: number;
    created_from?: string;
    created_to?: string;
    sort_by: 'createdAt' | 'firstName' | 'lastName' | 'mrn';
    sort_order: 'asc' | 'desc';
  }) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const todayParts = today.split('-');
    const year = Number(todayParts[0]);
    const month = Number(todayParts[1]);
    const day = Number(todayParts[2]);
    const dobFrom = query.max_age == null
      ? undefined
      : new Date(Date.UTC(year - query.max_age - 1, month - 1, day + 1));
    const dobTo = query.min_age == null
      ? undefined
      : new Date(Date.UTC(year - query.min_age, month - 1, day));
    const createdFrom = query.created_from ? calendarDateBounds(query.created_from).start : undefined;
    const createdTo = query.created_to ? calendarDateBounds(query.created_to).end : undefined;
    const baseWhere: Prisma.PatientWhereInput = { deletedAt: null };
    const where: Prisma.PatientWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(dobFrom || dobTo ? { dob: { ...(dobFrom ? { gte: dobFrom } : {}), ...(dobTo ? { lte: dobTo } : {}) } } : {}),
      ...(createdFrom || createdTo ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lt: createdTo } : {}) } } : {}),
      ...(query.search
        ? {
            OR: [
              { mrn: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [data, total, allTotal] = await Promise.all([
      patientRepository.list(where, (query.page - 1) * query.page_size, query.page_size, [
        { [query.sort_by]: query.sort_order }, { id: 'asc' },
      ]),
      patientRepository.count(where),
      patientRepository.count(baseWhere),
    ]);
    return {
      data,
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
        all_total: allTotal,
      },
    };
  },
  async details(id: string) {
    const item = await patientRepository.find(id);
    if (!item) throw new AppError(404, 'Patient was not found.', 'PATIENT_NOT_FOUND');
    return item;
  },
  async appointments(id: string) {
    await this.details(id);
    return prisma.appointment.findMany({
      where: { patientId: id },
      include: {
        department: { select: { name: true } },
        doctor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { appointmentAt: 'desc' },
    });
  },
  async visits(id: string) {
    await this.details(id);
    return prisma.consultation.findMany({
      where: { patientId: id },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
        appointment: { select: { number: true, appointmentAt: true } },
        diagnoses: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },
  async prescriptions(id: string) {
    await this.details(id);
    return prisma.prescription.findMany({
      where: { patientId: id },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },
  async medicalRecords(id: string) {
    await this.details(id);
    const [diagnoses, vitals, histories, allergies] = await Promise.all([
      prisma.diagnosis.findMany({ where: { patientId: id }, orderBy: { diagnosedAt: 'desc' } }),
      prisma.vital.findMany({ where: { patientId: id }, orderBy: { recordedAt: 'desc' } }),
      prisma.medicalHistory.findMany({ where: { patientId: id }, orderBy: { recordedAt: 'desc' } }),
      prisma.patientAllergy.findMany({ where: { patientId: id, active: true }, orderBy: { recordedAt: 'desc' } }),
    ]);
    return { diagnoses, vitals, histories, allergies };
  },
  async create(input: PatientInput) {
    const mrn = `MRN-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}${randomInt(10, 99)}`;
    return patientRepository.create({
      ...input,
      mrn,
      email: input.email || null,
      middleName: input.middleName || null,
      city: input.city || null,
      emergencyContact: input.emergencyContact || null,
      allergies: input.allergies ?? [],
    });
  },
  async update(id: string, input: Partial<PatientInput>) {
    await this.details(id);
    return patientRepository.update(id, input);
  },
  async archive(id: string) {
    await this.details(id);
    return patientRepository.update(id, { status: 'Inactive', deletedAt: new Date() });
  },
};
