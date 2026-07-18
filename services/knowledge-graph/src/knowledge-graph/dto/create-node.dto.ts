import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateNodeDto {
  @ApiProperty({ example: 'Machine Learning' })
  @IsString()
  label: string;

  @ApiProperty({
    enum: ['concept', 'entity', 'document', 'topic', 'person', 'organization', 'event', 'project'],
    default: 'concept',
  })
  @IsIn(['concept', 'entity', 'document', 'topic', 'person', 'organization', 'event', 'project'])
  type: string = 'concept';

  @ApiPropertyOptional({ example: 'A subfield of artificial intelligence' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0.8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number;

  @ApiPropertyOptional({ example: { domain: 'AI', tags: ['ml', 'deep-learning'] } })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  tenantId: string;
}
