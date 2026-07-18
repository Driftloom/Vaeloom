import { Expose, Type } from 'class-transformer';

export class IntegrationResponse {
  @Expose()
  id!: string;

  @Expose()
  provider!: string;

  @Expose()
  status!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  externalAccountId?: string;

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
