import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { TenantContextMiddleware } from './tenant-context.middleware';

describe('TenantContextMiddleware', () => {
  const mockRequestContext = {
    setPrincipal: jest.fn(),
  };

  function buildMiddleware(prismaOverrides: Record<string, unknown> = {}) {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', status: 'ACTIVE', slug: 'acme' }),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      ...prismaOverrides,
    };
    const middleware = new TenantContextMiddleware(
      prisma as never,
      mockRequestContext as never,
    );
    return { middleware, prisma };
  }

  const mockRes = {} as Response;
  let nextCalled: boolean;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  beforeEach(() => {
    nextCalled = false;
    jest.clearAllMocks();
  });

  it('passes through for unauthenticated (public) routes', async () => {
    const { middleware } = buildMiddleware();
    const req = { headers: {} } as Request;
    await middleware.use(req, mockRes, next);
    expect(nextCalled).toBe(true);
    expect(mockRequestContext.setPrincipal).not.toHaveBeenCalled();
  });

  it('passes through when user has no tenantId (MVP mode)', async () => {
    const { middleware } = buildMiddleware();
    const req = { user: { id: 'user-1' }, headers: {} } as unknown as Request;
    await middleware.use(req, mockRes, next);
    expect(nextCalled).toBe(true);
  });

  it('sets tenant context for authenticated user with tenantId', async () => {
    const { middleware, prisma } = buildMiddleware();
    const req = {
      user: { id: 'user-1', tenantId: 'tenant-1' },
      headers: {},
    } as unknown as Request;

    await middleware.use(req, mockRes, next);

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: { id: true, status: true, slug: true },
    });
    expect(mockRequestContext.setPrincipal).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      `SET LOCAL app.current_tenant_id = 'tenant-1'`,
    );
    expect(nextCalled).toBe(true);
  });

  it('reads tenantId from x-tenant-id header as fallback', async () => {
    const { middleware } = buildMiddleware();
    const req = {
      user: { id: 'user-1' },
      headers: { 'x-tenant-id': 'tenant-1' },
    } as unknown as Request;

    await middleware.use(req, mockRes, next);
    expect(mockRequestContext.setPrincipal).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
  });

  it('rejects when tenant is not found', async () => {
    const { middleware } = buildMiddleware({
      tenant: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const req = {
      user: { id: 'user-1', tenantId: 'nonexistent' },
      headers: {},
    } as unknown as Request;

    await expect(middleware.use(req, mockRes, next)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when tenant is suspended', async () => {
    const { middleware } = buildMiddleware({
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          status: 'SUSPENDED',
          slug: 'acme',
        }),
      },
    });
    const req = {
      user: { id: 'user-1', tenantId: 'tenant-1' },
      headers: {},
    } as unknown as Request;

    await expect(middleware.use(req, mockRes, next)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows TRIAL status tenants', async () => {
    const { middleware } = buildMiddleware({
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          status: 'TRIAL',
          slug: 'acme',
        }),
      },
    });
    const req = {
      user: { id: 'user-1', tenantId: 'tenant-1' },
      headers: {},
    } as unknown as Request;

    await middleware.use(req, mockRes, next);
    expect(nextCalled).toBe(true);
  });

  it('handles RLS SET LOCAL failure gracefully', async () => {
    const { middleware } = buildMiddleware({
      $executeRawUnsafe: jest.fn().mockRejectedValue(new Error('RLS not ready')),
    });
    const req = {
      user: { id: 'user-1', tenantId: 'tenant-1' },
      headers: {},
    } as unknown as Request;

    // Should not throw — just warn
    await middleware.use(req, mockRes, next);
    expect(nextCalled).toBe(true);
  });
});
