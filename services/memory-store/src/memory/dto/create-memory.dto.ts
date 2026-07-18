import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MemoryType {
  DOCUMENT = 'document',
  EMAIL = 'email',
  CODE = 'code',
  NOTE = 'note',
  CONVERSATION = 'conversation',
  WEBPAGE = 'webpage',
  STRUCTURED = 'structured',
}

export class CreateMemoryDto {
  @ApiProperty({ enum: MemoryType })
  @IsEnum(MemoryType)
  type!: MemoryType;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: ['upload', 'import', 'sync', 'api', 'email', 'webhook'] })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceUri?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceLabel?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
