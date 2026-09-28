import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
export const authenticate = (req, _res, next) => {
    const value = req.headers.authorization;
    if (!value?.startsWith('Bearer '))
        return next(new AppError(401, 'Authentication is required.', 'UNAUTHORIZED'));
    try {
        const claims = jwt.verify(value.slice(7), env.ACCESS_TOKEN_SECRET);
        req.auth = { userId: claims.sub, sessionId: claims.sid, permissions: claims.permissions ?? [] };
        next();
    }
    catch {
        next(new AppError(401, 'The access token is invalid or expired.', 'UNAUTHORIZED'));
    }
};
export const requirePermissions = (...required) => (req, _res, next) => {
    const granted = new Set(req.auth?.permissions ?? []);
    if (!required.every((permission) => granted.has(permission))) {
        return next(new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'));
    }
    next();
};
