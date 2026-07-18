import type { RestPagination } from './types';

export interface PaginationHandler {
  getNextParams(response: unknown, params: Record<string, unknown>): Record<string, unknown> | null;
}

export function createPaginationHandler(config: RestPagination): PaginationHandler {
  switch (config.type) {
    case 'offset':
      return new OffsetPagination(config);
    case 'cursor':
      return new CursorPagination(config);
    case 'page':
      return new PagePagination(config);
    default:
      return new OffsetPagination(config);
  }
}

class OffsetPagination implements PaginationHandler {
  private offsetParam: string;
  private limitParam: string;
  private limit: number;

  constructor(config: RestPagination) {
    this.offsetParam = config.offsetParam ?? 'offset';
    this.limitParam = config.limitParam ?? 'limit';
    this.limit = config.limit ?? 100;
  }

  getNextParams(response: unknown, params: Record<string, unknown>): Record<string, unknown> | null {
    const data = response as { data?: unknown[] };
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    if (items.length < this.limit) return null;

    const currentOffset = (params[this.offsetParam] as number) ?? 0;
    return { ...params, [this.offsetParam]: currentOffset + this.limit, [this.limitParam]: this.limit };
  }
}

class CursorPagination implements PaginationHandler {
  private cursorParam: string;
  private limitParam: string;
  private limit: number;

  constructor(config: RestPagination) {
    this.cursorParam = config.cursorParam ?? 'cursor';
    this.limitParam = config.limitParam ?? 'limit';
    this.limit = config.limit ?? 100;
  }

  getNextParams(response: unknown, params: Record<string, unknown>): Record<string, unknown> | null {
    const body = response as { nextCursor?: string; cursor?: string; meta?: { cursor?: string } };
    const nextCursor = body.nextCursor ?? body.cursor ?? body.meta?.cursor;
    if (!nextCursor) return null;

    return { ...params, [this.cursorParam]: nextCursor, [this.limitParam]: this.limit };
  }
}

class PagePagination implements PaginationHandler {
  private pageParam: string;
  private limitParam: string;
  private limit: number;

  constructor(config: RestPagination) {
    this.pageParam = config.pageParam ?? 'page';
    this.limitParam = config.limitParam ?? 'limit';
    this.limit = config.limit ?? 100;
  }

  getNextParams(response: unknown, params: Record<string, unknown>): Record<string, unknown> | null {
    const body = response as { total?: number; totalPages?: number; data?: unknown[] };
    const currentPage = (params[this.pageParam] as number) ?? 1;
    const items = Array.isArray(body?.data) ? body.data : [];

    const totalPages = body.totalPages ?? Math.ceil((body.total ?? 0) / this.limit);
    if (currentPage >= totalPages || items.length === 0) return null;

    return { ...params, [this.pageParam]: currentPage + 1, [this.limitParam]: this.limit };
  }
}
