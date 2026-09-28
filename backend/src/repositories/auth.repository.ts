import { prisma } from '../config/prisma.js';

export const authRepository = {
  findUserByEmail: (email: string) => prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  }),
  createSession: (data: { id?: string; userId: string; tokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string }) =>
    prisma.refreshSession.create({ data }),
  findSession: (id: string) => prisma.refreshSession.findUnique({ include: { user: true }, where: { id } }),
  revokeSession: (id: string) => prisma.refreshSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }),
  touchLogin: (id: string) => prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),
  findUserById: (id: string) => prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } }),
  updatePassword: (id: string, passwordHash: string) => prisma.user.update({ where: { id }, data: { passwordHash } }),
  revokeAllSessions: (userId: string) => prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  createPasswordReset: (data: { userId: string; tokenHash: string; expiresAt: Date }) => prisma.passwordResetToken.create({ data }),
  findPasswordReset: (tokenHash: string) => prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
  consumePasswordReset: (id: string) => prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } }),
  invalidatePasswordResets: (userId: string) => prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
  updateAvatar: (id: string, avatarKey: string | null) => prisma.user.update({ where: { id }, data: { avatarKey }, select: { id: true, avatarKey: true } }),
};
