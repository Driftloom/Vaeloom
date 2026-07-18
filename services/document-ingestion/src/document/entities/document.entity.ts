import { Expose, Type } from 'class-transformer';

export class DocumentChunkResponse {
  @Expose()
  id!: string;

  @Expose()
  documentId!: string;

  @Expose()
  content!: string;

  @Expose()
  chunkIndex!: number;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;
}

export class DocumentResponse {
  @Expose()
  id!: string;

  @Expose()
  title!: string;

  @Expose()
  status!: string;

  @Expose()
  sourceType!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  workspaceId?: string;

  @Expose()
  connectorId?: string;

  @Expose()
  chunkCount!: number;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}
