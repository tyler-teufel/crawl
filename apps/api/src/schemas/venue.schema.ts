import { z } from 'zod';
import { paginationQuery } from './common.schema.js';

export const venueSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  primaryType: z.string(),
  address: z.string(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  hotspotScore: z.number().int().min(0).max(100),
  voteCount: z.number().int().min(0),
  isOpen: z.boolean(),
  isTrending: z.boolean(),
  highlights: z.array(z.string()),
  priceLevel: z.number().int().min(0).max(4).nullable(),
  hours: z.string(),
  description: z.string(),
  imageUrl: z.string().url().optional(),
  distance: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const venueListQuery = paginationQuery.extend({
  city: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().positive().default(5000),
  q: z.string().optional(),
  filters: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : [])),
});

export const venueListResponse = z.object({
  data: z.array(venueSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export type Venue = z.infer<typeof venueSchema>;
export type VenueListQuery = z.infer<typeof venueListQuery>;
export type VenueListResponse = z.infer<typeof venueListResponse>;
