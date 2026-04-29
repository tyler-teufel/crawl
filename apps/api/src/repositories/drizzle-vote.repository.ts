import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { VoteRepository, Vote } from './vote.repository.js';
import * as schema from '../db/schema.js';

type DB = NodePgDatabase<typeof schema>;

function rowToVote(row: schema.DbVote): Vote {
  return {
    id: row.id,
    userId: row.userId,
    venueId: row.venueId,
    votedAt: row.votedAt,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleVoteRepository implements VoteRepository {
  constructor(private readonly db: DB) {}

  async findByUserAndDate(userId: string, date: string): Promise<Vote[]> {
    const rows = await this.db
      .select()
      .from(schema.votes)
      .where(and(eq(schema.votes.userId, userId), eq(schema.votes.votedAt, date)));
    return rows.map(rowToVote);
  }

  async findByUserVenueDate(userId: string, venueId: string, date: string): Promise<Vote | null> {
    const rows = await this.db
      .select()
      .from(schema.votes)
      .where(
        and(
          eq(schema.votes.userId, userId),
          eq(schema.votes.venueId, venueId),
          eq(schema.votes.votedAt, date)
        )
      )
      .limit(1);
    return rows[0] ? rowToVote(rows[0]) : null;
  }

  async create(userId: string, venueId: string): Promise<Vote> {
    const rows = await this.db.insert(schema.votes).values({ userId, venueId }).returning();
    return rowToVote(rows[0]);
  }

  async delete(userId: string, venueId: string): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.db
      .delete(schema.votes)
      .where(
        and(
          eq(schema.votes.userId, userId),
          eq(schema.votes.venueId, venueId),
          eq(schema.votes.votedAt, today)
        )
      )
      .returning({ id: schema.votes.id });
    return result.length > 0;
  }

  async resetByDate(date: string): Promise<number> {
    const result = await this.db
      .delete(schema.votes)
      .where(eq(schema.votes.votedAt, date))
      .returning({ id: schema.votes.id });
    return result.length;
  }

  async countByVenueAndDate(venueId: string, date: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.votes)
      .where(and(eq(schema.votes.venueId, venueId), eq(schema.votes.votedAt, date)));
    return result[0]?.count ?? 0;
  }
}
