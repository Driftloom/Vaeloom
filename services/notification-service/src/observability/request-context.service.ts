import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

export interface RequestStore {
  correlationId: string;
  userId?: string;
  tenantId?: string;
}

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

  setPrincipal(principal: { userId?: string; tenantId?: string }): void {
    const store = RequestContextService.storage.getStore();
    if (!store) return;
    if (principal.userId !== undefined) store.userId = principal.userId;
    if (principal.tenantId !== undefined) store.tenantId = principal.tenantId;
  }
}
