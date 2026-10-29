import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

const select = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  username: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} as const;

export const userRepository = {
  list: (
    where: Prisma.UserWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.UserOrderByWithRelationInput[],
  ) =>
    prisma.user.findMany({
      where: { ...where, deletedAt: null },
      skip,
      take,
      orderBy,
      select,
    }),
  count: (where: Prisma.UserWhereInput) =>
    prisma.user.count({ where: { ...where, deletedAt: null } }),
  find: (id: string) => prisma.user.findFirst({ where: { id, deletedAt: null }, select }),
  findRole: (code: string) => prisma.role.findFirst({ where: { code, status: 'ACTIVE' } }),
  activeHospitalAdmins: () =>
    prisma.user.count({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: 'HOSPITAL_ADMIN' } } },
      },
    }),
  create: (data: Prisma.UserCreateInput) => prisma.user.create({ data, select }),
  update: (id: string, data: Prisma.UserUpdateInput) =>
    prisma.user.update({ where: { id }, data, select }),
  replaceRole: (userId: string, roleId: string) =>
    prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId } });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select });
    }),
};
