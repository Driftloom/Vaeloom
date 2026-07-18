import { IsString, IsOptional, IsIn, IsObject, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const JOB_TYPES = ['http', 'event'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export class CreateJobDto {
  @ApiProperty({ example: 'Cleanup orphaned memories' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: JOB_TYPES, example: 'http' })
  @IsIn(JOB_TYPES)
  type!: JobType;

  @ApiProperty({
    description: 'Cron expression (minute hour day month weekday)',
    example: '0 */6 * * *',
  })
  @IsString()
  cron!: string;

  @ApiProperty({ enum: HTTP_METHODS, required: false, example: 'POST' })
  @IsOptional()
  @IsIn(HTTP_METHODS)
  method?: HttpMethod;

  @ApiProperty({
    description: 'Target URL for http jobs',
    required: false,
    example: 'http://connector-service:3100/api/v1/connectors/sync',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiProperty({
    description: 'Event topic for event jobs',
    required: false,
    example: 'job.execute',
  })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
