import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryEdgeDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class TraverseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  startId: string;

  @ApiPropertyOptional({ example: 3, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  depth?: number = 3;

  @ApiPropertyOptional({ enum: ['bfs', 'dfs'], default: 'bfs' })
  @IsOptional()
  @IsIn(['bfs', 'dfs'])
  mode?: 'bfs' | 'dfs' = 'bfs';
}

export class ShortestPathDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  fromId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440005' })
  @IsString()
  toId: string;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  maxDepth?: number = 5;
}
