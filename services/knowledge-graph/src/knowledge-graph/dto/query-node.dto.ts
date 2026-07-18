import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryNodeDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    enum: ['concept', 'entity', 'document', 'topic', 'person', 'organization', 'event', 'project'],
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'machine' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minImportance?: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  maxImportance?: number;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ enum: ['createdAt', 'label', 'importance'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'label', 'importance'])
  sortBy?: 'createdAt' | 'label' | 'importance' = 'createdAt';
}
