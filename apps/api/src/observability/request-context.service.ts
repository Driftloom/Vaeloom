import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

/**
 * Per-request state carried across the async call chain. `correlationId` is the
 * trace id stamped on every log line (Docs/DevOps/Logging.md); `tenantId` scopes
 * every downstream query for tenant isolation (Docs/Enterprise/Multi-Tenancy.md).
 */
export interface RequestStore {
  correlationId: string;
  userId?: string;
  tenantId?: string;
}

/**
 * AsyncLocalStorage-backed request context. Established once per request by
 * RequestContextMiddleware and read anywhere in the request lifecycle without
 * threading arguments through every call. This is the foundation the tenant
 * isolation layer builds on: repositories set `app.current_tenant_id` from the
 * tenantId here so PostgreSQL RLS can enforce row scoping.
 */
@Injectable()
export class RequestContextService {
  private static readonly storage = new AsyncLocalStorage<RequestStore>();

  run<T>(store: RequestStore, callback: () => T): T {
    return RequestContextService.storage.run(store, callback);
  }

  getStore(): RequestStore | undefined {
    return RequestContextService.storage.getStore();
  }

  get correlationId(): string | undefined {
    return RequestContextService.storage.getStore()?.correlationId;
  }

  get userId(): string | undefined {
    return RequestContextService.storage.getStore()?.userId;
  }

  get tenantId(): string | undefined {
    return RequestContextService.storage.getStore()?.tenantId;
  }

  /**
   * Attach the authenticated principal to the active context. Called by the auth
   * layer after a request is authenticated so later log lines and queries carry
   * the resolved user/tenant.
   */
  setPrincipal(principal: { userId?: string; tenantId?: string }): void {
    const store = RequestContextService.storage.getStore();
    if (!store) return;
    if (principal.userId !== undefined) store.userId = principal.userId;
    if (principal.tenantId !== undefined) store.tenantId = principal.tenantId;
  }
}
