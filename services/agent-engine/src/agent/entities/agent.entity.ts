import { Expose, Type } from 'class-transformer';

export class AgentResponse {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  category!: string;

  @Expose()
  @Type(() => Object)
  config!: Record<string, unknown>;

  @Expose()
  capabilities!: string[];

  @Expose()
  permissions!: string[];

  @Expose()
  active!: boolean;

  @Expose()
  tenantId!: string;

  @Expose()
  ownerId?: string;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}

export class AgentExecutionResponse {
  @Expose()
  id!: string;

  @Expose()
  agentId!: string;

  @Expose()
  @Type(() => Object)
  input!: Record<string, unknown>;

  @Expose()
  @Type(() => Object)
  output!: Record<string, unknown> | null;

  @Expose()
  status!: string;

  @Expose()
  error?: string | null;

  @Expose()
  durationMs?: number | null;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;
}

export class AgentScheduleResponse {
  @Expose()
  id!: string;

  @Expose()
  agentId!: string;

  @Expose()
  cron!: string;

  @Expose()
  @Type(() => Object)
  input!: Record<string, unknown>;

  @Expose()
  enabled!: boolean;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;
}
