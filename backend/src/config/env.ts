import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRATION: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRATION_DAYS: z.coerce.number().int().positive().default(7),
  FRONTEND_URL: z.string().url().default('http://localhost:4200'),
  FILE_UPLOAD_PATH: z.string().default('./uploads'),
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
});

export const env = schema.parse(process.env);
