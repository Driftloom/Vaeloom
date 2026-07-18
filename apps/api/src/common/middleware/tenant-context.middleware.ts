import { ConflictException, Injectable, Logger, type NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../observability/request-context.service';

/**
 * Tenant context propagation middleware (Docs/Enterprise/Multi-Tenancy.md).
 *
 * Applied AFTER the auth guard has resolved the JWT so `req.user` is populated.
 * Responsibilities:
 * 1. Extract tenantId from the authenticated user's JWT claims.
 * 2. Verify tenant exists and is ACTIVE (reject suspended/deleted tenants).
 * 3. Propagate tenantId into the RequestContextService for the async chain.
 * 4. Set `app.current_tenant_id` on the database session for PostgreSQL RLS.
 *
 * For unauthenticated (public) routes, the middleware passes through without
 * setting tenant context — those routes must not access tenant-scoped data.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const user = (req as any).user as
      | { id: string; tenantId?: string }
      | undefined;

    // No authenticated user → public route; skip tenant enforcement.
    if (!user) {
      next();
      return;
    }

    const tenantId = user.tenantId ?? (req.headers['x-tenant-id'] as string | undefined);

    if (!tenantId) {
      // MVP mode: user exists but has no tenant claim — allow through.
      // Enterprise mode with mandatory tenants would throw here.
      next();
      return;
    }

    // Verify tenant is active. Cache this in production (Redis read-through).
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, slug: true },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      throw new UnauthorizedException(
        `Tenant "${tenant.slug}" is ${tenant.status.toLowerCase()}. Contact support.`,
      );
    }

    // Propagate into the async-local context so all downstream code can read it.
    this.requestContext.setPrincipal({ userId: user.id, tenantId });

    // Set PostgreSQL session variable for RLS enforcement.
    // SET LOCAL scopes to the current transaction; safe for connection pooling.
    try {
      await this.prisma.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
    } catch (err) {
      this.logger.warn(
        { tenantId, err },
        'Failed to set RLS session variable — RLS policies may not be active yet',
      );
    }

    next();
  }
}
