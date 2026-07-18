import {
  IsArray,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RecordAuditEventDto {
  @ApiProperty({ description: 'Id of the actor performing the action' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  actorId!: string;

  @ApiProperty({ description: 'Action performed, e.g. "memory.delete"' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  action!: string;

  @ApiProperty({ description: 'Resource type, e.g. "memory", "agent"' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  resource!: string;

  @ApiPropertyOptional({ description: 'Id of the affected resource' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Tenant this event belongs to' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tenantId?: string;

  @ApiPropertyOptional({ type: Object, description: 'Additional structured metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class QueryAuditEventsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class ExportAuditDto {
  @ApiPropertyOptional({ enum: ['csv', 'json'], default: 'json' })
  @IsOptional()
  @IsString()
  format?: 'csv' | 'json' = 'json';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: 'ISO start of date range (inclusive)' })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ description: 'ISO end of date range (inclusive)' })
  @IsDateString()
  dateTo!: string;
}

export class ComplianceReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
