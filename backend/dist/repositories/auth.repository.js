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
    findUserById: (id) => prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } }),
    updatePassword: (id, passwordHash) => prisma.user.update({ where: { id }, data: { passwordHash } }),
    revokeAllSessions: (userId) => prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    createPasswordReset: (data) => prisma.passwordResetToken.create({ data }),
    findPasswordReset: (tokenHash) => prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
    consumePasswordReset: (id) => prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } }),
    invalidatePasswordResets: (userId) => prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    updateAvatar: (id, avatarKey) => prisma.user.update({ where: { id }, data: { avatarKey }, select: { id: true, avatarKey: true } }),
};
