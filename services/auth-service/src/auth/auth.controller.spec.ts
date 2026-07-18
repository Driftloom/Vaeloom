import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const configValues: Record<string, unknown> = {
    'auth.jwtSecret': 'test-secret-at-least-16-chars!',
    'auth.jwtExpiresIn': '15m',
    'auth.refreshExpiresIn': '7d',
    'auth.bcryptRounds': 4,
  };
  const config = { get: (key: string) => configValues[key] } as unknown as ConfigService;
  const jwt = new JwtService({ secret: 'test-secret-at-least-16-chars!' });

  const makeUserRow = (over: Partial<Record<string, unknown>> = {}) => ({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'test@vaeloom.dev',
    displayName: 'test',
    tenantId: '22222222-2222-2222-2222-222222222222',
    status: 'ACTIVE',
    passwordHash: null as string | null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  });

  const makeSessionRow = (over: Partial<Record<string, unknown>> = {}) => ({
    id: '33333333-3333-3333-3333-333333333333',
    userId: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    provider: 'email',
    status: 'ACTIVE',
    token: 'tok',
    refreshToken: 'hash',
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    lastActivity: new Date(),
    createdAt: new Date(),
    ...over,
  });

  function build(prismaOverride: Record<string, unknown>) {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
      },
      workspace: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      workspaceUser: {
        create: jest.fn(),
      },
      authSession: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      apiKey: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ...prismaOverride,
    };
    const service = new AuthService(prisma as never, jwt, config);
    return { service, prisma };
  }

  it('register hashes password, creates tenant + workspace, returns token pair', async () => {
    const created = makeUserRow({ passwordHash: 'hash' });
    const { service, prisma } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
      tenant: { create: jest.fn().mockResolvedValue({ id: created.tenantId }) },
      workspace: {
        create: jest.fn().mockResolvedValue({ id: 'w1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'w1' }),
      },
      workspaceUser: { create: jest.fn().mockResolvedValue({}) },
    });

    const res = await service.register('Test@Vaeloom.dev', 'SecurePass123');

    const createArg = (prisma.user as { create: jest.Mock }).create.mock.calls[0][0];
    expect(createArg.data.passwordHash).not.toBe('SecurePass123');
    expect(await bcrypt.compare('SecurePass123', createArg.data.passwordHash)).toBe(true);
    expect(createArg.data.email).toBe('test@vaeloom.dev');
    expect(res.accessToken).toEqual(expect.any(String));
    expect(res.refreshToken).toEqual(expect.any(String));
    expect(res.sessionId).toEqual(expect.any(String));
  });

  it('register rejects a duplicate email', async () => {
    const { service } = build({
      user: { findUnique: jest.fn().mockResolvedValue(makeUserRow()), create: jest.fn() },
    });
    await expect(service.register('test@vaeloom.dev', 'SecurePass123')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login succeeds with correct credentials', async () => {
    const passwordHash = await bcrypt.hash('SecurePass123', 4);
    const { service } = build({
      user: { findUnique: jest.fn().mockResolvedValue(makeUserRow({ passwordHash })), create: jest.fn() },
      authSession: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(makeSessionRow()),
        update: jest.fn(),
      },
    });
    const res = await service.login('test@vaeloom.dev', 'SecurePass123');
    expect(res.accessToken).toEqual(expect.any(String));
    expect(res.refreshToken).toEqual(expect.any(String));
  });

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

  it('refresh issues a new token pair when session is valid', async () => {
    const session = makeSessionRow();
    const { service, prisma } = build({
      authSession: {
        findUnique: jest.fn().mockResolvedValue(session),
        create: jest.fn().mockResolvedValue({ ...session, id: 'new-session' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue(makeUserRow()), create: jest.fn() },
    });

    const res = await service.refresh(session.id as string, 'valid-refresh-token');
    expect(res.accessToken).toEqual(expect.any(String));
    expect(res.refreshToken).toEqual(expect.any(String));
    expect((prisma.authSession as { update: jest.Mock }).update).toHaveBeenCalled();
  });

  it('refresh throws when session is revoked', async () => {
    const { service } = build({
      authSession: {
        findUnique: jest.fn().mockResolvedValue(makeSessionRow({ status: 'REVOKED' })),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    await expect(service.refresh('session-id', 'some-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout marks the session as revoked', async () => {
    const { service, prisma } = build({
      authSession: {
        findUnique: jest.fn().mockResolvedValue(makeSessionRow()),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    await service.logout('session-id');
    expect((prisma.authSession as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REVOKED' } }),
    );
  });

  it('getProfile returns user with workspaces', async () => {
    const { service } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          ...makeUserRow(),
          workspaces: [
            {
              role: 'OWNER',
              workspace: { id: 'w1', name: 'My Workspace', slug: 'my-workspace' },
            },
          ],
        }),
        create: jest.fn(),
      },
    });
    const profile = await service.getProfile('user-id');
    expect(profile.user.email).toBe('test@vaeloom.dev');
    expect(profile.workspaces).toHaveLength(1);
    expect(profile.workspaces[0].role).toBe('OWNER');
  });
});
