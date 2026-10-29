import { z } from 'zod';
const id = z.uuid();
const roleCode = z.string().trim().min(2).max(80);
const status = z.enum(['ACTIVE', 'INACTIVE']);
const body = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.email(),
    phone: z.string().trim().max(30).optional(),
    username: z.string().trim().min(3).max(80).optional(),
    password: z.string().min(12).max(128).optional(),
    status: status.optional(),
  })
  .strict();
export const userListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(100),
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
    role: roleCode.optional(),
    sort_by: z
      .enum(['firstName', 'email', 'phone', 'createdAt', 'lastLoginAt', 'status'])
      .default('createdAt'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
  }),
});
export const userCreateSchema = z.object({
  body: body.extend({ password: z.string().min(12).max(128), roleCode }),
});
export const userUpdateSchema = z.object({
  params: z.object({ id }),
  body: body.partial().refine((v) => Object.keys(v).length > 0),
});
export const userIdSchema = z.object({ params: z.object({ id }) });
export const userStatusSchema = z.object({ params: z.object({ id }), body: z.object({ status }) });
export const userRoleSchema = z.object({ params: z.object({ id }), body: z.object({ roleCode }) });
export const userResetPasswordSchema = z.object({
  params: z.object({ id }),
  body: z.object({ password: z.string().min(8).max(128) }),
});
