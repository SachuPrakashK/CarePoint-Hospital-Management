import argon2 from 'argon2';
import { Prisma, UserStatus } from '@prisma/client';
import { userRepository as repo } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { notificationService } from './notification.service.js';
import { validatePasswordAgainstPolicy } from './administration.service.js';
import { prisma } from '../config/prisma.js';

type Input = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  username?: string;
  password?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  roleCode: string;
};
const isHospitalAdmin = (user: Awaited<ReturnType<typeof repo.find>>) =>
  user?.roles.some(({ role }) => role.code === 'HOSPITAL_ADMIN') ?? false;
const protectLastAdmin = async (user: Awaited<ReturnType<typeof repo.find>>) => {
  if (
    isHospitalAdmin(user) &&
    user?.status === 'ACTIVE' &&
    (await repo.activeHospitalAdmins()) <= 1
  )
    throw new AppError(
      409,
      'The only active Hospital Admin cannot be deactivated, deleted, or reassigned.',
      'LAST_HOSPITAL_ADMIN',
    );
};
const role = async (code: string) => {
  const value = await repo.findRole(code);
  if (!value) throw new AppError(422, 'The selected role is not configured.', 'INVALID_ROLE');
  return value;
};

export const userService = {
  async list(q: {
    page: number;
    page_size: number;
    search?: string;
    status?: UserStatus;
    role?: string;
    sort_by: 'firstName' | 'email' | 'phone' | 'createdAt' | 'lastLoginAt' | 'status';
    sort_order: 'asc' | 'desc';
  }) {
    const where: Prisma.UserWhereInput = {
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { roles: { some: { role: { code: q.role } } } } : {}),
    };
    const [data, total] = await Promise.all([
      repo.list(where, (q.page - 1) * q.page_size, q.page_size, [
        { [q.sort_by]: q.sort_order },
        { id: 'asc' },
      ]),
      repo.count(where),
    ]);
    return {
      data,
      pagination: {
        page: q.page,
        page_size: q.page_size,
        total,
        total_pages: Math.ceil(total / q.page_size),
      },
    };
  },
  async details(id: string) {
    const value = await repo.find(id);
    if (!value) throw new AppError(404, 'User was not found.', 'USER_NOT_FOUND');
    return value;
  },
  async create(input: Input) {
    if (!input.password)
      throw new AppError(422, 'An initial password is required.', 'VALIDATION_ERROR');
    await validatePasswordAgainstPolicy(input.password);
    const selected = await role(input.roleCode);
    const user = await repo.create({
      email: input.email.toLowerCase(),
      username: input.username || null,
      passwordHash: await argon2.hash(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      status: input.status ?? UserStatus.ACTIVE,
      roles: { create: { roleId: selected.id } },
    });
    await notificationService.notifyRoles(['HOSPITAL_ADMIN'], {
      type: 'USER_CREATED',
      title: 'User created',
      message: `${user.firstName} ${user.lastName} was created as ${selected.name}.`,
      relatedEntityType: 'User',
      relatedEntityId: user.id,
    });
    await prisma.auditLog.create({
      data: {
        action: 'USER_CREATED',
        module: 'Administration',
        entityType: 'User',
        entityId: user.id,
        metadata: { roleCode: selected.code },
      },
    });
    return user;
  },
  async update(id: string, input: Partial<Omit<Input, 'roleCode'>>) {
    await this.details(id);
    const { password, ...data } = input;
    return repo.update(id, {
      ...data,
      ...(data.email ? { email: data.email.toLowerCase() } : {}),
      ...(password ? { passwordHash: await argon2.hash(password) } : {}),
    });
  },
  async status(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const user = await this.details(id);
    if (status !== 'ACTIVE') await protectLastAdmin(user);
    return repo.update(id, { status });
  },
  async assignRole(id: string, roleCode: string) {
    const user = await this.details(id);
    const selected = await role(roleCode);
    if (isHospitalAdmin(user) && roleCode !== 'HOSPITAL_ADMIN') await protectLastAdmin(user);
    return repo.replaceRole(id, selected.id);
  },
  async archive(id: string) {
    const user = await this.details(id);
    await protectLastAdmin(user);
    return repo.update(id, { status: UserStatus.INACTIVE, deletedAt: new Date() });
  },
  async resetPassword(id: string, password: string, actorId: string) {
    await this.details(id);
    await validatePasswordAgainstPolicy(password);
    const result = await repo.update(id, { passwordHash: await argon2.hash(password) });
    await prisma.refreshSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'PASSWORD_RESET',
        module: 'Administration',
        entityType: 'User',
        entityId: id,
      },
    });
    return result;
  },
};
