import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PublishEventDto {
  @ApiProperty({ example: 'memory.created' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  type: string;

  @ApiProperty({ example: 'memory-store' })
  @IsString()
  source: string;

  @ApiProperty({ enum: ['memory', 'agent', 'auth', 'billing', 'system', 'sync', 'user', 'integration'] })
  @IsIn(['memory', 'agent', 'auth', 'billing', 'system', 'sync', 'user', 'integration'])
  category: string;

  @ApiProperty({ enum: ['critical', 'high', 'normal', 'low'], default: 'normal' })
  @IsOptional()
  @IsIn(['critical', 'high', 'normal', 'low'])
  priority?: string = 'normal';

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  causationId?: string;

  @ApiProperty({ example: { entityId: 'abc-123', title: 'New Memory' } })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}

export class BatchPublishEventDto {
  @ApiProperty({ type: [PublishEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublishEventDto)
  events: PublishEventDto[];
}
