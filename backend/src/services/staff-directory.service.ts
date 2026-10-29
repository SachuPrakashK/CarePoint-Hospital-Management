import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';

export type StaffKind = 'doctors' | 'employees';
type ListQuery = {
  page: number;
  page_size: number;
  search?: string;
  department_id?: string;
  specialization_id?: string;
  designation?: string;
  status?: UserStatus;
  sort_by:
    | 'employeeCode'
    | 'firstName'
    | 'department'
    | 'specialization'
    | 'designation'
    | 'phone'
    | 'email'
    | 'yearsOfExperience'
    | 'joiningDate'
    | 'status';
  sort_order: 'asc' | 'desc';
};
type StaffInput = {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string | null;
  phone: string;
  email: string;
  address?: string;
  employeeCode: string;
  departmentId: string;
  specializationId?: string | null;
  medicalRegistration?: string | null;
  qualification?: string;
  yearsOfExperience?: number | null;
  consultationFee?: number | null;
  designation?: string;
  joiningDate?: string | null;
  employmentType?: string;
  status?: UserStatus;
  roleCode?: string;
  password?: string;
};
const include = {
  department: true,
  specialization: true,
  roles: { include: { role: true } },
} as const;
const roleWhere = (kind: StaffKind): Prisma.UserWhereInput =>
  kind === 'doctors'
    ? { roles: { some: { role: { code: 'DOCTOR' } } } }
    : { roles: { some: { role: { code: { notIn: ['DOCTOR', 'HOSPITAL_ADMIN'] } } } } };
