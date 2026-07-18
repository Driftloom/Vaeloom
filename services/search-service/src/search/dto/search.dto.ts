import {
  IsArray,
  IsBoolean,
  IsEnum,
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

export class SearchQueryDto {
  @ApiProperty({ description: 'Text query used for both keyword and vector search' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  query!: string;

  @ApiPropertyOptional({ default: 10, description: 'Maximum results to return' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: ['memory', 'knowledge', 'all'],
    default: 'all',
    description: 'Scope of the search',
  })
  @IsOptional()
  @IsEnum(['memory', 'knowledge', 'all'])
  scope?: 'memory' | 'knowledge' | 'all' = 'all';

  @ApiPropertyOptional({ default: 0, description: 'Minimum semantic relevance score (0-1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  minScore?: number = 0;

  @ApiPropertyOptional({ type: [String], description: 'Restrict to these tenants' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Restrict to these tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class SuggestQueryDto {
  @ApiProperty({ description: 'Prefix to autocomplete' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  prefix!: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number = 10;
}

export class IndexDto {
  @ApiPropertyOptional({ type: [String], description: 'Tenant ids to (re)index, empty = all' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  @ApiPropertyOptional({ description: 'Force regeneration even if embeddings exist' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class SearchFeedbackDto {
  @ApiProperty({ description: 'Id of the clicked result' })
  @IsString()
  @MinLength(1)
  resultId!: string;

  @ApiProperty({ enum: ['memory', 'knowledge'], description: 'Source type of the clicked result' })
  @IsEnum(['memory', 'knowledge'])
  sourceType!: 'memory' | 'knowledge';

  @ApiPropertyOptional({ description: 'The original query that produced the result' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  query?: string;

  @ApiPropertyOptional({ description: 'Relevance rating 1-5' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
