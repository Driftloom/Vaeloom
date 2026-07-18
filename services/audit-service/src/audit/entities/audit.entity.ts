import { Expose, Type } from 'class-transformer';

export class AuditEventResponse {
  @Expose()
  id!: string;

  @Expose()
  actorId!: string;

  @Expose()
  action!: string;

  @Expose()
  resource!: string;

  @Expose()
  resourceId?: string;

  @Expose()
  tenantId?: string;

  @Expose()
  @Type(() => Object)
  metadata!: Record<string, unknown>;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;
}

export class ComplianceReport {
  @Expose()
  @Type(() => Object)
  byAction!: { action: string; count: number }[];

  @Expose()
  @Type(() => Object)
  byResource!: { resource: string; count: number }[];

  @Expose()
  total!: number;

  @Expose()
  @Type(() => Date)
  generatedAt!: Date;
}

export class ExportResponse {
  @Expose()
  format!: string;

  @Expose()
  content!: string;

  @Expose()
  filename!: string;
}
