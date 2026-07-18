import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateNodeDto {
  @ApiPropertyOptional({ example: 'Deep Learning' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    enum: ['concept', 'entity', 'document', 'topic', 'person', 'organization', 'event', 'project'],
  })
  @IsOptional()
  @IsIn(['concept', 'entity', 'document', 'topic', 'person', 'organization', 'event', 'project'])
  type?: string;

  @ApiPropertyOptional({ example: 'A subfield of machine learning' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0.9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number;

  @ApiPropertyOptional({ example: { domain: 'AI', tags: ['deep-learning', 'neural-networks'] } })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
