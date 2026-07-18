import { IsArray, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GenerateRecommendationDto {
  @ApiProperty({ example: 'user-123' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ description: 'Optional tenant id override' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Context tags to bias results' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contextTags?: string[];

  @ApiPropertyOptional({ type: Object, description: 'Arbitrary context payload' })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  topN?: number = 10;

  @ApiPropertyOptional({ description: 'Enable AI personalization step' })
  @IsOptional()
  @Type(() => Boolean)
  personalize?: boolean = false;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
