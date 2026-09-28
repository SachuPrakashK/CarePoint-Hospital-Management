import { prisma } from '../config/prisma.js';
export const authRepository = {
    findUserByEmail: (email) => prisma.user.findFirst({
        where: { email: email.toLowerCase(), deletedAt: null },
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    }),
    createSession: (data) => prisma.refreshSession.create({ data }),
    findSession: (id) => prisma.refreshSession.findUnique({ include: { user: true }, where: { id } }),
    revokeSession: (id) => prisma.refreshSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }),
    touchLogin: (id) => prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),
};
