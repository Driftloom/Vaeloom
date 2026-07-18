import { Expose, Transform, Type } from 'class-transformer';

export enum PluginStatus {
  REGISTERED = 'REGISTERED',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  FAILED = 'FAILED',
}

export class PluginResponse {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  version!: string;

  @Expose()
  description!: string;

  @Expose()
  author!: string;

  @Expose()
  license!: string;

  @Expose()
  minAppVersion!: string;

  @Expose()
  status!: string;

  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  permissions!: Record<string, unknown>;

  @Expose()
  capabilities!: string[];

  @Expose()
  hooks!: string[];

  @Expose()
  tags!: string[];

  @Expose()
  entryPoint!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  homepage?: string;

  @Expose()
  repository?: string;

  @Expose()
  hasCode!: boolean;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;

  @Expose()
  @Type(() => Date)
  updatedAt!: Date;
}

export class ExecutionResponse {
  @Expose()
  id!: string;

  @Expose()
  pluginId!: string;

  @Expose()
  status!: 'success' | 'error' | 'timeout';

  @Expose()
  durationMs!: number;

  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  output!: unknown;

  @Expose()
  errorMessage?: string;

  @Expose()
  @Type(() => Date)
  createdAt!: Date;
}

export interface PluginRow {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  min_app_version: string;
  status: string;
  permissions: string;
  capabilities: string[];
  hooks: string[];
  tags: string[];
  entry_point: string;
  tenant_id: string;
  homepage: string | null;
  repository: string | null;
  icon: string | null;
  config_schema: string | null;
  code: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExecutionRow {
  id: string;
  plugin_id: string;
  status: 'success' | 'error' | 'timeout';
  duration_ms: number;
  output: string;
  error_message: string | null;
  created_at: Date;
}
