/**
 * Drizzle ORM schema for Crawl's PostgreSQL database.
 *
 * This file is the single source of truth for the DB structure.
 * Run `npm run db:generate` to produce migration files after changes.
 *
 * PostGIS requires the `postgis` extension on the database:
 *   CREATE EXTENSION IF NOT EXISTS postgis;
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  numeric,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  state: text('state').notNull(),
  timezone: text('timezone').notNull().default('America/New_York'),
  centerLat: numeric('center_lat', { precision: 9, scale: 6 }).notNull(),
  centerLng: numeric('center_lng', { precision: 9, scale: 6 }).notNull(),
  radiusMeters: integer('radius_meters').notNull().default(8000),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const venues = pgTable(
  'venues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'set null' }),
    googlePlaceId: text('google_place_id').unique(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    types: text('types').array().notNull().default(sql`'{}'::text[]`),
    address: text('address').notNull(),
    city: text('city').notNull(),
    // PostGIS geography column. Drizzle doesn't have a first-class
    // PostGIS type yet — we define it as text and use raw SQL in queries.
    location: text('location'), // 'POINT(lng lat)' WKT string
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    rating: numeric('rating', { precision: 3, scale: 2 }),
    totalRatings: integer('total_ratings'),
    priceLevel: integer('price_level'),
    phone: text('phone'),
    website: text('website'),
    hours: text('hours').notNull().default(''),
    description: text('description').notNull().default(''),
    imageUrl: text('image_url'),
    highlights: text('highlights').array().notNull().default(sql`'{}'::text[]`),
    hotspotScore: integer('hotspot_score').notNull().default(0),
    voteCount: integer('vote_count').notNull().default(0),
    isOpen: boolean('is_open').notNull().default(true),
    isTrending: boolean('is_trending').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cityIdx: index('venues_city_id_idx').on(table.cityId),
  }),
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  city: text('city').notNull().default('Austin, TX'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    votedAt: date('voted_at').notNull().default(sql`CURRENT_DATE`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueVotePerDay: uniqueIndex('votes_user_venue_date_idx').on(
      table.userId,
      table.venueId,
      table.votedAt,
    ),
  }),
);

export type DbCity = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;
export type DbVenue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;
export type DbUser = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DbVote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
