import { z } from 'zod';

export const uuidParam = z.object({
  id: z.string().uuid(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const errorResponse = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  details: z.unknown().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;
export type ErrorResponse = z.infer<typeof errorResponse>;
