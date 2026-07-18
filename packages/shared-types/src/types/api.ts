export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ApiRequest<T = Record<string, unknown>> {
  body: T;
  query: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  userId: string;
  tenantId: string;
  requestId: string;
}

export interface SortQuery {
  field: string;
  order: 'asc' | 'desc';
}

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  importance: number;
  metadata?: Record<string, unknown>;
}
