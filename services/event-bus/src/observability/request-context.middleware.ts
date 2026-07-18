import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { RequestContextService } from './request-context.service';

const REQUEST_ID_HEADER = 'x-request-id';
const TENANT_HEADER = 'x-tenant-id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers[REQUEST_ID_HEADER];
    const correlationId = (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() || randomUUID();

    const tenantHeader = req.headers[TENANT_HEADER];
    const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;

    res.setHeader(REQUEST_ID_HEADER, correlationId);

    this.requestContext.run({ correlationId, tenantId: tenantId?.trim() || undefined }, () =>
      next(),
    );
  }
}
