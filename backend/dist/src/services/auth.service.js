import { createHash, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AppError } from '../utils/app-error.js';
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const permissionsFor = (user) => [...new Set(user?.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)) ?? [])];
export const authService = {
    async login(email, password, context) {
        const user = await authRepository.findUserByEmail(email);
        if (!user || user.status !== 'ACTIVE' || !(await argon2.verify(user.passwordHash, password))) {
            throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
        }
        const sessionId = randomUUID();
        const permissions = permissionsFor(user);
        const refreshToken = jwt.sign({ sub: user.id, sid: sessionId, type: 'refresh' }, env.REFRESH_TOKEN_SECRET, { expiresIn: `${env.REFRESH_TOKEN_EXPIRATION_DAYS}d` });
        await authRepository.createSession({
            userId: user.id, tokenHash: hashToken(refreshToken),
            expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 86_400_000), ...context,
        });
        await authRepository.touchLogin(user.id);
        const accessToken = jwt.sign({ sub: user.id, sid: sessionId, permissions }, env.ACCESS_TOKEN_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRATION });
        return { access_token: accessToken, refresh_token: refreshToken, expires_in: env.ACCESS_TOKEN_EXPIRATION, user: { id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName, permissions } };
    },
    async logout(sessionId) { await authRepository.revokeSession(sessionId); },
};
