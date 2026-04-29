import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/auth.service.js';
import { InMemoryUserRepository } from '../../src/repositories/user.repository.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(new InMemoryUserRepository());
  });

  describe('register', () => {
    it('creates a user and returns a record', async () => {
      const user = await service.register({
        email: 'test@example.com',
        password: 'securepassword',
        displayName: 'Test User',
      });
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.displayName).toBe('Test User');
    });

    it('stores hashed password (not plaintext)', async () => {
      const user = await service.register({
        email: 'hash@example.com',
        password: 'plaintext',
        displayName: 'Hash Test',
      });
      expect(user.passwordHash).not.toBe('plaintext');
      expect(user.passwordHash.length).toBeGreaterThan(20);
    });

    it('normalizes email to lowercase', async () => {
      const user = await service.register({
        email: 'UPPER@EXAMPLE.COM',
        password: 'password123',
        displayName: 'Case Test',
      });
      expect(user.email).toBe('upper@example.com');
    });

    it('throws EMAIL_IN_USE for duplicate email', async () => {
      await service.register({
        email: 'dup@example.com',
        password: 'password1',
        displayName: 'First',
      });
      await expect(
        service.register({
          email: 'dup@example.com',
          password: 'password2',
          displayName: 'Second',
        })
      ).rejects.toMatchObject({ code: 'EMAIL_IN_USE' });
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register({
        email: 'login@example.com',
        password: 'correct-password',
        displayName: 'Login User',
      });
    });

    it('returns user for correct credentials', async () => {
      const user = await service.login('login@example.com', 'correct-password');
      expect(user.email).toBe('login@example.com');
    });

    it('throws INVALID_CREDENTIALS for wrong password', async () => {
      await expect(service.login('login@example.com', 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('throws INVALID_CREDENTIALS for unknown email', async () => {
      await expect(service.login('nobody@example.com', 'any')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('is case-insensitive for email', async () => {
      const user = await service.login('LOGIN@EXAMPLE.COM', 'correct-password');
      expect(user.email).toBe('login@example.com');
    });
  });

  describe('toPublicUser', () => {
    it('omits passwordHash', async () => {
      const user = await service.register({
        email: 'public@example.com',
        password: 'password123',
        displayName: 'Public',
      });
      const pub = service.toPublicUser(user);
      expect('passwordHash' in pub).toBe(false);
      expect(pub.id).toBe(user.id);
      expect(pub.email).toBe(user.email);
    });
  });
});
