import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    ACCESS_TOKEN_EXPIRATION: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRATION_DAYS: z.coerce.number().int().positive().default(7),
    FRONTEND_URL: z.string().url().default('http://localhost:4200'),
    FILE_UPLOAD_PATH: z.string().default('./uploads'),
    STORAGE_DRIVER: z.enum(['local', 'vercel-blob']).default('local'),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    BLOB_STORE_ID: z.string().min(1).optional(),
    VERCEL_OIDC_TOKEN: z.string().min(1).optional(),
    FRONTEND_RESET_URL: z.string().url().default('http://localhost:4200/auth/reset-password'),
    NOTIFICATION_WEBHOOK_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().email().optional(),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.STORAGE_DRIVER !== 'vercel-blob') {
      context.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message: 'Production requires durable private object storage.',
      });
    }
    if (
      value.STORAGE_DRIVER === 'vercel-blob' &&
      !value.BLOB_READ_WRITE_TOKEN &&
      !(value.BLOB_STORE_ID && value.VERCEL_OIDC_TOKEN)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['BLOB_READ_WRITE_TOKEN'],
        message: 'Vercel Blob requires a read-write token or an OIDC token with a store ID.',
      });
    }
  });

export const env = schema.parse(process.env);
