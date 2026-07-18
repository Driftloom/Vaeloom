import { Expose, Transform, Type } from 'class-transformer';

export class ConnectorResponse {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  type!: string;

  @Expose()
  status!: string;

  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  config!: Record<string, unknown>;

  @Expose()
  tenantId!: string;

  @Expose()
  lastSyncStatus?: string;

  @Expose()
  @Type(() => Date)
  lastSyncAt?: Date;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}
