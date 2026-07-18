import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['http', 'event'] })
  type!: string;

  @ApiProperty()
  cron!: string;

  @ApiPropertyOptional()
  method?: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiPropertyOptional()
  event?: string;

  @ApiPropertyOptional({ type: Object })
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  headers?: Record<string, string>;

  @ApiProperty({ enum: ['active', 'paused', 'disabled'] })
  status!: string;

  @ApiPropertyOptional()
  lastRunAt?: Date | null;

  @ApiPropertyOptional()
  nextRunAt?: Date | null;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class JobExecutionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  jobId!: string;

  @ApiProperty({ enum: ['running', 'success', 'failed'] })
  status!: string;

  @ApiPropertyOptional()
  startedAt?: Date | null;

  @ApiPropertyOptional()
  finishedAt?: Date | null;

  @ApiPropertyOptional()
  statusCode?: number | null;

  @ApiPropertyOptional()
  error?: string | null;
}