const serialize = (value: any) => ({
  ...value,
  consultationFee: value.consultationFee === null ? null : Number(value.consultationFee),
});
const ensureRelations = async (input: StaffInput, kind: StaffKind) => {
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, status: 'Active', deletedAt: null },
  });
  if (!department) throw new AppError(422, 'Select an active department.', 'INVALID_DEPARTMENT');
  if (kind === 'doctors') {
    if (!input.specializationId)
      throw new AppError(422, 'Specialization is required.', 'VALIDATION_ERROR');
    const specialization = await prisma.specialization.findFirst({
      where: {
        id: input.specializationId,
        departmentId: input.departmentId,
        status: 'Active',
        deletedAt: null,
      },
    });
    if (!specialization)
      throw new AppError(
        422,
        'Select a specialization in the chosen department.',
        'INVALID_SPECIALIZATION',
      );
  }
  const code = kind === 'doctors' ? 'DOCTOR' : input.roleCode;
  if (!code || (kind === 'employees' && (code === 'DOCTOR' || code === 'HOSPITAL_ADMIN')))
    throw new AppError(422, 'Select an employee role.', 'INVALID_ROLE');
  const role = await prisma.role.findFirst({ where: { code, status: 'ACTIVE' } });
  if (!role) throw new AppError(422, 'The selected role is not available.', 'INVALID_ROLE');
  return role;
};
export const staffDirectoryService = {
  async list(kind: StaffKind, q: ListQuery) {
    const direction = q.sort_order;
    const sorts: Record<ListQuery['sort_by'], Prisma.UserOrderByWithRelationInput> = {
      employeeCode: { employeeCode: direction },
      firstName: { firstName: direction },
      department: { department: { name: direction } },
      specialization: { specialization: { name: direction } },
      designation: { designation: direction },
      phone: { phone: direction },
      email: { email: direction },
      yearsOfExperience: { yearsOfExperience: direction },
      joiningDate: { joiningDate: direction },
      status: { status: direction },
    };
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...roleWhere(kind),
      ...(q.status ? { status: q.status } : {}),
      ...(q.department_id ? { departmentId: q.department_id } : {}),
      ...(q.specialization_id ? { specializationId: q.specialization_id } : {}),
      ...(q.designation ? { designation: { equals: q.designation, mode: 'insensitive' } } : {}),
      ...(q.search
        ? {
            OR: [
              { employeeCode: { contains: q.search, mode: 'insensitive' } },
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search, mode: 'insensitive' } },
              { medicalRegistration: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include,
        orderBy: [sorts[q.sort_by], { id: 'asc' }],
        skip: (q.page - 1) * q.page_size,
        take: q.page_size,
      }),
      prisma.user.count({ where }),
    ]);
    return {
      data: data.map(serialize),
      pagination: {
        page: q.page,
        page_size: q.page_size,
        total,
        total_pages: Math.ceil(total / q.page_size),
      },
    };
  },
  async get(kind: StaffKind, id: string) {
    const value = await prisma.user.findFirst({
      where: { id, deletedAt: null, ...roleWhere(kind) },
      include,
    });
    if (!value)
      throw new AppError(
        404,
        kind === 'doctors' ? 'Doctor was not found.' : 'Employee was not found.',
        'NOT_FOUND',
      );
    return serialize(value);
  },
  async create(kind: StaffKind, input: StaffInput, actorId: string) {
    const role = await ensureRelations(input, kind);
    try {
      const value = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email.toLowerCase(),
            passwordHash: await argon2.hash(input.password ?? randomUUID() + randomUUID()),
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            status: input.status ?? UserStatus.ACTIVE,
            employeeCode: input.employeeCode,
            gender: input.gender,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            address: input.address || null,
            departmentId: input.departmentId,
            specializationId: kind === 'doctors' ? input.specializationId : null,
            medicalRegistration: kind === 'doctors' ? input.medicalRegistration : null,
            qualification: kind === 'doctors' ? input.qualification : null,
            yearsOfExperience: kind === 'doctors' ? input.yearsOfExperience : null,
            consultationFee:
              kind === 'doctors' && input.consultationFee !== null ? input.consultationFee : null,
            designation: kind === 'employees' ? input.designation : null,
            joiningDate:
              kind === 'employees' && input.joiningDate ? new Date(input.joiningDate) : null,
            employmentType: kind === 'employees' ? input.employmentType : null,
            roles: { create: { roleId: role.id } },
          },
          include,
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'CREATE',
            module: kind,
            entityType: 'User',
            entityId: user.id,
            metadata: { employeeCode: input.employeeCode },
          },
        });
        return user;
      });
      return serialize(value);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          409,
          'Email, employee ID, or registration number already exists.',
          'DUPLICATE_STAFF',
        );
      throw error;
    }
  },
  async update(kind: StaffKind, id: string, input: StaffInput, actorId: string) {
    await this.get(kind, id);
    const role = await ensureRelations(input, kind);
    try {
      return serialize(
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.update({
            where: { id },
            data: {
              email: input.email.toLowerCase(),
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone,
              status: input.status ?? UserStatus.ACTIVE,
              employeeCode: input.employeeCode,
              gender: input.gender,
              dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
              address: input.address || null,
              departmentId: input.departmentId,
              specializationId: kind === 'doctors' ? input.specializationId : null,
              medicalRegistration: kind === 'doctors' ? input.medicalRegistration : null,
              qualification: kind === 'doctors' ? input.qualification : null,
              yearsOfExperience: kind === 'doctors' ? input.yearsOfExperience : null,
              consultationFee:
                kind === 'doctors' && input.consultationFee !== null ? input.consultationFee : null,
              designation: kind === 'employees' ? input.designation : null,
              joiningDate:
                kind === 'employees' && input.joiningDate ? new Date(input.joiningDate) : null,
              employmentType: kind === 'employees' ? input.employmentType : null,
            },
            include,
          });
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.create({ data: { userId: id, roleId: role.id } });
          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: 'UPDATE',
              module: kind,
              entityType: 'User',
              entityId: id,
            },
          });
          return user;
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          409,
          'Email, employee ID, or registration number already exists.',
          'DUPLICATE_STAFF',
        );
      throw error;
    }
  },
  async remove(kind: StaffKind, id: string, actorId: string) {
    await this.get(kind, id);
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
          sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } },
        },
      }),
      prisma.auditLog.create({
        data: { userId: actorId, action: 'DELETE', module: kind, entityType: 'User', entityId: id },
      }),
    ]);
  },
  async options() {
    const [departments, specializations, roles] = await Promise.all([
      prisma.department.findMany({
        where: { status: 'Active', deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      prisma.specialization.findMany({
        where: { status: 'Active', deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      prisma.role.findMany({
        where: { status: 'ACTIVE', code: { notIn: ['DOCTOR', 'HOSPITAL_ADMIN'] } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { departments, specializations, roles };
  },
};
