import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { UserRepository, UserRecord } from './user.repository.js';
import * as schema from '../db/schema.js';

type DB = NodePgDatabase<typeof schema>;

function rowToUser(row: schema.DbUser): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    city: row.city,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DB) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async create(data: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserRecord> {
    const rows = await this.db
      .insert(schema.users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName,
      })
      .returning();
    return rowToUser(rows[0]);
  }

  async updateCity(id: string, city: string): Promise<void> {
    await this.db.update(schema.users).set({ city }).where(eq(schema.users.id, id));
  }
}
