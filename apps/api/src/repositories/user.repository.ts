import { randomUUID } from 'node:crypto';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  city: string;
  createdAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: { email: string; passwordHash: string; displayName: string }): Promise<UserRecord>;
  updateCity(id: string, city: string): Promise<void>;
}

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, UserRecord> = new Map();
  private emailIndex: Map<string, string> = new Map();

  async findByEmail(email: string): Promise<UserRecord | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return null;
    return this.users.get(id) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async create(data: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      displayName: data.displayName,
      city: 'Austin, TX',
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);
    return user;
  }

  async updateCity(id: string, city: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.city = city;
    }
  }
}
