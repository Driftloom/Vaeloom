import {
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UsageQueryDto {
  @ApiPropertyOptional({ description: 'ISO date to start range' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date to end range' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 'day', enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsString()
  interval?: 'day' | 'week' | 'month' = 'day';

  @ApiPropertyOptional({ description: 'Restrict to a tenant' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class TrackEventDto {
  @ApiProperty({ description: 'Event name, e.g. "export_triggered"' })
  @IsString()
  @Min(1)
  @Max(120)
  name!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Tenant for the event' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class AggregateDto {
  @ApiPropertyOptional({ description: 'ISO date of the day to aggregate (defaults to yesterday)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Tenant to aggregate, empty = all' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
