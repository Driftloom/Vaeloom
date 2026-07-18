import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';

/**
 * Unit tests for the auth scaffold. Prisma and Workspaces are mocked so these run
 * without a database; bcrypt and JWT run for real to exercise the security path.
 */
describe('AuthService', () => {
  const configValues: Record<string, unknown> = {
    'auth.secret': 'test-secret-at-least-16-chars',
    'auth.tokenTtl': 3600,
  };
  const config = { get: (key: string) => configValues[key] } as unknown as ConfigService;
  const jwt = new JwtService({ secret: 'test-secret-at-least-16-chars' });

  const makeUserRow = (over: Partial<Record<string, unknown>> = {}) => ({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'test@vaeloom.dev',
    displayName: 'test',
    authProvider: 'email',
    passwordHash: null as string | null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  });

  function build(prismaOverride: Record<string, unknown>) {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      ...prismaOverride,
    };
    const workspaces = { create: jest.fn().mockResolvedValue({}) };
    const service = new AuthService(
      prisma as never,
      jwt,
      config,
      workspaces as never,
    );
    return { service, prisma, workspaces };
  }

  it('signup hashes the password, provisions a workspace, and returns a token', async () => {
    const created = makeUserRow({ passwordHash: 'hash' });
    const { service, prisma, workspaces } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    });

    const res = await service.signup('Test@Vaeloom.dev', 'SecurePass123');

    // password never stored in the clear
    const createArg = (prisma.user as { create: jest.Mock }).create.mock.calls[0][0];
    expect(createArg.data.passwordHash).not.toBe('SecurePass123');
    expect(await bcrypt.compare('SecurePass123', createArg.data.passwordHash)).toBe(true);
    expect(createArg.data.email).toBe('test@vaeloom.dev'); // normalized
    expect(workspaces.create).toHaveBeenCalledWith(created.id, 'My Workspace');
    expect(res.tokenType).toBe('Bearer');
    expect(res.accessToken).toEqual(expect.any(String));
    expect((res.user as { email: string }).email).toBe('test@vaeloom.dev');
  }, 15000);

  it('signup rejects a duplicate email', async () => {
    const { service } = build({
      user: { findUnique: jest.fn().mockResolvedValue(makeUserRow()), create: jest.fn() },
    });
    await expect(service.signup('test@vaeloom.dev', 'SecurePass123')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login succeeds with correct credentials', async () => {
    const passwordHash = await bcrypt.hash('SecurePass123', 4);
    const { service } = build({
      user: { findUnique: jest.fn().mockResolvedValue(makeUserRow({ passwordHash })), create: jest.fn() },
    });
    const res = await service.login('test@vaeloom.dev', 'SecurePass123');
    expect(res.accessToken).toEqual(expect.any(String));
  }, 15000);

  it('login rejects a wrong password with a uniform error', async () => {
    const passwordHash = await bcrypt.hash('SecurePass123', 4);
    const { service } = build({
      user: { findUnique: jest.fn().mockResolvedValue(makeUserRow({ passwordHash })), create: jest.fn() },
    });
    await expect(service.login('test@vaeloom.dev', 'WrongPass999')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login rejects an unknown email with the same uniform error', async () => {
    const { service } = build({
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    });
    await expect(service.login('nobody@vaeloom.dev', 'SecurePass123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
