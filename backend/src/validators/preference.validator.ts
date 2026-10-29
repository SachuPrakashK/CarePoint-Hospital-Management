import { z } from 'zod';
const tableId = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9._-]+$/i);
export const tablePreferenceParams = z.object({
  body: z.unknown(),
  query: z.object({}).passthrough(),
  params: z.object({ tableId }),
});
export const updateTablePreference = z.object({
  body: z.object({ visibleColumnIds: z.array(z.string().trim().min(1).max(100)).max(100) }),
  query: z.object({}).passthrough(),
  params: z.object({ tableId }),
});
