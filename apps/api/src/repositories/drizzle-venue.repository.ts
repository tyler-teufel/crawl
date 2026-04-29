import { eq, ilike, or, sql, desc, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { VenueRepository, VenueFilters } from './venue.repository.js';
import type { Venue } from '../schemas/venue.schema.js';
import * as schema from '../db/schema.js';

type DB = NodePgDatabase<typeof schema>;

function rowToVenue(row: schema.DbVenue): Venue {
  return {
    id: row.id,
    name: row.name,
    primaryType: row.primaryType,
    address: row.address,
    city: row.city,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    hotspotScore: row.hotspotScore,
    voteCount: row.voteCount,
    isOpen: row.isOpen,
    isTrending: row.isTrending,
    highlights: row.highlights,
    priceLevel: row.priceLevel,
    hours: row.hours,
    description: row.description,
    imageUrl: row.imageUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleVenueRepository implements VenueRepository {
  constructor(private readonly db: DB) {}

  async findMany(
    filters: VenueFilters,
    page: number,
    limit: number
  ): Promise<{ data: Venue[]; total: number }> {
    const conditions = [];

    if (filters.city) {
      conditions.push(ilike(schema.venues.city, `%${filters.city}%`));
    }
    if (filters.q) {
      conditions.push(
        or(
          ilike(schema.venues.name, `%${filters.q}%`),
          ilike(schema.venues.primaryType, `%${filters.q}%`),
          ilike(schema.venues.description, `%${filters.q}%`)
        )
      );
    }
    if (filters.types && filters.types.length > 0) {
      conditions.push(or(...filters.types.map((t) => ilike(schema.venues.primaryType, t))));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(schema.venues)
        .where(where)
        .orderBy(desc(schema.venues.hotspotScore))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.venues)
        .where(where),
    ]);

    return {
      data: rows.map(rowToVenue),
      total: countResult[0]?.count ?? 0,
    };
  }

  async findById(id: string): Promise<Venue | null> {
    const rows = await this.db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.id, id))
      .limit(1);
    return rows[0] ? rowToVenue(rows[0]) : null;
  }

  async findTrendingByCity(city: string, limit: number): Promise<Venue[]> {
    const rows = await this.db
      .select()
      .from(schema.venues)
      .where(ilike(schema.venues.city, `%${city}%`))
      .orderBy(desc(schema.venues.hotspotScore))
      .limit(limit);
    return rows.map(rowToVenue);
  }

  async incrementVoteCount(id: string): Promise<void> {
    await this.db
      .update(schema.venues)
      .set({
        voteCount: sql`${schema.venues.voteCount} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.venues.id, id));
  }

  async decrementVoteCount(id: string): Promise<void> {
    await this.db
      .update(schema.venues)
      .set({
        voteCount: sql`greatest(0, ${schema.venues.voteCount} - 1)`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.venues.id, id));
  }

  async updateHotspotScore(id: string, score: number): Promise<void> {
    const clamped = Math.min(100, Math.max(0, score));
    await this.db
      .update(schema.venues)
      .set({
        hotspotScore: clamped,
        isTrending: clamped >= 80,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.venues.id, id));
  }

  async resetDailyMetrics(): Promise<void> {
    await this.db
      .update(schema.venues)
      .set({ voteCount: 0, hotspotScore: 0, isTrending: false, updatedAt: sql`now()` });
  }
}
