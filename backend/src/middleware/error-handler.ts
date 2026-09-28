import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error.js';
import { logger } from '../config/logger.js';

export const notFound: RequestHandler = (req, _res, next) =>
  next(new AppError(404, `Route ${req.method} ${req.path} was not found.`, 'NOT_FOUND'));

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let normalized = error instanceof AppError ? error : undefined;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    normalized = new AppError(409, 'A record with these values already exists.', 'CONFLICT');
  }
  const status = normalized?.statusCode ?? 500;
  if (status >= 500) logger.error({ err: error, requestId: res.getHeader('x-request-id'), path: req.path }, 'Request failed');
  res.status(status).json({
    message: normalized?.message ?? 'An unexpected error occurred.',
    code: normalized?.code ?? 'INTERNAL_SERVER_ERROR',
    ...(normalized?.errors ? { errors: normalized.errors } : {}),
  });
};

