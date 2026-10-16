import { createHash, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AppError } from '../utils/app-error.js';
import { notificationProvider } from './notification-provider.js';
import { prisma } from '../config/prisma.js';
import { administrationService, validatePasswordAgainstPolicy } from './administration.service.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const permissionsFor = (user: Awaited<ReturnType<typeof authRepository.findUserByEmail>>) => [
  ...new Set(
    user?.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)) ??
      [],
  ),
];
const rolesFor = (user: Awaited<ReturnType<typeof authRepository.findUserByEmail>>) => [
  ...new Set(user?.roles.map(({ role }) => role.code) ?? []),
];

type AuthUser = NonNullable<Awaited<ReturnType<typeof authRepository.findUserByEmail>>>;
const rolePriority = [
  'HOSPITAL_ADMIN',
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'PHARMACIST',
  'LAB_TECHNICIAN',
  'RADIOLOGY_TECHNICIAN',
  'BILLING_STAFF',
];
const primaryRoleFor = (user: AuthUser) => {
  const roles = user.roles.map(({ role }) => role);
  if (!roles.length) {
    throw new AppError(403, 'The account does not have an assigned role.', 'ACCOUNT_ROLE_MISSING');
  }
  return [...roles].sort((left, right) => {
    const leftIndex = rolePriority.indexOf(left.code);
    const rightIndex = rolePriority.indexOf(right.code);
    return (
      (leftIndex < 0 ? rolePriority.length : leftIndex) -
      (rightIndex < 0 ? rolePriority.length : rightIndex)
    );
  })[0]!;
};
const sessionUserFor = (user: AuthUser) => {
  const primaryRole = primaryRoleFor(user);
  return {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    phone: user.phone,
    role: { id: primaryRole.id, code: primaryRole.code, name: primaryRole.name },
    roles: user.roles.map(({ role }) => ({ id: role.id, code: role.code, name: role.name })),
    permissions: permissionsFor(user),
  };
};

export const authService = {
  async login(
    email: string,
    password: string,
    context: { userAgent?: string; ipAddress?: string },
  ) {
    let user = await authRepository.findUserByEmail(email);
    const security = await administrationService.security();
    if(user?.lockedUntil && user.lockedUntil>new Date()) throw new AppError(401,'Email or password is incorrect.','INVALID_CREDENTIALS');
    if(user?.status==='LOCKED' && user.lockedUntil && user.lockedUntil<=new Date()){await prisma.user.update({where:{id:user.id},data:{status:'ACTIVE',lockedUntil:null,failedLoginAttempts:0}});user=await authRepository.findUserByEmail(email);}
    if (!user || user.status !== 'ACTIVE' || !(await argon2.verify(user.passwordHash, password))) {
      if(user){const attempts=user.failedLoginAttempts+1;await prisma.user.update({where:{id:user.id},data:{failedLoginAttempts:attempts>=security.maximumLoginAttempts?0:attempts,...(attempts>=security.maximumLoginAttempts?{lockedUntil:new Date(Date.now()+security.accountLockMinutes*60_000),status:'LOCKED'}:{})}});}
      throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
    }
    const sessionId = randomUUID();
    await prisma.user.update({where:{id:user.id},data:{failedLoginAttempts:0,lockedUntil:null}});
    const permissions = permissionsFor(user);
    const roles = rolesFor(user);
    const refreshToken = jwt.sign(
      { sub: user.id, sid: sessionId, type: 'refresh' },
      env.REFRESH_TOKEN_SECRET,
      { expiresIn: `${env.REFRESH_TOKEN_EXPIRATION_DAYS}d` },
    );
    await authRepository.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 86_400_000),
      ...context,
    });
    await authRepository.touchLogin(user.id);
    const accessToken = jwt.sign(
      { sub: user.id, sid: sessionId, permissions, roles },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: `${security.sessionTimeoutMinutes}m` as SignOptions['expiresIn'] },
    );
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: security.sessionTimeoutMinutes * 60,
      user: sessionUserFor(user),
    };
  },
  async logout(sessionId: string) {
    await authRepository.revokeSession(sessionId);
  },
  async refresh(rawToken: string, context: { userAgent?: string; ipAddress?: string }) {
    let claims: { sub: string; sid: string; type: string };
    try {
      claims = jwt.verify(rawToken, env.REFRESH_TOKEN_SECRET) as typeof claims;
    } catch {
      throw new AppError(401, 'The refresh token is invalid or expired.', 'INVALID_REFRESH_TOKEN');
    }
    const session = await authRepository.findSession(claims.sid);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.tokenHash !== hashToken(rawToken)
    ) {
      if (session) await authRepository.revokeAllSessions(session.userId);
      throw new AppError(401, 'The refresh session is no longer valid.', 'INVALID_REFRESH_TOKEN');
    }
    await authRepository.revokeSession(session.id);
    const user = await authRepository.findUserById(session.userId);
    if (!user || user.status !== 'ACTIVE')
      throw new AppError(401, 'The account is unavailable.', 'UNAUTHORIZED');
    const security = await administrationService.security();
    const sid = randomUUID(),
      permissions = permissionsFor(user),
      roles = rolesFor(user),
      refreshToken = jwt.sign({ sub: user.id, sid, type: 'refresh' }, env.REFRESH_TOKEN_SECRET, {
        expiresIn: `${env.REFRESH_TOKEN_EXPIRATION_DAYS}d`,
      });
    await authRepository.createSession({
      id: sid,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 86_400_000),
      ...context,
    });
    return {
      access_token: jwt.sign({ sub: user.id, sid, permissions, roles }, env.ACCESS_TOKEN_SECRET, {
        expiresIn: `${security.sessionTimeoutMinutes}m` as SignOptions['expiresIn'],
      }),
      refresh_token: refreshToken,
      expires_in: security.sessionTimeoutMinutes * 60,
      user: sessionUserFor(user),
    };
  },
  async me(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user || user.status !== 'ACTIVE')
      throw new AppError(401, 'The account is unavailable.', 'UNAUTHORIZED');
    return sessionUserFor(user);
  },
  async changePassword(userId: string, current: string, next: string) {
    const user = await authRepository.findUserById(userId);
    if (!user || !(await argon2.verify(user.passwordHash, current)))
      throw new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', {
        current_password: ['Current password is incorrect.'],
      });
    await validatePasswordAgainstPolicy(next);
    await authRepository.updatePassword(userId, await argon2.hash(next));
    await authRepository.revokeAllSessions(userId);
  },
  async forgotPassword(email: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || user.status !== 'ACTIVE') return;
    await authRepository.invalidatePasswordResets(user.id);
    const token = randomUUID() + randomUUID();
    await authRepository.createPasswordReset({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    await notificationProvider.sendPasswordReset(
      user.email,
      `${env.FRONTEND_RESET_URL}?token=${encodeURIComponent(token)}`,
    );
  },
  async resetPassword(token: string, password: string) {
    await validatePasswordAgainstPolicy(password);
    const record = await authRepository.findPasswordReset(hashToken(token));
    if (!record || record.usedAt || record.expiresAt <= new Date())
      throw new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', {
        token: ['The password reset link is invalid or expired.'],
      });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash: await argon2.hash(password) },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await tx.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  },
};
