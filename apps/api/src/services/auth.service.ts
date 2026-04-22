import bcrypt from 'bcryptjs';
import type { UserRepository, UserRecord } from '../repositories/user.repository.js';
import type { User } from '../schemas/auth.schema.js';

const BCRYPT_ROUNDS = 12;

export class AuthService {
  constructor(private readonly userRepo: UserRepository) {}

  async register(data: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<UserRecord> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new AuthError('EMAIL_IN_USE', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    return this.userRepo.create({
      email: data.email,
      passwordHash,
      displayName: data.displayName,
    });
  }

  async login(email: string, password: string): Promise<UserRecord> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.userRepo.findById(id);
  }

  toPublicUser(user: UserRecord): User {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      city: user.city,
      createdAt: user.createdAt,
    };
  }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
