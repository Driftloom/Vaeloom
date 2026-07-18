import { Expose, Transform, Type } from 'class-transformer';

export class MemoryResponse {
  @Expose()
  id!: string;

  @Expose()
  type!: string;

  @Expose()
  status!: string;

  @Expose()
  title!: string;

  @Expose()
  summary?: string;

  @Expose()
  content?: string;

  @Expose()
  contentHash!: string;

  @Expose()
  size!: number;

  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  metadata!: Record<string, unknown>;

  @Expose()
  tags!: string[];

  @Expose()
  sourceType?: string;

  @Expose()
  sourceUri?: string;

  @Expose()
  sourceLabel?: string;

  @Expose()
  tenantId!: string;

  @Expose()
  userId?: string;

  @Expose()
  workspaceId?: string;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}
