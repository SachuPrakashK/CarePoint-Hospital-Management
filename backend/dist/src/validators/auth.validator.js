import { z } from 'zod';
export const loginSchema = z.object({
    body: z.object({ email: z.email(), password: z.string().min(8).max(128) }),
    query: z.object({}).passthrough(), params: z.object({}).passthrough(),
});
export const refreshSchema = z.object({
    body: z.object({ refresh_token: z.string().min(20) }),
    query: z.object({}).passthrough(), params: z.object({}).passthrough(),
});
